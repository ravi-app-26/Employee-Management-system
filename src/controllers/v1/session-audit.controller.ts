import { Request, Response } from 'express';
import { SessionAuditService } from '../../services/session-audit.service';
import { ApiResponse } from '../../utils/api-response';

export class SessionAuditController {
  constructor(private readonly service: SessionAuditService) {}

  history = async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(parsedLimit) ? parsedLimit : 50;
    ApiResponse.ok(res, await this.service.history(req.user!.id, limit));
  };

  metrics = async (req: Request, res: Response) => {
    const parsedDays = Number(req.query.days ?? 30);
    const days = Number.isInteger(parsedDays) ? parsedDays : 30;
    ApiResponse.ok(res, await this.service.metrics(days));
  };
}
