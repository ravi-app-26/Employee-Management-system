# Personal Data Inventory

This inventory describes fields present in current code/schema. Retention periods are included only where code/config implements them. `Not configured` means the repository does not enforce an expiry/deletion schedule; an organization must define and approve one.

| Data | Stored where | Purpose in code | Access path / role scope | Retention/deletion behavior |
|---|---|---|---|---|
| First/last name | `users.first_name`, `users.last_name` | Display identity; employee directory and profile | Employee DTOs; admins/HR and scoped managers for directory/detail; own profile for employee | No employee-record retention/deletion job. Deactivation retains data. |
| Work email | `users.work_email` | Login identifier and work contact; unique case-insensitively | Login lookup and employee DTO; same employee access scope | No expiry job; account deactivation does not erase it. |
| Password hash | `users.password_hash` | Verify login/change-password credentials | Explicitly selected only in auth repository password operations; excluded from normal selection and DTOs | Replaced on password change; account deletion policy not implemented. Hash uses bcrypt configured by `BCRYPT_ROUNDS`. |
| Phone | `employees.phone` | Optional work contact | Employee DTO; own profile can update it; privileged employee detail/update as permitted | No retention/deletion policy. |
| Department | `employees.department_id`, `departments` | Organization and reporting context | Employee/department APIs under permissions | No personal-data-specific expiry. |
| Manager relationship | `employees.manager_id` | Reporting scope and manager authorization | Employee access checks; manager sees self/direct reports | Nullable FK becomes null if manager row deleted; API deactivation does not delete employee. |
| Job title, joining date, status | `employees.job_title`, `joining_date`, `employment_status` | Employment administration and status control | HR/admin and scoped manager operations; own employee route does not allow these fields | Deactivation marks inactive; no record-erasure job. |
| User/employee IDs and timestamps | `users`, `employees` UUID/timestamp fields | Referential integrity, access checks, operations | Returned as part of DTOs and used internally | Retained with parent data; no expiry job. |
| Refresh token hash/family, expiry/revocation | `refresh_tokens` | Session rotation, reuse detection, revocation | Auth services; raw token is sent only through cookie | Expired/revoked rows are not purged automatically in the inspected code. Logout/password/deactivation revoke rows. |
| Audit actor/action/resource/request ID/time | `audit_logs` | Accountability for role, session, profile, employee, and document actions | Written by service transactions; no audit read API | No retention or purge job configured. Organization must define a schedule. |
| Document original filename, MIME, size, owner/uploader, dates | `employee_documents` | Document listing/download authorization and operations | Admin/HR, employee owner, manager read scope according to document route/service | Metadata soft-deleted; purged with file after `UPLOAD_RETENTION_DAYS` (default 30) by startup cleanup. |
| Document bytes and generated filename | Local `UPLOAD_DIR` file | Store private uploaded content | Only API file/download path; no static public route | Soft-delete cleanup after configured days; unreferenced files older than 24h removed at startup. Backup/restore of file directory and DB must be coordinated. |

| IP/request metadata | Express/rate-limit processing and request ID | Rate limiting, diagnostics, request correlation | Middleware/server logs | No dedicated request-log retention policy is defined here. Avoid adding raw credentials or full PII to logs. |

## Privacy Notes

- The project does not establish lawful basis, employee notice, purpose compatibility, data-subject identity verification, an erasure/correction workflow, or an approved retention schedule. These require organizational/privacy counsel review.
- Employee deactivation blocks login and revokes refresh tokens but retains employee and user profile records.
- Own-profile export returns the authenticated user and linked employee DTO; the export is audited. It is not a general data-subject-rights case-management process.
- Seed data is synthetic (`example.test`) and seeding refuses production mode.
