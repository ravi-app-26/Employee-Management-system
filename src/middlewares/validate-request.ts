import { RequestHandler } from 'express';
import { ZodType } from 'zod';
import { BadRequestError } from '../errors/app-error';

export class RequestValidationMiddleware {
  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  static body(schema: ZodType): RequestHandler {
    return (req, _res, next) => {
      req.body = schema.parse(req.body);
      next();
    };
  }

  static uuidParam(name: string): RequestHandler {
    return (req, _res, next) => {
      if (!RequestValidationMiddleware.UUID_RE.test(String(req.params[name]))) {
        throw new BadRequestError(`Invalid ${name}`);
      }
      next();
    };
  }
}