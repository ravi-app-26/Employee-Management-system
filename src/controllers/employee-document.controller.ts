import { NextFunction, Request, Response } from 'express';
import { EmployeeDocumentService } from '../services';
import { ApiResponse } from '../utils/api-response';

export class EmployeeDocumentController {
    authorizeUpload = async (req: Request, _res: Response, next: NextFunction) => {
      await this.service.assertCanWrite(String(req.params.id), req.user!);
      next();
    };

  constructor(private readonly service: EmployeeDocumentService) {}

  upload = async (req: Request, res: Response) => {
    ApiResponse.created(res, await this.service.upload(
      String(req.params.id), req.file, req.user!, req.id,
    ));
  };

  list = async (req: Request, res: Response) => {
    ApiResponse.ok(res, await this.service.list(String(req.params.id), req.user!));
  };

  downloadUrl = async (req: Request, res: Response) => {
    ApiResponse.ok(res, await this.service.createDownloadUrl(String(req.params.id), req.user!, req.id));
  };

  remove = async (req: Request, res: Response) => {
    await this.service.remove(String(req.params.id), req.user!, req.id);
    ApiResponse.noContent(res);
  };
}
