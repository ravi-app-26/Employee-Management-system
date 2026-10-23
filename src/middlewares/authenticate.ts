import { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error';
import { AuthService } from '../services';

export class AuthenticationMiddleware {
  static create(authService: AuthService): RequestHandler {
    return async (req, _res, next) => {
      const header = req.headers.authorization;

      if (!header || !header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Authentication required');
      }

      const token = header.slice(7);
      const payload = authService.verifyAccessToken(token);
      if (!(await authService.isActive(payload.sub))) {
        throw new UnauthorizedError('Invalid or expired token');
      }

      req.user = {
        id: payload.sub,
        role: payload.role,
        employeeId: payload.employeeId,
      };
      next();
    };
  }
}