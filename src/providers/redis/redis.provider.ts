import { createClient } from 'redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { recordOperationalMetric } from './redis.metrics';

export const redisClient = createClient({
    url: env.REDIS_URL,
    disableOfflineQueue: true,
    socket: {
        connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
        socketTimeout: env.REDIS_SOCKET_TIMEOUT_MS,
        reconnectStrategy: (retries) => {
            if (retries >= env.REDIS_MAX_RECONNECT_RETRIES) return false;
            return Math.min(env.REDIS_RECONNECT_BASE_DELAY_MS * (2 ** retries), 5000);
        },
    },
});

export function withRedisKeyPrefix(key: string, namespace = env.REDIS_CACHE_KEY_PREFIX): string {
    return [env.REDIS_KEY_PREFIX, namespace, key].filter(Boolean).join(':');
}

redisClient.on('ready', () => recordOperationalMetric('redisConnectionsReady'));
redisClient.on('end', () => recordOperationalMetric('redisConnectionsEnded'));
redisClient.on('error', (error) => {
    recordOperationalMetric('redisConnectionErrors');
    logger.error({ errorName: error.name }, 'Redis Client Error');
});

export async function connectRedis(): Promise<void> {
    if (!redisClient.isOpen) await redisClient.connect();
}