import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { redisClient, withRedisKeyPrefix } from './redis.provider';
import { recordOperationalMetric } from './redis.metrics';

function permissionKey(userId: string): string {
  return withRedisKeyPrefix(`user-permissions:${userId}`);
}

export async function getCachedPermissionNames(userId: string): Promise<string[] | null> {
  if (!redisClient.isReady) {
    recordOperationalMetric('redisUnavailableFallbacks');
    recordOperationalMetric('redisCacheMisses');
    return null;
  }

  try {
    const value = await redisClient.get(permissionKey(userId));
    if (value === null) {
      recordOperationalMetric('redisCacheMisses');
      return null;
    }

    const permissions: unknown = JSON.parse(value);
    if (!Array.isArray(permissions) || !permissions.every((permission) => typeof permission === 'string')) {
      recordOperationalMetric('redisCacheMisses');
      return null;
    }
    recordOperationalMetric('redisCacheHits');
    return permissions;
  } catch (error) {
    recordOperationalMetric('redisCacheMisses');
    logger.warn({ err: error }, 'Permission Redis cache lookup failed');
    return null;
  }
}

export async function storeCachedPermissionNames(
  userId: string,
  permissions: string[],
): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.set(permissionKey(userId), JSON.stringify(permissions), {
      EX: env.PERMISSION_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Permission Redis cache write failed');
  }
}

export async function invalidateCachedPermissionNames(userId: string): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.del(permissionKey(userId));
  } catch (error) {
    logger.warn({ err: error }, 'Permission Redis cache invalidation failed');
  }
}