import { Router, RequestHandler } from 'express';
import { ROLE } from '../common/constants';
import { AuthController } from '../controllers/v1/auth.controller';
import { RequestValidationMiddleware } from '../middlewares/validate-request';
import { AuthorizationMiddleware } from '../middlewares/authorize';
import { AuthorizationService } from '../services/authorization.service';
import { RateLimitMiddleware } from '../middlewares/rate-limiter';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '../validators';
export class AuthRoutes {
  static create(
    ctrl: AuthController,
    authenticate: RequestHandler,
    authz: AuthorizationService,
  ): Router {
    const router = Router();
  router.post(
    '/register',
    authenticate,
    AuthorizationMiddleware.requireRole(ROLE.ADMIN, ROLE.HR),
    RequestValidationMiddleware.body(registerSchema),
    ctrl.register,
  );
  router.post('/login', RateLimitMiddleware.auth, RequestValidationMiddleware.body(loginSchema), ctrl.login);
  router.post('/refresh', RateLimitMiddleware.auth, ctrl.refresh);
  router.post('/logout', authenticate, ctrl.logout);
  router.post('/logout-all', authenticate, ctrl.logoutAll);
  router.get('/sessions', authenticate, ctrl.sessions);
  router.delete(
    '/sessions/:id',
    authenticate,
    RequestValidationMiddleware.uuidParam('id'),
    ctrl.revokeSession,
  );
  router.post(
    '/change-password',
    authenticate,
    RateLimitMiddleware.auth,
    RequestValidationMiddleware.body(changePasswordSchema),
    ctrl.changePassword,
  );

  // Sirf login hona chahiye
  router.get('/me', authenticate, ctrl.me);

  // Sirf admin
  router.get('/admin-only', authenticate, AuthorizationMiddleware.requireRole(ROLE.ADMIN), ctrl.me);

  // Permission wala check (admin aur hr ke paas employee:create hai)
  router.get(
    '/can-create-employee',
    authenticate,
    AuthorizationMiddleware.requirePermission(authz, 'employee:create'),
    ctrl.me,
  );

    return router;
  }
}