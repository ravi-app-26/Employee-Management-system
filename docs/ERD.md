# Entity Relationship Diagram

This diagram reflects the current PostgreSQL migrations. Names and work email are in `users`, not `employees`. Document bytes are stored on local disk; only metadata is in `employee_documents`.

```mermaid
erDiagram
  ROLES ||--o{ USERS : assigns
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : contains
  DEPARTMENTS ||--o{ EMPLOYEES : contains
  EMPLOYEES o|--o{ EMPLOYEES : manages
  EMPLOYEES ||--o| USERS : login_identity
  USERS ||--o{ REFRESH_TOKENS : owns
  USERS o|--o{ AUDIT_LOGS : performs
  USERS o|--o{ EMPLOYEE_DOCUMENTS : uploads
  EMPLOYEES ||--o{ EMPLOYEE_DOCUMENTS : has

  ROLES {
    int id PK
    varchar name UK
    text description
  }
  PERMISSIONS {
    int id PK
    varchar name UK
    text description
  }
  ROLE_PERMISSIONS {
    int role_id PK,FK
    int permission_id PK,FK
  }
  DEPARTMENTS {
    uuid id PK
    varchar name UK
    text description
    timestamptz created_at
    timestamptz updated_at
  }
  EMPLOYEES {
    uuid id PK
    varchar phone "nullable"
    uuid department_id FK
    uuid manager_id FK "nullable, self reference"
    varchar job_title
    date joining_date
    varchar employment_status
    timestamptz created_at
    timestamptz updated_at
  }
  USERS {
    uuid id PK
    varchar first_name
    varchar last_name
    varchar work_email UK
    varchar password_hash "select false"
    int role_id FK
    uuid employee_id FK,UK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    char token_hash UK
    uuid family_id
    timestamptz expires_at
    timestamptz revoked_at "nullable"
    timestamptz created_at
  }
  AUDIT_LOGS {
    uuid id PK
    uuid actor_user_id FK "nullable"
    varchar action
    varchar resource_type
    varchar resource_id "nullable"
    timestamptz timestamp
    varchar request_id "nullable"
  }
  EMPLOYEE_DOCUMENTS {
    uuid id PK
    uuid employee_id FK
    varchar original_name
    varchar mime_type
    bigint size_bytes
    varchar object_key UK "select false"
    uuid uploaded_by FK "nullable"
    timestamptz created_at
    timestamptz deleted_at "nullable"
  }
```

## Constraints And Notes

- UUIDs are used for department, employee, user, token, audit, and document IDs; role and permission IDs are serial integers.
- User work email is unique case-insensitively. `employee_id` is unique in users, enforcing at most one account per employee.
- Employee department and user role/employee references are foreign keys. Manager is a nullable self-reference with `ON DELETE SET NULL`.
- Employment status is constrained to `active`, `inactive`, or `on_leave`; an employee cannot manage themself.
- Refresh token hash is unique; raw refresh tokens are not persisted.
- Audit actor and document uploader references become null when the user is deleted; audit logs have no retention/deletion job in this codebase.
