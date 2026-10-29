import { app } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/database';
import { Server } from 'node:http';
import { activityLogService, employeeDocumentService, sessionAuditService, sessionExpiryEventService } from './container';
import { RetryPolicy } from './utils/retry-policy';
import { logger } from './config/logger';
import { connectRedis, redisClient } from './providers/redis/redis.provider';
import type { ScheduledTask } from 'node-cron';
import {
  startEmployeesWithoutPhoneCron,
  startHrActivityLogCron,
} from './providers/cron/hr-activity-log.cron';
import { startSessionReconciliationCron } from './providers/cron/session-reconciliation.cron';
import { SessionExpirySubscriber } from './providers/redis/session-expiry.subscriber';
import { startSessionAuditSummaryCron } from './providers/cron/session-audit-summary.cron';

export class ApplicationServer {
  private server?: Server;
  private activityLogCron?: ScheduledTask;
  private noPhoneActivityLogCron?: ScheduledTask;
  private sessionReconciliationCron?: ScheduledTask;
  private sessionAuditSummaryCron?: ScheduledTask;
  private readonly sessionExpirySubscriber = new SessionExpirySubscriber();
  private shuttingDown = false;

  async start(): Promise<void> {
    await this.initializeDatabase();
    try {
      await connectRedis();
      logger.info('Redis connected');
      await this.sessionExpirySubscriber.start(sessionExpiryEventService);
    } catch (error) {
      logger.warn({ err: error }, 'Redis unavailable; continuing without cache');
    }
    await employeeDocumentService.cleanupStoredObjects().catch((error: unknown) => {
      logger.warn({ err: error }, 'Document storage cleanup failed during startup');
    });
    logger.info('Database connected (TypeORM)');

    this.server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Server listening');
    });
    this.activityLogCron = startHrActivityLogCron(activityLogService);
    this.noPhoneActivityLogCron = startEmployeesWithoutPhoneCron(activityLogService);
    this.sessionReconciliationCron = startSessionReconciliationCron(
      sessionExpiryEventService,
      env.SESSION_RECONCILIATION_CRON,
    );
    this.sessionAuditSummaryCron = startSessionAuditSummaryCron(sessionAuditService);
    await sessionAuditService.generateDailySummaries(90).catch((error: unknown) => {
      logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Session audit summary catch-up failed');
    });
    process.once('SIGTERM', () => void this.shutdown());
    process.once('SIGINT', () => void this.shutdown());
  }

  private async initializeDatabase(): Promise<void> {
    await RetryPolicy.run(() => AppDataSource.initialize(), { attempts: 3, baseDelayMs: 250 });
  }

  private async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    const forceCloseTimer = setTimeout(() => {
      this.server?.closeAllConnections();
      process.exitCode = 1;
    }, 10000);
    forceCloseTimer.unref();

    try {
      this.activityLogCron?.stop();
      this.noPhoneActivityLogCron?.stop();
      this.sessionReconciliationCron?.stop();
      this.sessionAuditSummaryCron?.stop();
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => error ? reject(error) : resolve());
        });
      }
      await this.sessionExpirySubscriber.stop();
      if (redisClient.isOpen) await redisClient.quit();
      if (AppDataSource.isInitialized) await AppDataSource.destroy();
      process.exitCode = 0;
    } catch (error) {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exitCode = 1;
    } finally {
      clearTimeout(forceCloseTimer);
    }
  }
}

void new ApplicationServer().start().catch((error: unknown) => {
  logger.error({ err: error }, 'Server startup failed');
  process.exitCode = 1;
});