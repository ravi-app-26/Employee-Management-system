-- Up Migration
ALTER TABLE employee_documents
  ADD COLUMN upload_status VARCHAR(20) NOT NULL DEFAULT 'completed',
  ADD COLUMN upload_expires_at TIMESTAMPTZ;

ALTER TABLE employee_documents
  ADD CONSTRAINT employee_documents_upload_status_check
    CHECK (upload_status IN ('pending', 'completed'));

CREATE INDEX idx_employee_documents_pending_uploads
  ON employee_documents (upload_expires_at)
  WHERE upload_status = 'pending';

-- Down Migration
DROP INDEX IF EXISTS idx_employee_documents_pending_uploads;
ALTER TABLE employee_documents
  DROP CONSTRAINT IF EXISTS employee_documents_upload_status_check,
  DROP COLUMN IF EXISTS upload_expires_at,
  DROP COLUMN IF EXISTS upload_status;