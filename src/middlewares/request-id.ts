import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';

export class RequestIdMiddleware {
  static handle: RequestHandler = (req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}