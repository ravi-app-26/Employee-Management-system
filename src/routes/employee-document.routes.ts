import { RequestHandler, Router } from 'express';
import { EmployeeDocumentController } from '../controllers';
import { documentUpload } from '../storage';
import { RequestValidationMiddleware } from '../middlewares';
import { AuthorizationMiddleware } from '../middlewares';
import { AuthorizationService } from '../services';

export class EmployeeDocumentRoutes {
  static create(controller: EmployeeDocumentController, authenticate: RequestHandler, authz: AuthorizationService): Router {
    const router = Router();
    router.use(authenticate);
    router.post(
      '/:id/documents',
      RequestValidationMiddleware.uuidParam('id'),//check uuid param ie valid or not 
      AuthorizationMiddleware.requirePermission(authz, 'document:upload'),
      controller.authorizeUpload,
      documentUpload.single('file'),//multer middleware to handle file upload
      controller.upload,
    );
    router.get(
      '/:id/documents',
      RequestValidationMiddleware.uuidParam('id'),
      AuthorizationMiddleware.requirePermission(authz, 'document:read'),
      controller.list,
    );
    return router;
  }
}
