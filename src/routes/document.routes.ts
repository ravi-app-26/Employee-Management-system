import { RequestHandler, Router } from 'express';
import { EmployeeDocumentController } from '../controllers';
import { AuthorizationMiddleware } from '../middlewares';
import { AuthorizationService } from '../services';
import { RequestValidationMiddleware } from '../middlewares';

export class DocumentRoutes {
  static create(controller: EmployeeDocumentController, authenticate: RequestHandler, authz: AuthorizationService): Router {
    const router = Router();
    router.use(authenticate);
    router.get(
      '/:id/download-url',
      RequestValidationMiddleware.uuidParam('id'),
      AuthorizationMiddleware.requirePermission(authz, 'document:read'),
      controller.downloadUrl,
    );
    router.delete(
      '/:id',
      RequestValidationMiddleware.uuidParam('id'),
      AuthorizationMiddleware.requirePermission(authz, 'document:delete'),
      controller.remove,
    );
    return router;
  }
}
