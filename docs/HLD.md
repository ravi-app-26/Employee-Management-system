# High-Level Design

## Scope

<<<<<<< Updated upstream
The service is a single Express 5 API process backed by PostgreSQL. It manages authentication, employee and department records, role/permission checks, refresh-token sessions, audit events, and employee document metadata plus private local files. It does not implement a frontend, cloud object-storage integration, audit-log query endpoint, employee data-erasure workflow, or full GDPR program.
=======
The service is an Express 5 API backed by PostgreSQL and private S3 object storage. It manages authentication, employee and department records, role/permission checks, refresh-token sessions, audit events, and employee document metadata/bytes. It does not implement a frontend, audit-log query endpoint, employee data-erasure workflow, or full GDPR program.
>>>>>>> Stashed changes

## Runtime Components

```mermaid
flowchart LR
  Client[Postman or API client] -->|HTTPS in deployment / JSON / multipart| Express[Express 5 application]
  Express --> Middleware[Request ID, rate limit, Helmet, CORS, parsing]
  Middleware --> Router[Versioned routers]
  Router --> Auth[Authentication and authorization middleware]
  Auth --> Controller[Controllers and validation]
  Controller --> Service[Use-case services]
  Service --> Repo[TypeORM repositories / transaction manager]
  Repo --> PG[(PostgreSQL)]
<<<<<<< Updated upstream
  Service --> Files[Private local upload directory]
=======
  Service --> S3[Private S3 bucket]
>>>>>>> Stashed changes
  Service --> Audit[(audit_logs in PostgreSQL)]
  Express --> Swagger[Swagger UI / OpenAPI]
  Express --> Logger[Pino redacting logger]
```

## Request Flow

1. Request ID, global rate limiting, Helmet, CORS, JSON parsing (10 KiB), and cookie parsing run in `src/app.ts`.
2. Routes apply JWT authentication, role/permission checks, UUID validation, and Zod body/query validation.
3. Controllers translate HTTP inputs into service calls and use the shared response envelope.
4. Services enforce business rules and resource scope; repositories/TypeORM perform parameterized persistence operations.
5. Sensitive writes record an audit event in PostgreSQL. Employee/account deactivation and employee creation use database transactions for related state changes.
6. The central error handler maps validation, authorization, database constraint, upload, and dependency failures into structured responses with request IDs.

## Authentication And Trust Boundaries

- Access JWTs are signed with HS256 and checked for signature, expiry, issuer, and audience.
- Refresh tokens are high-entropy random values delivered in an HttpOnly cookie. The database stores SHA-256 hashes and a family ID.
<<<<<<< Updated upstream
- Employee document uploads are accepted by Multer into a private local directory, then extension, MIME type, size, and file signature are checked. Generated object keys prevent clients choosing filesystem paths.
- Document download uses a five-minute HMAC-signed URL served by this API; the file directory is not mounted as a public static path.
=======
- Employee document uploads are accepted by Multer into bounded memory, then extension, MIME type, size, and file signature are checked before S3 upload. Generated object keys prevent clients choosing storage paths.
- Document download URLs are short-lived S3 presigned URLs issued only after permission and employee-ownership checks. The bucket remains private and credentials are never returned.
>>>>>>> Stashed changes
- The process trusts proxy headers only according to `TRUST_PROXY`. Configure it to match the actual trusted reverse-proxy topology.

## Availability And Operations

Database startup retries are limited to initialization; API writes are not automatically retried. PostgreSQL connection, query, statement, and idle-transaction timeouts are configured in `src/config/database.ts`. Graceful shutdown stops the HTTP server, then closes the TypeORM pool, with a 10-second force-close timer. Readiness is separate from liveness.

## Known Boundaries

<<<<<<< Updated upstream
- Local file storage is single-host storage; multi-instance deployments need a shared private volume or a separately implemented object-storage adapter.
=======
- S3 must remain private; deploy with Block Public Access and a least-privilege IAM role. Startup cleanup needs `s3:ListBucket` for the configured prefix in addition to object operations.
>>>>>>> Stashed changes
- Audit events can be written, but there is no audit search/read route or audit retention process.
- Seeded `audit:read` and `profile:export_own` permission names do not imply that an audit-read route exists. Profile export does exist.
- Technical controls do not establish GDPR compliance; lawful basis, transparency notices, retention policy approval, and rights handling require organizational decisions.
