export type RedisOperationalMetric =
  | 'redisConnectionsReady'
  | 'redisConnectionsEnded'
  | 'redisConnectionErrors'
  | 'redisCacheHits'
  | 'redisCacheMisses'
  | 'redisUnavailableFallbacks'
  | 'expiryEventsReceived'
  | 'expiryEventsProcessed'
  | 'expiryEventsDuplicate'
  | 'expiryEventsFailed'
  | 'sessionReconciliationRuns'
  | 'sessionReconciliationFailures';

const counters: Record<RedisOperationalMetric, number> = {
  redisConnectionsReady: 0,
  redisConnectionsEnded: 0,
  redisConnectionErrors: 0,
  redisCacheHits: 0,
  redisCacheMisses: 0,
  redisUnavailableFallbacks: 0,
  expiryEventsReceived: 0,
  expiryEventsProcessed: 0,
  expiryEventsDuplicate: 0,
  expiryEventsFailed: 0,
  sessionReconciliationRuns: 0,
  sessionReconciliationFailures: 0,
};

export function recordOperationalMetric(metric: RedisOperationalMetric, amount = 1): void {
  counters[metric] += amount;
}

export function getOperationalMetrics(): Readonly<Record<RedisOperationalMetric, number>> {
  return { ...counters };
}
