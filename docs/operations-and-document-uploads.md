# Operations and Document Uploads

## Local Upload Setup

Uploads use Multer disk storage only. No AWS, object-storage service, or cloud credentials are used. Configure `UPLOAD_DIR` to a private local directory (default `private-uploads`) and ensure the service account has exclusive access. The app enforces directory mode `0700` and file mode `0600`; do not expose this directory through a web server or static route.

Uploads accept PDF, PNG, and JPEG files up to `MAX_DOCUMENT_SIZE_BYTES` (default 5 MiB). Extension, MIME type, and the file signature are checked. Multer writes a generated filename, while PostgreSQL stores the employee association, original name, content type, size, uploader, and soft-delete timestamp. The object key is never returned by API responses.

The authenticated download-URL endpoint returns an HMAC-signed API URL that expires after five minutes. Only an authenticated user with resource access may request one. Deletion is soft: the metadata is marked deleted and the file remains inaccessible through the API until `UPLOAD_RETENTION_DAYS` (default 30) expires. Startup cleanup removes expired soft-deleted files and unreferenced files older than 24 hours. A database transaction failure removes the just-uploaded file immediately.

Local storage is suitable for a single-host assignment/development deployment. For multiple API instances, use a shared private filesystem; this implementation intentionally does not connect to cloud/object storage.

## Failure Classification

Expected input, authentication, authorization, missing-resource, conflict, rate-limit, and dependency failures use typed operational `AppError` responses. Responses include a stable error code, safe message, and request ID. Unexpected errors return a generic 500 response; diagnostic details are logged server-side. Production responses omit internal details and never include stack traces or SQL messages.

## Timeout And Retry Policy

Database connection, query, and statement timeouts are configured by `DB_CONNECT_TIMEOUT_MS` (5 seconds), `DB_QUERY_TIMEOUT_MS` (10 seconds), and `DB_STATEMENT_TIMEOUT_MS` (10 seconds). The application retries database initialization up to three times with exponential delay and jitter. This retry is limited to startup connection establishment. Non-idempotent API writes are never automatically retried.

Graceful shutdown stops accepting new HTTP connections, allows up to 10 seconds for in-flight requests, closes remaining connections if necessary, and then closes the TypeORM/PostgreSQL pool. `/health/live` reports process liveness; `/health/ready` checks the database and returns 503 while it is unavailable.

## Recovery And Tests

If metadata creation fails after a file is written, the file is removed. If the process exits before cleanup, the startup cleanup removes unreferenced local files after 24 hours. Soft-deleted files are retained for the configured retention period. Monitor disk space and back up the upload directory and database together; restoring only one side can leave missing document bytes or orphaned metadata.

Run `npm run build` and `npm test -- --runInBand` from this package. The Postman collection includes list, auth, upload, invalid upload, download, and delete assertions. Set `documentFile` and `invalidDocumentFile` in `postman/employee-management-local.postman_environment.json` before running the collection.