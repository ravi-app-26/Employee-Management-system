# Operations and Document Uploads

## S3 Upload Setup

Documents are stored in the private S3 bucket `emp-mt-system` in `ap-southeast-2` under `uploads/`. Configure `AWS_REGION`, `DOCUMENTS_S3_BUCKET`, `DOCUMENTS_S3_PREFIX`, and `DOCUMENT_DOWNLOAD_URL_TTL_SECONDS` as needed. AWS SDK v3 uses its standard credential provider chain: use environment credentials locally or an IAM role in AWS. Never commit AWS credentials. Keep S3 Block Public Access enabled and grant the application only the required bucket/object permissions.

Uploads accept PDF, PNG, and JPEG files up to `MAX_DOCUMENT_SIZE_BYTES` (default 5 MiB). Extension, declared MIME type, and actual file signature are checked before the API writes to S3. Object keys are generated server-side. PostgreSQL stores the employee association, original name, content type, size, uploader, and soft-delete timestamp; object keys are never returned by API responses.

The authenticated download-URL endpoint returns a private S3 presigned URL that expires after `DOCUMENT_DOWNLOAD_URL_TTL_SECONDS` (default 300 seconds, maximum 900). Document permissions and employee ownership are both checked before issuing URLs. Deletion is soft: metadata is immediately hidden and the object remains in S3 for `UPLOAD_RETENTION_DAYS` (default 30), after which startup cleanup permanently removes it. Startup cleanup also removes unreferenced S3 objects older than 24 hours. If metadata/audit creation fails after upload, the API attempts to delete the object; orphan cleanup is the fallback.

The upload endpoint accepts `multipart/form-data` with the `file` field. Multer holds one size-limited file in memory; extension, MIME type, and file signature are validated before the API writes bytes to S3. Successful uploads return safe metadata and a short-lived presigned download URL. Object keys use `uploads/{employeeId}/{timestamp}_{uuid}.{validatedExtension}` and never contain the original filename.

## Failure Classification

Expected input, authentication, authorization, missing-resource, conflict, rate-limit, and dependency failures use typed operational `AppError` responses. Responses include a stable error code, safe message, and request ID. Unexpected errors return a generic 500 response; diagnostic details are logged server-side. Production responses omit internal details and never include stack traces or SQL messages.

## Timeout And Retry Policy

Database connection, query, and statement timeouts are configured by `DB_CONNECT_TIMEOUT_MS` (5 seconds), `DB_QUERY_TIMEOUT_MS` (10 seconds), and `DB_STATEMENT_TIMEOUT_MS` (10 seconds). The application retries database initialization up to three times with exponential delay and jitter. This retry is limited to startup connection establishment. Non-idempotent API writes are never automatically retried.

Graceful shutdown stops accepting new HTTP connections, allows up to 10 seconds for in-flight requests, closes remaining connections if necessary, and then closes the TypeORM/PostgreSQL pool. `/health/live` reports process liveness; `/health/ready` checks the database and returns 503 while it is unavailable.

## Recovery And Tests

If metadata creation fails after an S3 object is written, the object is removed on a best-effort basis. If the process exits before cleanup, startup reconciliation removes unreferenced objects after 24 hours. Soft-deleted objects are retained for the configured retention period. Back up database metadata and S3 objects consistently; restoring only one side can leave missing bytes or orphaned metadata.

Run `npm run build` and `npm test -- --runInBand` from this package. The Postman collection includes list, auth, upload, invalid upload, download, and delete assertions. Set `documentFile` and `invalidDocumentFile` in `postman/employee-management-local.postman_environment.json` before running the collection.