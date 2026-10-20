import { RequestHandler, Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';
import { AuthorizationMiddleware } from '../middlewares/authorize';
import { RequestValidationMiddleware } from '../middlewares/validate-request';
import { AuthorizationService } from '../services/authorization.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/department.validator';

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