import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';

export const AppDataSource = new DataSource({//new DataSource() sirf configuration object banata hai. Database se actual connection establish karne ke liye initialize() call karna hota hai.
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [__dirname + '/../entities/*.entity.{ts,js}'],
  synchronize: false,
  logging:
    env.NODE_ENV === 'test'
      ? false
      : env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  extra: {
    max: 10,
    connectionTimeoutMillis: env.DB_CONNECT_TIMEOUT_MS,
    query_timeout: env.DB_QUERY_TIMEOUT_MS,
    statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  },
});