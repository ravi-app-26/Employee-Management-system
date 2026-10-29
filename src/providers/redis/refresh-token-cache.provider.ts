import { logger } from '../../config/logger';
import { RefreshToken } from '../../entities';
import { redisClient } from './redis.provider';
import { expiryEventKey, refreshTokenFamilyKey, refreshTokenKey } from './session-cache.keys';

interface CachedRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export async function storeRefreshToken(token: RefreshToken): Promise<void> {
  if (!redisClient.isReady) return;

  const ttlSeconds = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
  if (ttlSeconds <= 0) return;

  const cached: CachedRefreshToken = {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    familyId: token.familyId,
    expiresAt: token.expiresAt.toISOString(),
    revokedAt: token.revokedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
  };

  try {
    await redisClient.set(refreshTokenKey(token.tokenHash), JSON.stringify(cached), { EX: ttlSeconds });
    await redisClient.sAdd(refreshTokenFamilyKey(token.familyId), token.tokenHash);
    await redisClient.expire(refreshTokenFamilyKey(token.familyId), ttlSeconds);
  } catch (error) {
    logger.warn({ err: error }, 'Refresh-token Redis write failed');
  }
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  if (!redisClient.isReady) return null;

  try {
    const value = await redisClient.get(refreshTokenKey(tokenHash));
    if (!value) return null;

    const cached = JSON.parse(value) as CachedRefreshToken;
    return Object.assign(new RefreshToken(), {
      ...cached,
      expiresAt: new Date(cached.expiresAt),
      revokedAt: cached.revokedAt ? new Date(cached.revokedAt) : null,
      createdAt: new Date(cached.createdAt),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Refresh-token Redis lookup failed');
    return null;
  }
}

export async function deleteRefreshToken(tokenHash: string): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.del(refreshTokenKey(tokenHash));
  } catch (error) {
    logger.warn({ err: error }, 'Refresh-token Redis delete failed');
  }
}

export async function deleteRefreshTokenFamily(familyId: string): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    const key = refreshTokenFamilyKey(familyId);
    const hashes = await redisClient.sMembers(key);
    if (hashes.length) await redisClient.del(hashes.map(refreshTokenKey));
    await redisClient.del(key);
  } catch (error) {
    logger.warn({ err: error }, 'Refresh-token Redis family delete failed');
  }
}

export async function removeExpiredRefreshTokenCache(
  tokenHash: string,
  familyId: string,
): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.del(refreshTokenKey(tokenHash));
    await redisClient.sRem(refreshTokenFamilyKey(familyId), tokenHash);
  } catch (error) {
    logger.warn({ err: error }, 'Expired refresh-token cache cleanup failed');
  }
}

export async function markExpiryEventProcessed(eventFingerprint: string): Promise<boolean> {
  if (!redisClient.isReady) return true;

  try {
    const result = await redisClient.set(
      expiryEventKey(eventFingerprint),
      'processed',
      { EX: 86400, NX: true },
    );
    return result === 'OK';
  } catch (error) {
    logger.warn({ err: error }, 'Expiry-event deduplication unavailable');
    return true;
  }
}