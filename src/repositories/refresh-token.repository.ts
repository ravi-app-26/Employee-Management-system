import { DataSource, IsNull, Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';

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
  }): Promise<RefreshToken> {
    const token = this.repo.create(data);
    return this.repo.save(token);
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
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

  async revokeSession(userId: string, familyId: string): Promise<boolean> {
    const active = await this.repo.exists({
      where: { userId, familyId, revokedAt: IsNull() },
    });
    if (!active) return false;
    await this.revokeFamily(familyId);
    return true;
  }

  // Ek token revoke (rotation ke time purana token)
  async revoke(id: string): Promise<void> {
    await this.repo.update({ id, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  // Poori family revoke (reuse detection ya logout)
  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  // Ek user ke saare tokens revoke (logout-all, password change)
  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}