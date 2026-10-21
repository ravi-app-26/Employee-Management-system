process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'https://client.example.test, https://admin.example.test';
process.env.TRUST_PROXY = 'true';
process.env.DATABASE_URL =
  'postgresql://employee_test:employee_test@127.0.0.1:55432/employee_management_test';
process.env.JWT_ACCESS_SECRET =
  'integration-test-secret-at-least-thirty-two-characters-long';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_ISSUER = 'ems-integration-test';
process.env.JWT_AUDIENCE = 'ems-integration-client';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.BCRYPT_ROUNDS = '4';
process.env.DB_CONNECT_TIMEOUT_MS = '5000';
process.env.DB_QUERY_TIMEOUT_MS = '10000';
process.env.DB_STATEMENT_TIMEOUT_MS = '10000';