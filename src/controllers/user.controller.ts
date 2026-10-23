import { Request, Response } from 'express';
<<<<<<< Updated upstream
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/api-response';
import { assignRoleSchema } from '../validators/user.validator';
=======
import { UserService } from '../services';
import { ApiResponse } from '../utils/api-response';
import { assignRoleSchema } from '../validators';
>>>>>>> Stashed changes

export class UserController {
  constructor(private readonly service: UserService) {}

  assignRole = async (req: Request, res: Response) => {
    const { role } = assignRoleSchema.parse(req.body);
    const result = await this.service.assignRole(
      req.user!.id,
      String(req.params.id),
      role,
      req.id,
    );
    ApiResponse.ok(res, result);
  };

  revokeSessions = async (req: Request, res: Response) => {
    await this.service.revokeUserSessions(
      req.user!.id,
      String(req.params.id),
      req.id,
    );
    ApiResponse.noContent(res);
  };

  exportOwnProfile = async (req: Request, res: Response) => {
    ApiResponse.ok(
      res,
      await this.service.exportOwnProfile(req.user!.id, req.id),
    );
  };
}