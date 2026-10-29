import { createHash } from 'node:crypto';
import { logger } from '../config/logger';
import { markExpiryEventProcessed, storeRefreshToken } from '../providers/redis/refresh-token-cache.provider';
import { storeSessionId } from '../providers/redis/session-cache.provider';
import { parseSessionCacheExpiryKey } from '../providers/redis/session-cache.keys';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { recordOperationalMetric } from '../providers/redis/redis.metrics';

export class SessionExpiryEventService {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async handleExpiredKey(key: string, eventAt = new Date()): Promise<void> {
    const parsed = parseSessionCacheExpiryKey(key);
    if (!parsed) return;
    recordOperationalMetric('expiryEventsReceived');

    const fingerprint = createHash('sha256').update(`${parsed.type}:${key}`).digest('hex');
    if (!(await markExpiryEventProcessed(fingerprint))) {
      recordOperationalMetric('expiryEventsDuplicate');
      logger.info({ eventType: parsed.type, recordId: this.safeRecordId(parsed), eventAt, outcome: 'duplicate' }, 'Redis expiry event ignored');
      return;
    }

    try {
      if (parsed.type === 'refresh-token') {
        await this.handleTokenExpiry(parsed.tokenHash, eventAt);
      } else {
        await this.restoreOrCleanFamily(parsed.familyId);
      }
      logger.info({ eventType: parsed.type, recordId: this.safeRecordId(parsed), eventAt, outcome: 'processed' }, 'Redis expiry event processed');
      recordOperationalMetric('expiryEventsProcessed');
    } catch (error) {
      logger.error({
        eventType: parsed.type,
        recordId: this.safeRecordId(parsed),
        eventAt,
        outcome: 'failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof TypeError ? error.message.slice(0, 160) : undefined,
      }, 'Redis expiry event processing failed');
      recordOperationalMetric('expiryEventsFailed');
    }
  }

  async reconcileStaleSessions(): Promise<{ examined: number; families: number }> {
    let afterFamilyId: string | undefined;
    let examined = 0;
    let families = 0;
    let batch: string[];

    do {
      batch = await this.refreshTokens.findStaleSessionFamilyIds(afterFamilyId, 500);
      for (const familyId of batch) {
        await this.refreshTokens.cleanupFamilyCache(familyId);
        await this.restoreOrCleanFamily(familyId);
        afterFamilyId = familyId;
        examined += 1;
        families += 1;
      }
    } while (batch.length === 500);

    logger.info({ examined, families, eventAt: new Date(), outcome: 'completed' }, 'Session cache reconciliation completed');
    recordOperationalMetric('sessionReconciliationRuns');
    return { examined, families };
  }

  private async handleTokenExpiry(tokenHash: string, eventAt: Date): Promise<void> {
    const token = await this.refreshTokens.findTokenByHash(tokenHash);
    if (!token) return;
    await this.refreshTokens.cleanupTokenCache(token.tokenHash, token.familyId);
    await this.restoreOrCleanFamily(token.familyId);
    logger.debug({ eventType: 'refresh-token', recordId: token.id, eventAt, outcome: 'metadata-cleaned' }, 'Expired token metadata handled');
  }

  private async restoreOrCleanFamily(familyId: string): Promise<void> {
    const activeTokens = await this.refreshTokens.findActiveFamilyTokens(familyId);
    if (!activeTokens.length) {
      const expired = await this.refreshTokens.findExpiredFamilyOwner(familyId);
      if (expired) {
        await this.refreshTokens.recordSessionExpired(familyId, expired.userId, expired.tokenId);
      }
      await this.refreshTokens.cleanupFamilyCache(familyId);
      return;
    }

    const expiry = activeTokens.reduce(
      (latest, token) => token.expiresAt > latest ? token.expiresAt : latest,
      activeTokens[0].expiresAt,
    );
    await storeSessionId(familyId, expiry);
    await Promise.all(activeTokens.map((token) => storeRefreshToken(token)));
  }

  private safeRecordId(event: NonNullable<ReturnType<typeof parseSessionCacheExpiryKey>>): string {
    return event.type === 'refresh-token' ? 'refresh-token-metadata' : event.familyId;
  }
}
