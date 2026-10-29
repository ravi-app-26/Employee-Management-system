-- Up Migration
CREATE TABLE session_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(180) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN (
    'SESSION_CREATED',
    'SESSION_EXPIRED',
    'SESSION_REVOKED',
    'LOGOUT',
    'REFRESH_TOKEN_REUSE_DETECTED'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED'
    CHECK (processing_status IN ('PROCESSED')),
  correlation_id VARCHAR(64)
);

CREATE INDEX idx_session_audit_user_time
  ON session_audit_events (user_id, occurred_at DESC);
CREATE INDEX idx_session_audit_type_time
  ON session_audit_events (event_type, occurred_at DESC);
CREATE INDEX idx_session_audit_session
  ON session_audit_events (session_id, occurred_at DESC);

CREATE TABLE session_audit_daily_summaries (
  summary_date DATE PRIMARY KEY,
  expired_sessions BIGINT NOT NULL DEFAULT 0,
  manually_revoked_sessions BIGINT NOT NULL DEFAULT 0,
  refresh_token_reuse_detections BIGINT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Down Migration
DROP TABLE IF EXISTS session_audit_daily_summaries;
DROP TABLE IF EXISTS session_audit_events;
