-- Up Migration
ALTER TABLE employee_documents
  ADD CONSTRAINT uq_employee_documents_id_employee UNIQUE (id, employee_id);

CREATE TABLE employee_document_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  sha256_hash CHAR(64) NOT NULL CHECK (sha256_hash ~ '^[0-9a-f]{64}$'),
  s3_object_key VARCHAR(512) NOT NULL UNIQUE,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  upload_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploading', 'available', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_document_storage_employee_sha256 UNIQUE (employee_id, sha256_hash),
  CONSTRAINT fk_employee_document_storage_document_employee
    FOREIGN KEY (document_id, employee_id)
    REFERENCES employee_documents (id, employee_id) ON DELETE CASCADE,
  CONSTRAINT uq_employee_document_storage_document_id UNIQUE (document_id),
  CONSTRAINT employee_document_storage_availability_check
    CHECK (is_available = (upload_status = 'available'))
);

CREATE INDEX idx_employee_document_storage_employee
  ON employee_document_storage (employee_id);
CREATE INDEX idx_employee_document_storage_unavailable
  ON employee_document_storage (updated_at)
  WHERE is_available = FALSE;

-- Down Migration
DROP TABLE IF EXISTS employee_document_storage;
ALTER TABLE employee_documents
  DROP CONSTRAINT IF EXISTS uq_employee_documents_id_employee;