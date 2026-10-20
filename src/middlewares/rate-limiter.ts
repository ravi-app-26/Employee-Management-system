import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { RateLimitError } from '../errors/app-error';

export class RateLimitMiddleware {
  static readonly handle = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });
}