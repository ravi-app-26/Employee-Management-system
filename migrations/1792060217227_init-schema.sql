-- Up Migration
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Roles
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(30) NOT NULL UNIQUE,
  description TEXT
);

-- 2. Permissions
CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60) NOT NULL UNIQUE,
  description TEXT
);

-- 3. Role <-> Permission mapping
CREATE TABLE role_permissions (
  role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Departments
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Employees
CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             VARCHAR(30),
  department_id     UUID NOT NULL REFERENCES departments(id),
  manager_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  job_title         VARCHAR(100) NOT NULL,
  joining_date      DATE NOT NULL,
  employment_status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_employment_status
    CHECK (employment_status IN ('active', 'inactive', 'on_leave')),
  CONSTRAINT chk_not_own_manager
    CHECK (manager_id IS NULL OR manager_id <> id)
);

CREATE INDEX idx_employees_department_id ON employees (department_id);
CREATE INDEX idx_employees_manager_id ON employees (manager_id);
CREATE INDEX idx_employees_status ON employees (employment_status);

-- 6. Users (login accounts)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    VARCHAR(80) NOT NULL,
  last_name     VARCHAR(80) NOT NULL,
  work_email    VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role_id       INT NOT NULL REFERENCES roles(id),
  employee_id   UUID NOT NULL UNIQUE REFERENCES employees(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_work_email_lower ON users (LOWER(work_email));
CREATE INDEX idx_users_role_id ON users (role_id);

-- 7. Refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  family_id   UUID NOT NULL,--revoked token se access nahi milta, lekin uska dobara aana ek alarm hai.
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens (family_id);

-- 8. Audit logs
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(80) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id   VARCHAR(64),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id    VARCHAR(64)
);

CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp);

-- Down Migration

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;