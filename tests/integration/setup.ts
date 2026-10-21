import { afterAll, beforeAll, beforeEach } from '@jest/globals';
import { AppDataSource } from '../../src/config/database';

beforeAll(async () => {
  await AppDataSource.initialize();
});

beforeEach(async () => {
  await AppDataSource.query(`
    TRUNCATE TABLE
      audit_logs,
      refresh_tokens,
      users,
      employees,
      departments,
      role_permissions,
      permissions,
      roles
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});