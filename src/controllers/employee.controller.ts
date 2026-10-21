import { Request, Response } from 'express';
import { EmployeeService } from '../services/employee.service';
import { ApiResponse } from '../utils/api-response';
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
  updateOwnEmployeeProfileSchema,
  updateTeamMemberSchema,
} from '../validators/employee.validator';

export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  list = async (req: Request, res: Response) => {
    const filters = listEmployeesQuerySchema.parse(req.query);
    ApiResponse.ok(res, await this.service.list(filters, req.user!));
  };

  create = async (req: Request, res: Response) => {
    const input = createEmployeeSchema.parse(req.body);
    ApiResponse.created(res, await this.service.create(input));
  };

  getById = async (req: Request, res: Response) => {
    ApiResponse.ok(
      res,
      await this.service.getById(String(req.params.id), req.user!),
    );
  };

  update = async (req: Request, res: Response) => {
    const input = req.user!.role === 'manager'
      ? updateTeamMemberSchema.parse(req.body)
      : updateEmployeeSchema.parse(req.body);
    ApiResponse.ok(
      res,
      await this.service.update(String(req.params.id), input, req.user!),
    );
  };

  deactivate = async (req: Request, res: Response) => {
    await this.service.deactivate(String(req.params.id), req.user!);
    ApiResponse.noContent(res);
  };

  getOwnProfile = async (req: Request, res: Response) => {
    ApiResponse.ok(res, await this.service.getOwnProfile(req.user!));
  };

  updateOwnProfile = async (req: Request, res: Response) => {
    const input = updateOwnEmployeeProfileSchema.parse(req.body);
    ApiResponse.ok(res, await this.service.updateOwnProfile(req.user!, input));
  };
}