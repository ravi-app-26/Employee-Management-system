import { Request, Response } from 'express';
import { DepartmentService } from '../../services';
import { ApiResponse } from '../../utils/api-response';
import { listDepartmentsQuerySchema } from '../../validators';

export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  create = async (req: Request, res: Response) => {
    ApiResponse.created(res, await this.service.create(req.body));
  };

  list = async (req: Request, res: Response) => {
    const query = listDepartmentsQuerySchema.parse(req.query);
    ApiResponse.ok(
      res,
      await this.service.list(query.page, query.limit, query.sortBy, query.order),
    );
  };

  update = async (req: Request, res: Response) => {
    ApiResponse.ok(res, await this.service.update(String(req.params.id), req.body));
  };
}