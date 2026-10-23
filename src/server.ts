import { app } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/database';
import { Server } from 'node:http';
import { employeeDocumentService } from './container';
import { RetryPolicy } from './utils/retry-policy';
import { logger } from './config/logger';

export class ApplicationServer {
  private server?: Server;
  private shuttingDown = false;

  async start(): Promise<void> {
    await this.initializeDatabase();
    await employeeDocumentService.cleanupStoredObjects().catch((error: unknown) => {
      logger.warn({ err: error }, 'Document storage cleanup failed during startup');
    });
    logger.info('Database connected (TypeORM)');

    this.server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Server listening');
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
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => error ? reject(error) : resolve());
        });
      }
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