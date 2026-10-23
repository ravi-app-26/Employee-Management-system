import { RequestHandler, Router } from 'express';
<<<<<<< Updated upstream
import { UserController } from '../controllers/user.controller';
import { AuthorizationMiddleware } from '../middlewares/authorize';
import { RequestValidationMiddleware } from '../middlewares/validate-request';
import { AuthorizationService } from '../services/authorization.service';
import { assignRoleSchema } from '../validators/user.validator';
=======
import { UserController } from '../controllers';
import { AuthorizationMiddleware, RequestValidationMiddleware } from '../middlewares';
import { AuthorizationService } from '../services';
import { assignRoleSchema } from '../validators';
>>>>>>> Stashed changes

export class UserRoutes {
  static create(
    ctrl: UserController,
    authenticate: RequestHandler,
    authz: AuthorizationService,
  ): Router {
    const router = Router();
    router.use(authenticate);

    router.patch(
      '/users/:id/role',
      AuthorizationMiddleware.requireRole('admin'),
      AuthorizationMiddleware.requirePermission(authz, 'user:assign_role'),
      RequestValidationMiddleware.uuidParam('id'),
      RequestValidationMiddleware.body(assignRoleSchema),
      ctrl.assignRole,
    );
    router.post(
      '/users/:id/sessions/revoke',
      AuthorizationMiddleware.requirePermission(authz, 'session:revoke_any'),
      RequestValidationMiddleware.uuidParam('id'),
      ctrl.revokeSessions,
    );
    router.get(
      '/me/export',
      AuthorizationMiddleware.requirePermission(authz, 'profile:export_own'),
      ctrl.exportOwnProfile,
    );

    return router;
  }
}