import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshToken } from '../entities';
import { SessionAuditEventType } from '../entities/session-audit-event.entity';
import { logger } from '../config/logger';
import {
  deleteSessionId,
  hasSessionId,
  storeSessionId,
} from '../providers/redis/session-cache.provider';
import {
  deleteRefreshToken,
  deleteRefreshTokenFamily,
  removeExpiredRefreshTokenCache,
  storeRefreshToken,
} from '../providers/redis/refresh-token-cache.provider';
import { insertSessionAuditEvent } from '../utils/session-audit';
export class RefreshTokenRepository {
  private readonly repo: Repository<RefreshToken>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(RefreshToken);
  }

  async create(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    correlationId?: string;
  }): Promise<RefreshToken> {
    const saved = await this.repo.manager.transaction(async (manager) => {
      const token = await manager.save(RefreshToken, manager.create(RefreshToken, data));
      await insertSessionAuditEvent(manager, {
        eventKey: `SESSION_CREATED:${data.familyId}`,
        userId: data.userId,
        sessionId: data.familyId,
        eventType: 'SESSION_CREATED',
        correlationId: data.correlationId,
      });
      return token;
    });
    await storeSessionId(saved.familyId, saved.expiresAt);
    await storeRefreshToken(saved);
    return saved;
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const token = await this.repo.findOne({ where: { tokenHash } });
    if (token) await storeRefreshToken(token);
    return token;
  }

  async ensureSession(sessionId: string, expiresAt: Date): Promise<void> {
    if (!(await hasSessionId(sessionId))) {
      logger.info(
        'Redis session cache miss or unavailable; PostgreSQL token is valid, restoring session key',
      );
      await storeSessionId(sessionId, expiresAt);
    }
  }

  async findActiveSessionExpiry(userId: string, familyId: string): Promise<Date | null> {
    const activeToken = await this.repo.findOne({
      where: {
        userId,
        familyId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { id: true, expiresAt: true },
      order: { expiresAt: 'DESC' },
    });
    return activeToken?.expiresAt ?? null;
  }

  findTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async findFamilyTokens(familyId: string): Promise<RefreshToken[]> {
    return this.repo.find({
      where: { familyId },
      select: { id: true, tokenHash: true, expiresAt: true, revokedAt: true },
    });
  }

  async findActiveFamilyTokens(familyId: string): Promise<RefreshToken[]> {
    return this.repo.createQueryBuilder('token')
      .innerJoin('token.user', 'user', 'user.is_active = TRUE')
      .where('token.family_id = :familyId', { familyId })
      .andWhere('token.revoked_at IS NULL')
      .andWhere('token.expires_at > clock_timestamp()')
      .select(['token.id', 'token.userId', 'token.familyId', 'token.tokenHash', 'token.expiresAt', 'token.createdAt', 'token.revokedAt'])
      .getMany();
  }

  async findStaleSessionFamilyIds(afterFamilyId?: string, limit = 500): Promise<string[]> {
    const query = this.repo.createQueryBuilder('token')
      .leftJoin('token.user', 'user')
      .where('(token.revoked_at IS NOT NULL OR token.expires_at <= clock_timestamp() OR user.is_active = FALSE)')
      .select('token.family_id', 'familyId')
      .distinct(true)
      .orderBy('token.family_id', 'ASC')
      .take(limit);
    if (afterFamilyId) query.andWhere('token.family_id > :afterFamilyId', { afterFamilyId });
    const rows = await query.getRawMany<{ familyId: string }>();
    return rows.map(({ familyId }) => familyId);
  }

  async findExpiredFamilyOwner(familyId: string): Promise<{ userId: string; tokenId: string } | null> {
    return this.repo.createQueryBuilder('token')
      .innerJoin('token.user', 'user', 'user.is_active = TRUE')
      .where('token.family_id = :familyId', { familyId })
      .andWhere('token.revoked_at IS NULL')
      .andWhere('token.expires_at <= clock_timestamp()')
      .select(['token.id', 'token.userId'])
      .orderBy('token.expiresAt', 'DESC')
      .getOne()
      .then((token) => token ? { userId: token.userId, tokenId: token.id } : null);
  }

  async recordSessionExpired(familyId: string, userId: string, tokenId: string): Promise<void> {
    await this.repo.manager.transaction((manager) => insertSessionAuditEvent(manager, {
      eventKey: `SESSION_EXPIRED:${familyId}`,
      userId,
      sessionId: familyId,
      eventType: 'SESSION_EXPIRED',
      correlationId: tokenId,
    }));
  }

  async cleanupFamilyCache(familyId: string): Promise<void> {
    const tokens = await this.findFamilyTokens(familyId);
    await Promise.all(tokens.map((token) => removeExpiredRefreshTokenCache(token.tokenHash, familyId)));
    await deleteSessionId(familyId);
    await deleteRefreshTokenFamily(familyId);
  }

  cleanupTokenCache(tokenHash: string, familyId: string): Promise<void> {
    return removeExpiredRefreshTokenCache(tokenHash, familyId);
  }

  async rotate(
    tokenId: string,
    familyId: string,
    replacement: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
  ): Promise<boolean> {
    const previous = await this.repo.findOne({ where: { id: tokenId } });
    const rotated = await this.repo.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ revokedAt: new Date() })
        .where('id = :tokenId AND revoked_at IS NULL AND expires_at > clock_timestamp()', {
          tokenId,
        })
        .execute();

      if (result.affected !== 1) {
        await manager.update(
          RefreshToken,
          { familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return false;
      }

      await manager.insert(RefreshToken, { ...replacement, familyId });
      return true;
    });

    if (!rotated) {
      await deleteSessionId(familyId);
      await deleteRefreshTokenFamily(familyId);
      return false;
    }

    if (previous) await deleteRefreshToken(previous.tokenHash);
    await storeSessionId(familyId, replacement.expiresAt);
    const next = await this.repo.findOne({ where: { tokenHash: replacement.tokenHash } });
    if (next) await storeRefreshToken(next);
    return true;
  }

  async listActiveSessions(userId: string, now = new Date()) {
    return this.repo
      .createQueryBuilder('token')
      .select('token.familyId', 'id')
      .addSelect('MIN(token.createdAt)', 'createdAt')
      .addSelect('MAX(token.expiresAt)', 'expiresAt')
      .where('token.userId = :userId', { userId })
      .andWhere('token.revokedAt IS NULL')
      .andWhere('token.expiresAt > :now', { now })
      .groupBy('token.familyId')
      .orderBy('MIN(token.createdAt)', 'DESC')
      .getRawMany<{ id: string; createdAt: Date; expiresAt: Date }>();
  }

  async revokeSession(
    userId: string,
    familyId: string,
    eventType: SessionAuditEventType = 'SESSION_REVOKED',
    correlationId?: string,
  ): Promise<boolean> {
    const active = await this.repo.exists({
      where: { userId, familyId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!active) return false;
    await this.revokeFamily(familyId, eventType, correlationId);
    return true;
  }

  // Ek token revoke (rotation ke time purana token)
  async revoke(id: string): Promise<void> {
    await this.repo.update({ id, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  // Poori family revoke (reuse detection ya logout)
  async revokeFamily(
    familyId: string,
    eventType: SessionAuditEventType = 'SESSION_REVOKED',
    correlationId?: string,
    additionalEventType?: SessionAuditEventType,
  ): Promise<void> {
    const familyTokens = await this.repo.find({ where: { familyId }, select: { userId: true, id: true } });
    const userId = familyTokens[0]?.userId ?? null;
    if (familyTokens.length) {
      await this.repo.manager.transaction(async (manager) => {
        await manager.update(RefreshToken, { familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
        await insertSessionAuditEvent(manager, {
          eventKey: `${eventType}:${familyId}`,
          userId,
          sessionId: familyId,
          eventType,
          correlationId,
        });
        if (additionalEventType) {
          await insertSessionAuditEvent(manager, {
            eventKey: `${additionalEventType}:${familyTokens[0].id}`,
            userId,
            sessionId: familyId,
            eventType: additionalEventType,
            correlationId,
          });
        }
      });
    }
    await deleteSessionId(familyId);
    await deleteRefreshTokenFamily(familyId);
  }

  // Ek user ke saare tokens revoke (logout-all, password change)
  async revokeAllForUser(
    userId: string,
    eventType: SessionAuditEventType = 'LOGOUT',
    correlationId?: string,
  ): Promise<void> {
    const sessions = await this.repo.find({
      select: { familyId: true },
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    const familyIds = [...new Set(sessions.map(({ familyId }) => familyId))];
    await this.repo.manager.transaction(async (manager) => {
      await manager.update(RefreshToken, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      for (const familyId of familyIds) {
        await insertSessionAuditEvent(manager, {
          eventKey: `${eventType}:${familyId}`,
          userId,
          sessionId: familyId,
          eventType,
          correlationId,
        });
      }
    });
    await this.invalidateUserCache(userId);
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const sessions = await this.repo.find({
      select: { familyId: true },
      where: { userId },
    });
    const sessionIds = [...new Set(sessions.map(({ familyId }) => familyId))];
    await Promise.all(sessionIds.map(async (sessionId) => {
      await deleteSessionId(sessionId);
      await deleteRefreshTokenFamily(sessionId);
    }));
  }
}