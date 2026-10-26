import { RequestHandler, Router } from 'express';
import { ROLE } from '../common/constants';
import { EmployeeController } from '../controllers/v1';
import { AuthorizationMiddleware, RequestValidationMiddleware } from '../middlewares';
import { AuthorizationService } from '../services';

export class EmployeeRoutes {
  static create(
    ctrl: EmployeeController,
    authenticate: RequestHandler,
    authz: AuthorizationService,
  ): Router {
    const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    AuthorizationMiddleware.requireRole(ROLE.ADMIN, ROLE.HR),
    AuthorizationMiddleware.requirePermission(authz, 'employee:create'),
    ctrl.create,
  );
  router.get('/', AuthorizationMiddleware.requirePermission(authz, 'employee:read'), ctrl.list);
  router.get('/me', AuthorizationMiddleware.requirePermission(authz, 'profile:read_own'), ctrl.getOwnProfile);
  router.patch('/me', AuthorizationMiddleware.requirePermission(authz, 'profile:update_own'), ctrl.updateOwnProfile);
  router.get(
    '/:id',
    AuthorizationMiddleware.requirePermission(authz, 'employee:read'),
    RequestValidationMiddleware.uuidParam('id'),
    ctrl.getById,
  );
  router.patch(
    '/:id',
    AuthorizationMiddleware.requirePermission(authz, 'employee:update'),
    RequestValidationMiddleware.uuidParam('id'),
    ctrl.update,
  );
  router.delete(
    '/:id',
    AuthorizationMiddleware.requirePermission(authz, 'employee:deactivate'),
    RequestValidationMiddleware.uuidParam('id'),
    ctrl.deactivate,
  );
    return router;
  }
}