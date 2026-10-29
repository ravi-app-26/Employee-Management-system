import cron from 'node-cron';
import { logger } from '../../config/logger';
import { SessionExpiryEventService } from '../../services/session-expiry-event.service';
import { recordOperationalMetric } from '../redis/redis.metrics';

export function startSessionReconciliationCron(service: SessionExpiryEventService, expression: string) {
  return cron.schedule(expression, async () => {
    try {
      await service.reconcileStaleSessions();
    } catch (error) {
      recordOperationalMetric('sessionReconciliationFailures');
      logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError', outcome: 'failed' }, 'Session cache reconciliation failed');
    }
  });
}