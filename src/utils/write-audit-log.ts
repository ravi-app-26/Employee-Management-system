import { EntityManager } from 'typeorm';
<<<<<<< Updated upstream
import { AuditLog } from '../entities/audit-log.entity';
=======
import { AuditLog } from '../entities';
>>>>>>> Stashed changes

export interface AuditEntry {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
}

export function writeAuditLog(manager: EntityManager, entry: AuditEntry): Promise<unknown> {
  return manager.insert(AuditLog, {
    ...entry,
    timestamp: new Date(),
  });
}