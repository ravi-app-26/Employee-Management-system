import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors/app-error';
import { MulterError } from '../providers/aws';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class ErrorHandlerMiddleware {
  static notFound: RequestHandler = (req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
  };

  static handle: ErrorRequestHandler = (err, req, res, _next) => {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown;

    if (err instanceof AppError) {
      status = err.statusCode;
      code = err.code;
      message = err.message;
      details = err.details;
    } else if (err instanceof ZodError) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Invalid request';
      details = err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    } else if (err?.code === '23505') {
      status = 409;
      code = 'CONFLICT';
      message = 'Resource already exists';
    } else if (err?.code === '23503') {
      status = 409;
      code = 'INVALID_REFERENCE';
      message = 'Referenced resource does not exist or is still in use';
    } else if (err?.code === '23514') {
      status = 400;
      code = 'CONSTRAINT_VIOLATION';
      message = 'Data violates a rule';
    } else if (err?.type === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Request body too large';
    } else if (err?.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Malformed JSON body';
    } else if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Uploaded file exceeds the size limit';
    } else if (err instanceof MulterError) {
      status = 400;
      code = 'INVALID_UPLOAD';
      message = 'Uploaded file is invalid';
    } else if ([
      'ETIMEDOUT', 'ERR_SOCKET_CONNECTION_TIMEOUT', 'ECONNREFUSED', 'ECONNRESET',
      'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', '57P01', '57P02', '57P03',
      '08000', '08001', '08003', '08006', '53300', '57014',
      'EACCES', 'EPERM', 'ENOSPC', 'EIO', 'EMFILE', 'ENFILE', 'ENOTDIR', 'EEXIST',
    ].includes(err?.code)) {
      status = 503;
      code = 'DEPENDENCY_UNAVAILABLE';
      message = 'A required service is temporarily unavailable';
    }

    if (status >= 500) {
      logger.error({ requestId: req.id, err }, 'Request failed');
    }

    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        details: env.NODE_ENV === 'production' && status >= 500 ? undefined : details,
        requestId: req.id,
      },
    });
  };
}