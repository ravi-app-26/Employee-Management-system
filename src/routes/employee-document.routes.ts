import { RequestHandler, Router } from 'express';
import { EmployeeDocumentController } from '../controllers/employee-document.controller';
import { LocalDocumentStorage } from '../services/document-storage';
import { RequestValidationMiddleware } from '../middlewares/validate-request';

export class EmployeeDocumentRoutes {
  static create(controller: EmployeeDocumentController, authenticate: RequestHandler): Router {
    const router = Router();
    router.use(authenticate);
    router.post(
      '/:id/documents',
      RequestValidationMiddleware.uuidParam('id'),
      controller.authorizeUpload,
      LocalDocumentStorage.upload.single('file'),
      LocalDocumentStorage.securePermissions,
      controller.upload,
    );
    router.get('/:id/documents', RequestValidationMiddleware.uuidParam('id'), controller.list);
    return router;
  }
}
