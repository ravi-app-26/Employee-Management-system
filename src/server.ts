import { app } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/database';
import { Server } from 'node:http';
import { employeeDocumentService } from './container';
import { RetryPolicy } from './utils/retry-policy';

export class ApplicationServer {
  private server?: Server;
  private shuttingDown = false;

  async start(): Promise<void> {
    await this.initializeDatabase();
    await employeeDocumentService.cleanupLocalFiles();
    console.log('Database connected (TypeORM)');

    this.server = app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
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
      console.error('Graceful shutdown failed:', error);
      process.exitCode = 1;
    } finally {
      clearTimeout(forceCloseTimer);
    }
  }
}

void new ApplicationServer().start().catch((error: unknown) => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});