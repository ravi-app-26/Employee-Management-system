import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { SessionExpiryEventService } from '../../services/session-expiry-event.service';
import { redisClient } from './redis.provider';

const REQUIRED_NOTIFICATION_FLAGS = ['E', 'x'];

export async function enableRedisExpiryNotifications(): Promise<boolean> {
  if (!redisClient.isReady) return false;

  try {
    const settings = await redisClient.configGet('notify-keyspace-events');
    const current = settings['notify-keyspace-events'] ?? '';
    const next = [...current];
    if (!current.includes('A')) {
      for (const flag of REQUIRED_NOTIFICATION_FLAGS) {
        if (!next.includes(flag)) next.push(flag);
      }
    }
    if (next.join('') !== current) {
      await redisClient.configSet('notify-keyspace-events', next.join(''));
    }
    return true;
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Redis expiry notifications could not be enabled; reconciliation remains active');
    return false;
  }
}

export class SessionExpirySubscriber {
  private subscriber?: ReturnType<typeof redisClient.duplicate>;

  async start(service: SessionExpiryEventService): Promise<boolean> {
    if (!(await enableRedisExpiryNotifications())) return false;

    try {
      const database = Number(new URL(env.REDIS_URL).pathname.slice(1) || 0);
      const channel = `__keyevent@${database}__:expired`;
      this.subscriber = redisClient.duplicate();
      this.subscriber.on('error', (error) => {
        logger.warn({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Redis expiry subscriber error');
      });
      await this.subscriber.connect();
      await this.subscriber.subscribe(channel, (key) => {
        void service.handleExpiredKey(key, new Date());
      });
      logger.info({ channel, outcome: 'subscribed' }, 'Redis expiry subscriber started');
      return true;
    } catch (error) {
      logger.warn({ errorName: error instanceof Error ? error.name : 'UnknownError', outcome: 'unavailable' }, 'Redis expiry subscriber could not start');
      if (this.subscriber?.isOpen) await this.subscriber.quit().catch(() => undefined);
      this.subscriber = undefined;
      return false;
    }
  }

  async stop(): Promise<void> {
    if (this.subscriber?.isOpen) {
      try {
        await this.subscriber.quit();
      } catch (error) {
        logger.warn({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Redis expiry subscriber shutdown failed');
      }
    }
    this.subscriber = undefined;
  }
}
