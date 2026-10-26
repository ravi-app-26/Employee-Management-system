import { EntityManager } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import type { AuditEntry } from '../interfaces';

export function writeAuditLog(manager: EntityManager, entry: AuditEntry): Promise<unknown> {
  return manager.insert(AuditLog, {
    ...entry,
    timestamp: new Date(),
  });
}