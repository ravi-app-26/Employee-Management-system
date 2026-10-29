import { NextFunction, RequestHandler } from 'express';
import { AppDataSource } from '../../config/database';
import { ServiceUnavailableError } from '../../errors/app-error';
import { redisClient } from '../../providers/redis/redis.provider';
import { getOperationalMetrics } from '../../providers/redis/redis.metrics';

export class HealthController {
  static handle: RequestHandler = (_req, res) => {
    res.json({ status: 'ok' });
  };

  static live: RequestHandler = (_req, res) => {
    res.json({ status: 'live' });
  };

  static ready: RequestHandler = async (_req, res, next: NextFunction) => {
    try {
      await AppDataSource.query('SELECT 1');
      res.json({
        status: 'ready',
        dependencies: {
          postgres: 'ready',
          redis: redisClient.isReady ? 'ready' : 'degraded',
        },
      });
    } catch {
      next(new ServiceUnavailableError('Application is not ready'));
    }
  };

  static metrics: RequestHandler = (_req, res) => {
    res.json({
      redis: {
        status: redisClient.isReady ? 'ready' : 'degraded',
        ...getOperationalMetrics(),
      },
    });
  };
}