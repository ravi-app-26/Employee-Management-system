import { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { AuthorizationService } from '../services/authorization.service';

export class AuthorizationMiddleware {
  static requireRole(...roles: string[]): RequestHandler {
    return (req, _res, next) => {
      if (!req.user) throw new UnauthorizedError('Authentication required');
      if (!roles.includes(req.user.role)) throw new ForbiddenError('Access denied');
      next();
    };
  }

  static requirePermission(authz: AuthorizationService, permission: string): RequestHandler {
    return async (req, _res, next) => {
      if (!req.user) throw new UnauthorizedError('Authentication required');

      const allowed = await authz.hasPermission(req.user.id, permission);
      if (!allowed) throw new ForbiddenError('Access denied');
      next();
    };
  }
}