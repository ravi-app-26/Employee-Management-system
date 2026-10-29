import { DataSource } from 'typeorm';
import { SessionAuditEvent } from '../entities/session-audit-event.entity';

export class SessionAuditService {
  constructor(private readonly dataSource: DataSource) {}

  async history(userId: string, limit = 50) {
    const rows = await this.dataSource.getRepository(SessionAuditEvent).find({
      where: { userId },
      select: {
        id: true,
        sessionId: true,
        eventType: true,
        occurredAt: true,
        processingStatus: true,
        correlationId: true,
      },
      order: { occurredAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows;
  }

  async generateDailySummaries(daysBack = 90): Promise<number> {
    const days = Math.min(Math.max(daysBack, 1), 366);
    await this.dataSource.query(
      `WITH days AS (
         SELECT generate_series(current_date - $1::int, current_date - 1, interval '1 day')::date AS summary_date
       ), counts AS (
         SELECT days.summary_date,
           COUNT(events.id) FILTER (WHERE events.event_type = 'SESSION_EXPIRED') AS expired_sessions,
           COUNT(events.id) FILTER (WHERE events.event_type IN ('SESSION_REVOKED', 'LOGOUT')) AS manually_revoked_sessions,
           COUNT(events.id) FILTER (WHERE events.event_type = 'REFRESH_TOKEN_REUSE_DETECTED') AS refresh_token_reuse_detections
         FROM days
         LEFT JOIN session_audit_events events
           ON events.occurred_at >= days.summary_date
          AND events.occurred_at < days.summary_date + interval '1 day'
         GROUP BY days.summary_date
       )
       INSERT INTO session_audit_daily_summaries
         (summary_date, expired_sessions, manually_revoked_sessions, refresh_token_reuse_detections, generated_at)
       SELECT summary_date, expired_sessions, manually_revoked_sessions, refresh_token_reuse_detections, clock_timestamp()
       FROM counts
       ON CONFLICT (summary_date) DO UPDATE SET
         expired_sessions = EXCLUDED.expired_sessions,
         manually_revoked_sessions = EXCLUDED.manually_revoked_sessions,
         refresh_token_reuse_detections = EXCLUDED.refresh_token_reuse_detections,
         generated_at = EXCLUDED.generated_at`,
      [days],
    );
    return days;
  }

  async metrics(days = 30) {
    const windowDays = Math.min(Math.max(days, 1), 90);
    await this.generateDailySummaries(windowDays);
    return this.dataSource.query(
      `SELECT summary_date AS "date",
              expired_sessions AS "expiredSessions",
              manually_revoked_sessions AS "manuallyRevokedSessions",
              refresh_token_reuse_detections AS "refreshTokenReuseDetections",
              generated_at AS "generatedAt"
       FROM session_audit_daily_summaries
       WHERE summary_date >= current_date - ($1::int - 1)
         AND summary_date < current_date
       ORDER BY summary_date DESC`,
      [windowDays],
    );
  }
}
