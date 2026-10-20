-- Up Migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE users
      ADD COLUMN first_name VARCHAR(80),
      ADD COLUMN last_name VARCHAR(80);

    UPDATE users u
    SET first_name = e.first_name,
        last_name = e.last_name
    FROM employees e
    WHERE e.id = u.employee_id;

    ALTER TABLE users
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name SET NOT NULL;

    ALTER TABLE users RENAME COLUMN email TO work_email;
  END IF;
END
$$;

DROP INDEX IF EXISTS idx_employees_first_name_trgm;
DROP INDEX IF EXISTS idx_employees_last_name_trgm;
DROP INDEX IF EXISTS idx_employees_work_email_trgm;
DROP INDEX IF EXISTS idx_employees_last_name;

CREATE INDEX IF NOT EXISTS idx_users_last_name ON users (last_name);
CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm ON users USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_work_email_trgm ON users USING gin (work_email gin_trgm_ops);

ALTER TABLE employees
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS work_email;

-- Down Migration
ALTER TABLE employees
  ADD COLUMN first_name VARCHAR(80),
  ADD COLUMN last_name VARCHAR(80),
  ADD COLUMN work_email VARCHAR(255);

UPDATE employees e
SET first_name = u.first_name,
    last_name = u.last_name,
    work_email = u.work_email
FROM users u
WHERE u.employee_id = e.id;

ALTER TABLE employees
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN work_email SET NOT NULL;

ALTER TABLE users
  RENAME COLUMN work_email TO email;

ALTER TABLE users
  DROP COLUMN first_name,
  DROP COLUMN last_name;

DROP INDEX IF EXISTS idx_users_work_email_trgm;
DROP INDEX IF EXISTS idx_users_last_name_trgm;
DROP INDEX IF EXISTS idx_users_first_name_trgm;
DROP INDEX IF EXISTS idx_users_last_name;

CREATE INDEX idx_employees_last_name ON employees (last_name);
CREATE INDEX idx_employees_first_name_trgm ON employees USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_employees_last_name_trgm ON employees USING gin (last_name gin_trgm_ops);
CREATE INDEX idx_employees_work_email_trgm ON employees USING gin (work_email gin_trgm_ops);