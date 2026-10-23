import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { RateLimitError } from '../errors/app-error';

export class RateLimitMiddleware {
  static readonly handle = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    skip: (req) => req.path === '/health' || req.path.startsWith('/health/'),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });

  static readonly auth = rateLimit({
    windowMs: 60_000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });
}