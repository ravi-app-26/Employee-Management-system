# Low-Level Design

## Packages And Ownership

| Area | Responsibility | Main files |
|---|---|---|
| Application composition | Middleware and route mounting | `src/app.ts`, `src/container.ts`, `src/server.ts` |
| Configuration | Validate environment, configure database and logger | `src/config/env.ts`, `src/config/database.ts`, `src/config/logger.ts` |
| Transport | Validate input, bind route and permission, format response | `src/routes/`, `src/controllers/`, `src/validators/`, `src/utils/api-response.ts` |
| Authentication | Password verification, JWT creation/verification, refresh rotation | `src/services/auth.service.ts`, `src/repositories/refresh-token.repository.ts` |
| Authorization | Resolve user permissions and enforce route/resource scope | `src/middlewares/authorize.ts`, `src/services/authorization.service.ts`, `src/services/employee.service.ts` |
| Persistence | TypeORM entities and repository/query operations | `src/entities/`, `src/repositories/` |
| Documents | Upload validation, local storage, signed downloads, retention cleanup | `src/services/document-storage.ts`, `src/services/employee-document.service.ts` |
| Errors and observability | Request IDs, safe API errors, pino redaction | `src/middlewares/`, `src/config/logger.ts` |

## Employee Data Access

Employee profile names and work email are held in `users`; employment properties are in `employees`. The `EmployeeRepository.list` query joins the user identity table, parameterizes department/status/search filters, uses allowlisted sort columns, and applies pagination. `EmployeeService` passes the caller role and employee ID to repository scope; its detail/update methods enforce additional checks. Employee APIs map entities to `EmployeeDto` before responses.

`POST /employees` creates a user and employee in a transaction. The application generates a random password when none is supplied; that generated secret is not returned. Deactivation sets employment status inactive, disables the linked user, revokes that user's active refresh tokens, and writes an audit row in a transaction. Updating employment status to inactive also invokes deactivation.

## Authentication Flow

### Login

1. `POST /auth/login` validates email/password and applies the auth-specific limiter.
2. `AuthService.login` loads the password hash explicitly, runs bcrypt comparison (including a dummy hash when the user is absent), and rejects inactive users with a generic error.
3. The service creates an access JWT and a random refresh token. Refresh-token hash/family/expiry are stored; raw refresh value is set in an HttpOnly cookie.

### Refresh

1. Read the refresh cookie and look up its hash.
2. Reject missing, expired, revoked, or inactive-user refresh tokens.
3. In a database transaction, conditionally revoke the presented active token and insert the replacement. An update affecting zero rows triggers family revocation and a 401.
4. Issue a new access token only after successful rotation.

### Authorization

Routes require an access token where appropriate. Permission middleware resolves the authenticated user's current role permissions. Employee record checks are also applied in the service; managers see themselves/direct reports, employees access their own record, and admin/HR can access broadly subject to endpoint permissions.

## DTOs And Error Handling

Services return explicit employee/department DTOs instead of raw TypeORM records. The API success wrapper is `{ success: true, data, requestId }`; 204 endpoints return no body. Errors use `{ success: false, error: { code, message, details?, requestId } }`. Unexpected 5xx diagnostics are logged with pino; configured redaction covers password, token, authorization, and cookie fields.

## Validation And Database Changes

Zod schemas are strict for request bodies and list query strings. Sorting is an allowlist. UUID path parameters are checked before service calls. Migrations are authoritative (`synchronize: false`); changes must be delivered as migrations, not schema auto-sync.

## Document Flow

Multer allows one file with a configured size cap and matching PDF/PNG/JPEG extension/MIME. File bytes are written to `UPLOAD_DIR` under a server-generated name. Content signatures are checked before metadata insert. Metadata insertion and upload audit are transactional; on failure the new file is unlinked. Deletion is soft and startup cleanup removes expired soft-deleted files and orphaned files older than 24 hours.
