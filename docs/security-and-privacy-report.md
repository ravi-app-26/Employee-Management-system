# Security And Privacy Report

## System Security Controls Observed

| Area | Implemented control | Evidence / limitation |
|---|---|---|
| Authentication | bcrypt password verification; generic invalid-login response; HS256 JWT with signature, expiry, issuer, and audience checks; active-user check on protected requests | `src/services/auth.service.ts`, `src/providers/jwt/jwt-provider.ts`, `src/middlewares/authenticate.ts`; access tokens are stateless until expiry, but deactivated users are rejected through active-user lookup. |
| Refresh sessions | Cryptographically random refresh values; SHA-256 hash at rest; HttpOnly cookie; rotation, family reuse detection, logout/session revocation; atomic conditional revoke+insert | `src/controllers/auth.controller.ts`, `src/repositories/refresh-token.repository.ts`; concurrent refresh integration test asserts one success and one 401. |
| Authorization | Role and permission middleware plus employee resource-scope checks; strict input allowlists; own-profile schema excludes employment/role fields | `src/middlewares/authorize.ts`, `src/services/employee.service.ts`, validators. Access decisions must remain in backend. |
| Injection | TypeORM structured criteria/query builder and named parameters; sort fields map through allowlists; request input validated by Zod | Verify every future raw query uses bind parameters; do not interpolate user-provided SQL identifiers. |
| Request abuse | Global rate limiter; tighter auth limiter; JSON body limit; pagination max 100; upload file-count/size limits | `src/middlewares/rate-limiter.ts`, `src/app.ts`, pagination/upload validators. In production, `TRUST_PROXY` must reflect the exact trusted proxy topology. |
| Browser/security headers | Helmet, explicit configured CORS origin list, HttpOnly/SameSite refresh cookie; Secure cookie in production | `src/app.ts`, `src/controllers/auth.controller.ts`. HTTPS termination must be configured in deployment. |
| Secret management | Environment validation at startup; no actual secret in `.env.example`; pino redaction for password/token/authorization/cookie fields | `src/config/env.ts`, `src/config/logger.ts`. Use a deployment secret manager in hosted environments; rotate compromised secrets. |
| Data exposure | Explicit employee/department DTOs; password hash excluded from normal User selection; document object key not returned | DTOs in `src/dto/`; user/document entity select behavior. Review every new response before release. |
| File handling | Server-generated S3 object keys; extension/MIME/signature checks; private bucket; permission-checked short-lived presigned downloads; object cleanup | `src/providers/aws/multer.ts`, `src/providers/aws/s3-document-storage.ts`, `src/services/employee-document.service.ts`. Keep S3 Block Public Access enabled and grant the application only the required bucket/object permissions. |
| Error handling | Structured 4xx/5xx response, request ID, generic unexpected error message; diagnostic error logged server-side | `src/middlewares/error-handler.ts`. Restrict access/retention for service logs. |
| Auditing | Audit rows are written for selected user, profile-export, employee and document actions | `audit_logs` and service writes. There is no audit read API or audit-retention job in this code. |
| Database | PostgreSQL foreign keys, unique constraints, checks, indexes, migrations, connection/query/statement timeouts, transactions for related writes | `migrations/`, `src/config/database.ts`. Backups, encryption-at-rest, TLS, least-privilege DB credentials, and restore testing are deployment responsibilities. |

## OWASP API Security Mapping

| OWASP API risk | Current mitigation | Remaining work / verification |
|---|---|---|
| Broken Object Level Authorization | Service checks owner/manager scope for employee detail/update and document scope; unauthorized employee record is returned as not found. | Add/retain tests for unrelated ID access for every route that accepts resource IDs; user/session administrative endpoints should be reviewed as new routes are added. |
| Broken Authentication | bcrypt; generic login error; claims validation; refresh-token hashing/rotation/reuse revocation; inactive account check. | Rate-limit storage is process-local unless configured otherwise; use shared distributed rate-limit storage for horizontally scaled deployment. |
| Broken Object Property Level Authorization | Zod `.strict()` schemas; separate own-profile and manager update schema; DTO mapping prevents ORM internals from leaking. | Keep writable schemas role-specific and test mass-assignment attempts (`role`, `roleId`, department/status on own-profile). |
| Unrestricted Resource Consumption | Global/auth rate limits, body size cap, pagination ceiling, upload size/count limits, database timeouts. | Set production quotas and monitor storage/connection pool exhaustion; distributed rate limiting is not configured. |
| Broken Function Level Authorization | Reusable permission and role middleware applied at routes; admin-only role assignment. | `audit:read` permission is seeded but there is no audit-read endpoint. Verify permissions remain least-privilege after seed changes. |
| Security Misconfiguration | Environment schema validation; Helmet; configured CORS; safe errors; no ORM schema auto-sync. | Configure HTTPS, trusted proxy hops, secure database networking, backups, and secrets manager per deployment. |
| Injection | Zod validation and parameterized TypeORM query construction. | Continue static review/tests for any future raw SQL and keep sort identifiers allowlisted. |
| Unrestricted access to sensitive business flows | Auth route limiting; permission gates on role/session/document operations; export limited to self. | Add anomaly monitoring and operational alerting for repeated auth failures and privileged actions. |
| Improper Inventory Management | Versioned `/api/v1`, OpenAPI and Postman collection. | Keep docs synchronized in same change as every route/schema/permission update. |
| Unsafe consumption of APIs | No external business API integration currently identified. | If integrations are introduced, validate responses, timeouts, and destinations; avoid trusting remote data. |

## GDPR/EU Privacy Mapping (Engineering Support, Not Legal Compliance)

| Privacy principle / task | Current implementation evidence | Gap / organizational action |
|---|---|---|
| Data minimization and purpose limitation | Current schema collects work identity, job/department/reporting data, optional phone, auth metadata, and uploaded documents. | Document and approve purpose/lawful basis for each field and each role's access. This repository cannot decide the lawful basis. |
| Access control and confidentiality | RBAC, resource scope, DTO responses, password hashes excluded, private local files. | Conduct deployment security review, least-privilege review, penetration testing, and operational access review. |
| Logging minimization | Pino redacts common credential keys; application error responses omit stack traces. | Avoid logging full employee/document contents; define log access and deletion periods outside this code. |
| Retention limitation | Document file retention is configurable; employee deactivation and token revocation exist. | Employee, user, audit, and expired refresh-token database retention is not scheduled. Organization must define legal/operational retention and implement approved jobs. |
| Accuracy and correction | Employee/profile patch operations allow selected corrections. | Define verification, history, and correction process; audit semantics do not capture before/after values. |
| Access/export | `GET /api/v1/me/export` returns the caller's own safe profile and writes an audit event. | This endpoint alone does not satisfy all legal access request obligations or identity/response deadlines. |
| Erasure and legal retention | Employee “delete” means deactivation; document metadata/file soft-delete exists. | No employee erasure/anonymization workflow or legal-hold process is implemented. Privacy/legal team must decide how conflicting retention duties are handled. |
| Accountability | Audit rows include actor, action, target, time, request ID for selected operations. | No audit search API, retention policy, immutable log archive, or full coverage proof is present. |

This report is an engineering inventory, not legal advice or a claim of GDPR compliance. The controller must assess lawful basis, notices, data-subject procedures, processor agreements, transfer rules, retention periods, and breach response with qualified privacy/legal staff.
