import { logger } from '../../config/logger';
import { sessionKey } from './session-cache.keys';
import { redisClient } from './redis.provider';
import { recordOperationalMetric } from './redis.metrics';

export async function storeSessionId(
  sessionId: string,
  expiresAt: Date,
): Promise<void> {
  if (!redisClient.isReady) return;

  const ttlSeconds = Math.floor(
    (expiresAt.getTime() - Date.now()) / 1000,
  );

  if (ttlSeconds <= 0) return;

  try {
    await redisClient.set(sessionKey(sessionId), '1', {
      EX: ttlSeconds,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Session Redis write failed');
  }
}

export async function hasSessionId(sessionId: string): Promise<boolean> {
  if (!redisClient.isReady) {
    recordOperationalMetric('redisUnavailableFallbacks');
    return false;
  }

  try {

    const present = (await redisClient.get(sessionKey(sessionId))) === '1';
    recordOperationalMetric(present ? 'redisCacheHits' : 'redisCacheMisses');
    return present;
  } catch (error) {
    recordOperationalMetric('redisCacheMisses');
    logger.warn({ err: error }, 'Session Redis lookup failed');
    return false;
  }
}

export async function deleteSessionId(sessionId: string): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.del(sessionKey(sessionId));
  } catch (error) {
    logger.warn({ err: error }, 'Session Redis delete failed');
  }
}