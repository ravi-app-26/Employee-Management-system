import { RequestHandler, Router } from 'express';
import { EmployeeDocumentController } from '../controllers/employee-document.controller';
import { RequestValidationMiddleware } from '../middlewares/validate-request';

export class DocumentRoutes {
  static create(controller: EmployeeDocumentController, authenticate: RequestHandler): Router {
    const router = Router();
    router.get('/:id/download', RequestValidationMiddleware.uuidParam('id'), controller.download);
    router.use(authenticate);
    router.get('/:id/download-url', RequestValidationMiddleware.uuidParam('id'), controller.downloadUrl);
    router.delete('/:id', RequestValidationMiddleware.uuidParam('id'), controller.remove);
    return router;
  }
}
