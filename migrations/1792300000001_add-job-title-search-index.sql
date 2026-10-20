-- Up Migration
CREATE INDEX IF NOT EXISTS idx_employees_job_title_trgm
  ON employees USING gin (job_title gin_trgm_ops);

-- Down Migration
DROP INDEX IF EXISTS idx_employees_job_title_trgm;
