-- Up Migration

-- ILIKE '%text%' search ke liye trigram support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Combined filter: department + status
CREATE INDEX idx_employees_dept_status ON employees (department_id, employment_status);

-- Sorting fields
CREATE INDEX idx_users_last_name ON users (last_name);
CREATE INDEX idx_employees_joining_date ON employees (joining_date);
CREATE INDEX idx_employees_created_at ON employees (created_at);

-- Search fields
CREATE INDEX idx_users_first_name_trgm ON users USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_users_last_name_trgm ON users USING gin (last_name gin_trgm_ops);
CREATE INDEX idx_users_work_email_trgm ON users USING gin (work_email gin_trgm_ops);

-- Down Migration

DROP INDEX IF EXISTS idx_users_work_email_trgm;
DROP INDEX IF EXISTS idx_users_last_name_trgm;
DROP INDEX IF EXISTS idx_users_first_name_trgm;
DROP INDEX IF EXISTS idx_employees_created_at;
DROP INDEX IF EXISTS idx_employees_joining_date;
DROP INDEX IF EXISTS idx_users_last_name;
DROP INDEX IF EXISTS idx_employees_dept_status;