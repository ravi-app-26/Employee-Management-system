import { RequestHandler, Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller';
import { AuthorizationMiddleware } from '../middlewares/authorize';
import { RequestValidationMiddleware } from '../middlewares/validate-request';
import { AuthorizationService } from '../services/authorization.service';

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
    AuthorizationMiddleware.requireRole('admin', 'hr'),
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