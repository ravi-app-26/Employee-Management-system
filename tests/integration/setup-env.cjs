const path = require('node:path');

require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../../.env') });

const { randomUUID } = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'https://client.example.test, https://admin.example.test';
process.env.TRUST_PROXY = '0';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set TEST_DATABASE_URL (or a test-named DATABASE_URL) for integration tests');
}
if (!/test|testing/i.test(new URL(databaseUrl).pathname)) {
  throw new Error('Refusing to run destructive integration tests: DATABASE_URL must name a test database');
}
process.env.DATABASE_URL = databaseUrl;
const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL;
if (!redisUrl) throw new Error('Set TEST_REDIS_URL or REDIS_URL for integration tests');
process.env.REDIS_URL = redisUrl;
process.env.REDIS_KEY_PREFIX = `ems-it:${process.pid}:${randomUUID()}`;
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