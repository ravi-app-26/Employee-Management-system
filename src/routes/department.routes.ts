import { RequestHandler, Router } from 'express';
import { DepartmentController } from '../controllers/v1';
import { AuthorizationMiddleware, RequestValidationMiddleware } from '../middlewares';
import { AuthorizationService } from '../services';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators';

export class DepartmentRoutes {
  static create(
    ctrl: DepartmentController,
    authenticate: RequestHandler,
    authz: AuthorizationService,
  ): Router {
    const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    AuthorizationMiddleware.requirePermission(authz, 'department:create'),
    RequestValidationMiddleware.body(createDepartmentSchema),
    ctrl.create,
  );
  router.get('/', AuthorizationMiddleware.requirePermission(authz, 'department:read'), ctrl.list);
  router.patch(
    '/:id',
    AuthorizationMiddleware.requirePermission(authz, 'department:update'),
    RequestValidationMiddleware.uuidParam('id'),
    RequestValidationMiddleware.body(updateDepartmentSchema),
    ctrl.update,
  );

    return router;
  }
}