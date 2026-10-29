import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { redisClient, withRedisKeyPrefix } from './redis.provider';
import { recordOperationalMetric } from './redis.metrics';

const VERSION_KEY = withRedisKeyPrefix('department:list:version');

interface DepartmentListQuery {
  page: number;
  limit: number;
  sortBy: string;
  order: string;
}

function listKey(version: string, query: DepartmentListQuery): string {
  return withRedisKeyPrefix(`department:list:${version}:${query.page}:${query.limit}:${query.sortBy}:${query.order}`);
}

export async function getDepartmentListCache(
  query: DepartmentListQuery,
): Promise<{ version: string | null; value: unknown | null }> {
  if (!redisClient.isReady) {
    recordOperationalMetric('redisUnavailableFallbacks');
    recordOperationalMetric('redisCacheMisses');
    return { version: null, value: null };
  }

  try {
    const version = (await redisClient.get(VERSION_KEY)) ?? '0';
    const cached = await redisClient.get(listKey(version, query));
    recordOperationalMetric(cached ? 'redisCacheHits' : 'redisCacheMisses');
    return { version, value: cached ? JSON.parse(cached) : null };
  } catch (error) {
    recordOperationalMetric('redisCacheMisses');
    logger.warn({ err: error }, 'Department Redis cache lookup failed');
    return { version: null, value: null };
  }
}

export async function storeDepartmentListCache(
  version: string | null,
  query: DepartmentListQuery,
  value: unknown,
): Promise<void> {
  if (!redisClient.isReady || version === null) return;

  try {
    await redisClient.set(listKey(version, query), JSON.stringify(value), {
      EX: env.DEPARTMENT_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Department Redis cache write failed');
  }
}

export async function invalidateDepartmentListCache(): Promise<void> {
  if (!redisClient.isReady) return;

  try {
    await redisClient.incr(VERSION_KEY);
  } catch (error) {
    logger.warn({ err: error }, 'Department Redis cache invalidation failed');
  }
}