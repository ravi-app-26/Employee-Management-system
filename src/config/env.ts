import 'dotenv/config';
import { z } from 'zod';
import { logger } from './logger';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform((value) =>
    value.split(',').map((origin) => origin.trim()).filter(Boolean),
  ),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  REDIS_KEY_PREFIX: z.string().default(''),
  REDIS_CACHE_KEY_PREFIX: z.string().default('cache'),
  REDIS_SESSION_KEY_PREFIX: z.string().default('session'),
  REDIS_TOKEN_KEY_PREFIX: z.string().default('token'),
  REDIS_EVENT_KEY_PREFIX: z.string().default('event'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  REDIS_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  REDIS_MAX_RECONNECT_RETRIES: z.coerce.number().int().nonnegative().default(5),
  REDIS_RECONNECT_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  DEPARTMENT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  PERMISSION_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  SESSION_RECONCILIATION_CRON: z.string().default('*/5 * * * *'),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_ISSUER: z.string().default('ems-api'),
  JWT_AUDIENCE: z.string().default('ems-client'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(1),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(30),
  MAX_DOCUMENT_SIZE_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  AWS_REGION: z.string().default('ap-southeast-2'),
  DOCUMENTS_S3_BUCKET: z.string().default('emp-mt-system'),
  DOCUMENTS_S3_PREFIX: z.string().default('uploads/'),
  DOCUMENT_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(900).default(300),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  UPLOAD_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

const parsed = schema.safeParse(process.env);//environment variables (.env) ko Zod schema ke according validate karna, bina error throw kiye.

if (!parsed.success) {
  logger.error('Invalid environment configuration');
  for (const issue of parsed.error.issues) {//validation ki saari errors deta hai.
    logger.error({ configPath: issue.path.join('.'), validationMessage: issue.message });
  }
  process.exit(1);//if configuration is wrong app closed
}

export const env = parsed.data;