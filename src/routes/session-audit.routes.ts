import { RequestHandler, Router } from 'express';
import { ROLE } from '../common/constants';
import { SessionAuditController } from '../controllers/v1/session-audit.controller';
import { AuthorizationMiddleware } from '../middlewares/authorize';
import { AuthorizationService } from '../services/authorization.service';

export class SessionAuditRoutes {
  static create(
    controller: SessionAuditController,
    authenticate: RequestHandler,
    authz: AuthorizationService,
  ): Router {
    const router = Router();
    router.get('/auth/sessions/history', authenticate, controller.history);
    router.get(
      '/admin/session-metrics',
      authenticate,
      AuthorizationMiddleware.requireRole(ROLE.ADMIN),
      AuthorizationMiddleware.requirePermission(authz, 'audit:read'),
      controller.metrics,
    );
    return router;
  }
}
