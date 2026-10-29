# Employee Management API

Secure REST API built with Express 5, TypeScript, PostgreSQL, and TypeORM. The current implementation includes authentication and refresh-token sessions, RBAC, employee and department management, private local employee-document storage, request validation, audit records, and OpenAPI/Swagger documentation.
## Prerequisites

- Node.js and npm compatible with the locked dependencies
- PostgreSQL
- A local Redis instance for cache/session metadata and integration tests

## Local Setup

1. Install packages:

   ```bash
   npm ci
   ```

2. Create a PostgreSQL database and user, then copy the sample environment file:

   ```bash
   cp .env.example .env
   ```

3. Set `DATABASE_URL` and replace `JWT_ACCESS_SECRET` with a random secret of at least 32 characters. Never use development seed credentials or secrets in production.
4. Apply migrations and seed development data:

   ```bash
   npm run migrate
   npm run seed
   ```

   `npm run seed` refuses to run when `NODE_ENV=production`. Development users share password `DevPass#12345`; do not expose this seed outside a local environment.
5. Start the API:

   ```bash
   npm run dev
   ```

   The default port is `3000`. Check `http://localhost:3000/health`; Swagger UI is served at `http://localhost:3000/api-docs`.

For a production build, run `npm run build` followed by `npm start`. The server initializes PostgreSQL before opening its HTTP listener.

## Environment

| Variable | Default / requirement | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Runtime mode; allowed values are development, test, production. |
| `PORT` | `3000` | HTTP listener port. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. |
| `TRUST_PROXY` | `0` | Number of trusted proxy hops. Keep `0` unless the deployment has a known, trusted proxy topology. |
| `DATABASE_URL` | Required | PostgreSQL connection URL. |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL. |
| `REDIS_KEY_PREFIX` | Empty | Optional namespace prepended to application Redis keys. |
| `DEPARTMENT_CACHE_TTL_SECONDS` | `60` | Department-list cache lifetime. |
| `PERMISSION_CACHE_TTL_SECONDS` | `60` | Permission cache lifetime. |
| `SESSION_RECONCILIATION_CRON` | `*/5 * * * *` | Cron schedule for PostgreSQL-backed session-cache reconciliation. |
| `JWT_ACCESS_SECRET` | Required, minimum 32 chars | HS256 JWT signing secret. |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime. |
| `JWT_ISSUER` | `ems-api` | Required JWT issuer claim. |
| `JWT_AUDIENCE` | `ems-client` | Required JWT audience claim. |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh-token expiry in days. |
| `BCRYPT_ROUNDS` | `12` | bcrypt work factor. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | General request-rate window. |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | General requests per window. Login, refresh, and password-change routes use a separate limit of 8 per minute. |
| `UPLOAD_DIR` | `private-uploads` | Local private document directory; do not expose it as static content. |
| `MAX_DOCUMENT_SIZE_BYTES` | `5242880` | Upload size limit; config caps it at 10 MiB. |
| `UPLOAD_RETENTION_DAYS` | `30` | Days soft-deleted document files remain before cleanup. |
| `PUBLIC_API_BASE_URL` | `http://localhost:3000` | Base URL embedded in signed download URLs. |
| `DB_CONNECT_TIMEOUT_MS` | `5000` | PostgreSQL connection timeout. |
| `DB_QUERY_TIMEOUT_MS` | `10000` | PostgreSQL query timeout. |
| `DB_STATEMENT_TIMEOUT_MS` | `10000` | Statement and idle-in-transaction timeout. |

The authoritative validation/defaults are in [`src/config/env.ts`](src/config/env.ts). `.env.example` currently repeats `CORS_ORIGINS`; set one consistent value in the local `.env`.

### Redis Configuration

`REDIS_URL` accepts a Redis URL with optional username/password credentials, for example `redis://:password@127.0.0.1:6379` or `rediss://username:password@redis.example.net:6380`. Use `rediss://` to enable TLS; certificate verification remains enabled by the Redis client. Keep credentials in an untracked `.env` or secret manager, URL-encode special characters, and never commit populated credentials.

`REDIS_CONNECT_TIMEOUT_MS`, `REDIS_SOCKET_TIMEOUT_MS`, `REDIS_MAX_RECONNECT_RETRIES`, and `REDIS_RECONNECT_BASE_DELAY_MS` bound connection waits and retries. Reconnect delay grows exponentially and is capped at five seconds; the retry count is finite to avoid an outage retry storm. `REDIS_KEY_PREFIX` isolates this application/environment, while the cache, session, token, and event namespace variables keep key classes separate.

| Redis key class | Default lifetime | Rationale |
|---|---|---|
| Department and permission cache entries | 60 seconds | Limits staleness while keeping repeated reads inexpensive; PostgreSQL remains the source of truth. |
| Session and refresh-token metadata | Remaining PostgreSQL refresh-token lifetime | Redis metadata cannot outlive the authoritative token. |
| Expiry-event deduplication marker | 24 hours | Suppresses duplicate Pub/Sub deliveries; PostgreSQL event keys and scheduled reconciliation provide durable idempotency/recovery. |

For local development, install/start Redis using the host OS package or Redis distribution, leave `REDIS_URL=redis://127.0.0.1:6379`, and verify it responds with `redis-cli ping`. No container runtime is required. Expiry notifications require Redis `notify-keyspace-events` flags `E` and `x`; startup attempts to add them while preserving existing flags. If `CONFIG SET` is restricted, configure `notify-keyspace-events Ex` in the local Redis server configuration. To exercise expiry, use a short-lived test refresh token/session or the session-expiry integration tests against the explicitly named test database and dedicated `TEST_REDIS_URL`.

Redis is an optimization, not an authorization source. Authentication checks user activity and session-family revocation in PostgreSQL on every protected request. If those PostgreSQL checks fail, the request is rejected and transient database connection errors return `503`; Redis unavailability degrades caching and expiry notifications but never bypasses the PostgreSQL check. `/health/ready` reports Redis as `degraded` when disconnected, and `/health/metrics` exposes Redis/cache/expiry/reconciliation counters.

## Redis Session Expiry Events

The API uses typed keys `session:<familyId>`, `refresh-token:<tokenHash>`, and `refresh-token-family:<familyId>`. When Redis is available, startup attempts to preserve the current `notify-keyspace-events` value and add `E` and `x`, enabling keyevent expiry notifications (`Ex`). The Redis account therefore needs permission to read and update this configuration. On Redis installations where `CONFIG SET` is restricted, an administrator must enable the flags in the Redis server configuration, for example `notify-keyspace-events Ex`; retain any other flags already required by that server.

Expiry Pub/Sub is best-effort, not durable. The subscriber delegates events to the session expiry service, which checks PostgreSQL before restoring or cleaning Redis metadata. Session-expiry audit insertion is recoverable from PostgreSQL refresh-token rows: a reconciliation job runs on `SESSION_RECONCILIATION_CRON`, retries stale families, and inserts idempotent audit events even when notifications were missed or a database write failed. The audit event unique key prevents duplicates. Reconciliation does not delete PostgreSQL refresh-token rows.

## Tests And Checks

```bash
npm test -- --runInBand
npm run test:integration
npm run typecheck
npm run build
```

`npm run test:integration` applies migrations and runs Jest serially against locally running PostgreSQL and Redis. Configure a dedicated test database with `TEST_DATABASE_URL` (or `DATABASE_URL` whose database name contains `test`) and `TEST_REDIS_URL` (or `REDIS_URL`). Integration setup refuses non-test database names and uses a unique Redis key prefix; its setup truncates tables in that test database, so never point it at development or production data. It does not start Docker or Compose.

Integration coverage includes authentication, refresh-token concurrency/replay, employee CRUD/access rules, user administration/audit, document flows, security behavior, DTO response shape, and department sorting. The default `npm test` suite covers the configured unit tests, including pino redaction.

## Role-Permission Matrix

The matrix below is the seed mapping in [`seeds/run.ts`](seeds/run.ts). Resource-level employee access is additionally enforced in the service; a permission alone does not grant access to every employee record.

| Permission | Admin | HR | Manager | Employee |
|---|:---:|:---:|:---:|:---:|
| `employee:create` | Yes | Yes | No | No |
| `employee:read` | Yes | Yes | Yes, scoped | No |
| `employee:update` | Yes | Yes | Yes, scoped | No |
| `employee:deactivate` | Yes | No | No | No |
| `department:create` | Yes | No | No | No |
| `department:read` | Yes | Yes | Yes | Yes |
| `department:update` | Yes | No | No | No |
| `user:assign_role` | Yes | No | No | No |
| `session:revoke_any` | Yes | No | No | No |
| `audit:read` | Yes | No | No | No |
| `profile:read_own` | Yes | Yes | Yes | Yes |
| `profile:update_own` | Yes | Yes | Yes | Yes |
| `profile:export_own` | Yes | Yes | Yes | Yes |
| `document:upload` | Yes | Yes | No | Own documents |
| `document:read` | Yes | Yes | Direct reports | Own documents |
| `document:delete` | Yes | Yes | No | Own documents |

Managers may read and update themselves/direct reports where route and service rules allow; they cannot update their own employment record through `/:id`. Employees may use only `/employees/me` for their profile. Out-of-scope detail lookups are intentionally returned as not found. `audit:read` is seeded but no audit-reading API route is currently mounted.

## Database Design

PostgreSQL migrations are the schema source of truth; TypeORM synchronization is disabled. See [`docs/ERD.md`](docs/ERD.md) and [`migrations/`](migrations/).

- `users`: login identity, password hash, role, employee link, active flag, timestamps. Names and work email are stored here in the current schema.
- `employees`: employment fields, department, optional manager, phone, status, timestamps. `users.employee_id` points to this record.
- `departments`: unique department name and description.
- `roles`, `permissions`, `role_permissions`: RBAC definitions and join table.
- `refresh_tokens`: SHA-256 token hash, session family, expiry, revocation time.
- `audit_logs`: actor, action, resource type/ID, timestamp, request ID.
- `employee_documents`: safe metadata and private local object key; file bytes live under `UPLOAD_DIR`, not in PostgreSQL.
Constraints include UUID primary keys, unique case-insensitive user/employee work-email indexes, unique employee-to-user association, foreign keys, employment-status check, and a self-manager check. Migrations add department/status, sorting, and trigram search indexes.

## API And Security Notes

- API routes are mounted under `/api/v1`; the OpenAPI file is [`docs/openapi.yaml`](docs/openapi.yaml).
- Additional user endpoints and their access requirements:
   - `PATCH /users/:id/role` — admin role and `user:assign_role` permission.
   - `POST /users/:id/sessions/revoke` — `session:revoke_any` permission (admin in the seeded role-permission mapping).
   - `GET /me/export` — `profile:export_own` permission; exports only the authenticated user's data (granted to all seeded roles).
- Login returns a short-lived JWT access token and sets an HttpOnly refresh cookie. The cookie is `SameSite=Strict`, scoped to `/api/v1/auth`, and `Secure` in production.
- Refresh-token values are not stored in the database; only hashes are stored. Rotation is transactional, and reuse revokes the token family.
- Employee update input is strict/allowlisted. Self-profile writes allow only first name, last name, and phone.
- Documents are stored on local disk with generated names and private permissions. This is not cloud object storage and is intended for a single host unless the deployment provides a shared private filesystem.
- GDPR obligations depend on the deploying organization. The implementation does not define a lawful basis, notices, a complete data-subject-rights process, or employee/audit retention schedule. See [`docs/security-and-privacy-report.md`](docs/security-and-privacy-report.md) and [`docs/data-inventory.md`](docs/data-inventory.md).
