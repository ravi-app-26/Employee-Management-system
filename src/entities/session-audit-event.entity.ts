import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const SESSION_AUDIT_EVENT_TYPES = [
  'SESSION_CREATED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'LOGOUT',
  'REFRESH_TOKEN_REUSE_DETECTED',
] as const;

export type SessionAuditEventType = (typeof SESSION_AUDIT_EVENT_TYPES)[number];

@Entity('session_audit_events')
@Index('uq_session_audit_event_key', ['eventKey'], { unique: true })
@Index('idx_session_audit_user_time', ['userId', 'occurredAt'])
export class SessionAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_key', type: 'varchar', length: 180, unique: true })
  eventKey!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType!: SessionAuditEventType;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'clock_timestamp()' })
  occurredAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'clock_timestamp()' })
  processedAt!: Date;

  @Column({ name: 'processing_status', type: 'varchar', length: 20, default: 'PROCESSED' })
  processingStatus!: 'PROCESSED';

  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlationId!: string | null;
}
