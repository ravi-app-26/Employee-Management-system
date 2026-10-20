import { Response } from 'express';

export class ApiResponse {
  static ok<T>(res: Response, data: T, status = 200) {
    return res.status(status).json({ success: true, data, requestId: res.req.id });
  }

  static created<T>(res: Response, data: T) {
    return ApiResponse.ok(res, data, 201);
  }

  static noContent(res: Response) {
    return res.status(204).send();
  }
}