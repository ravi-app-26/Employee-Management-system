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

  await AppDataSource.query(`
    INSERT INTO roles (name)
    VALUES ('admin'), ('hr'), ('manager'), ('employee')
  `);
  await AppDataSource.query(`
    INSERT INTO permissions (name)
    VALUES
      ('employee:create'),
      ('employee:read'),
      ('employee:update'),
      ('profile:read_own')
  `);
  await AppDataSource.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT roles.id, permissions.id
    FROM roles CROSS JOIN permissions
     WHERE (permissions.name = 'employee:create' AND roles.name IN ('admin', 'hr'))
       OR (permissions.name = 'employee:read' AND roles.name IN ('admin', 'hr', 'manager'))
       OR (permissions.name = 'employee:update' AND roles.name IN ('admin', 'hr', 'manager'))
       OR permissions.name = 'profile:read_own'
  `);
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});