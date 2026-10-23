import { afterAll, beforeAll, beforeEach } from '@jest/globals';
import { AppDataSource } from '../../src/config/database';
import { RateLimitMiddleware } from '../../src/middlewares/rate-limiter';

beforeAll(async () => {
  await AppDataSource.initialize();
});

beforeEach(async () => {
  RateLimitMiddleware.auth.resetKey('127.0.0.1');
  RateLimitMiddleware.handle.resetKey('127.0.0.1');

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
      ('employee:deactivate'),
      ('department:create'),
      ('department:read'),
      ('department:update'),
      ('user:assign_role'),
      ('session:revoke_any'),
      ('profile:read_own'),
      ('profile:update_own'),
      ('profile:export_own')
  `);
  await AppDataSource.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT roles.id, permissions.id
    FROM roles CROSS JOIN permissions
     WHERE (permissions.name = 'employee:create' AND roles.name IN ('admin', 'hr'))
       OR (permissions.name = 'employee:read' AND roles.name IN ('admin', 'hr', 'manager'))
       OR (permissions.name = 'employee:update' AND roles.name IN ('admin', 'hr', 'manager'))
      OR (permissions.name = 'employee:deactivate' AND roles.name = 'admin')
      OR (permissions.name = 'department:create' AND roles.name = 'admin')
      OR (permissions.name = 'department:read' AND roles.name = 'admin')
      OR (permissions.name = 'department:update' AND roles.name = 'admin')
      OR (permissions.name = 'user:assign_role' AND roles.name = 'admin')
      OR (permissions.name = 'session:revoke_any' AND roles.name = 'admin')
       OR permissions.name = 'profile:read_own'
      OR permissions.name = 'profile:update_own'
      OR permissions.name = 'profile:export_own'
  `);
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});