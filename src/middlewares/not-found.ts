import { RequestHandler } from 'express';
import { NotFoundError } from '../errors/app-error';

export class NotFoundMiddleware {
  static handle: RequestHandler = (req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
  };
}