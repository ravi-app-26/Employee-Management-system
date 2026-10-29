import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('session_audit_daily_summaries')
export class SessionAuditDailySummary {
  @PrimaryColumn({ name: 'summary_date', type: 'date' })
  summaryDate!: string;

  @Column({ name: 'expired_sessions', type: 'bigint', default: 0 })
  expiredSessions!: string;

  @Column({ name: 'manually_revoked_sessions', type: 'bigint', default: 0 })
  manuallyRevokedSessions!: string;

  @Column({ name: 'refresh_token_reuse_detections', type: 'bigint', default: 0 })
  refreshTokenReuseDetections!: string;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'clock_timestamp()' })
  generatedAt!: Date;
}
