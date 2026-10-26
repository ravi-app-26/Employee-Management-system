import { NextFunction, RequestHandler } from 'express';
import { AppDataSource } from '../../config/database';
import { ServiceUnavailableError } from '../../errors/app-error';

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
      res.json({ status: 'ready' });
    } catch {
      next(new ServiceUnavailableError('Application is not ready'));
    }
  };
}