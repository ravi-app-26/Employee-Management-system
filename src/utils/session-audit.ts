import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { SessionAuditEventType } from '../entities/session-audit-event.entity';

export interface SessionAuditEntry {
  eventKey: string;
  userId: string | null;
  sessionId: string;
  eventType: SessionAuditEventType;
  correlationId?: string;
  occurredAt?: Date;
}

export async function insertSessionAuditEvent(
  manager: EntityManager,
  event: SessionAuditEntry,
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into('session_audit_events')
    .values({
      eventKey: event.eventKey,
      userId: event.userId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      correlationId: event.correlationId ?? randomUUID(),
      occurredAt: event.occurredAt ?? new Date(),
      processedAt: new Date(),
      processingStatus: 'PROCESSED',
    })
    .orIgnore()
    .execute();
}
