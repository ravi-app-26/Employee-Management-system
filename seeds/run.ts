import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env';

const DEV_PASSWORD = 'DevPass#12345';

const ROLES: [string, string][] = [
  ['admin', 'Full administration'],
  ['hr', 'HR staff'],
  ['manager', 'Team manager'],
  ['employee', 'Regular employee'],
];

const PERMISSIONS: [string, string][] = [
  ['employee:create', 'Create employees'],
  ['employee:read', 'Read employee records (scoped by role)'],
  ['employee:update', 'Update employee records (scoped by role)'],
  ['employee:deactivate', 'Deactivate employees'],
  ['department:create', 'Create departments'],
  ['department:read', 'List departments'],
  ['department:update', 'Update departments'],
  ['user:assign_role', 'Change a user role'],
  ['session:revoke_any', 'Revoke any user session'],
  ['audit:read', 'Read audit logs'],
  ['profile:read_own', 'Read own profile'],
  ['profile:update_own', 'Update own profile'],
  ['profile:export_own', 'Export own data'],
  ['document:upload', 'Upload employee documents'],
  ['document:read', 'List and download employee documents'],
  ['document:delete', 'Soft-delete employee documents'],
];

const OWN = ['profile:read_own', 'profile:update_own', 'profile:export_own'];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS.map(([name]) => name),
  hr: ['employee:create', 'employee:read', 'employee:update', 'department:read', 'document:upload', 'document:read', 'document:delete', ...OWN],
  manager: ['employee:read', 'employee:update', 'department:read', 'document:read', ...OWN],
  employee: ['department:read', 'document:upload', 'document:read', 'document:delete', ...OWN],
};

const DEPARTMENTS: [string, string][] = [
  ['Engineering', 'Software development'],
  ['Human Resources', 'People operations'],
  ['Sales', 'Sales and accounts'],
];

interface DevUser {
  email: string;
  first: string;
  last: string;
  title: string;
  dept: string;
  role: string;
  managerEmail?: string;
}

// Manager pehle aana chahiye, kyunki employee uske under report karta hai
const DEV_USERS: DevUser[] = [
  { email: 'admin@example.test', first: 'Asha', last: 'Admin', title: 'System Administrator', dept: 'Engineering', role: 'admin' },
  { email: 'hr@example.test', first: 'Hari', last: 'Rao', title: 'HR Executive', dept: 'Human Resources', role: 'hr' },
  { email: 'manager@example.test', first: 'Meera', last: 'Shah', title: 'Engineering Manager', dept: 'Engineering', role: 'manager' },
  { email: 'employee@example.test', first: 'Esha', last: 'Verma', title: 'Software Engineer', dept: 'Engineering', role: 'employee', managerEmail: 'manager@example.test' },
];

class SeedRunner {
  private static async seedAccessControl(db: PoolClient): Promise<void> {
  for (const [name, description] of ROLES) {
    await db.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, description],
    );
  }
  for (const [name, description] of PERMISSIONS) {
    await db.query(
      'INSERT INTO permissions (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, description],
    );
  }
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const perm of perms) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r, permissions p
         WHERE r.name = $1 AND p.name = $2
         ON CONFLICT DO NOTHING`,
        [role, perm],
      );
    }
  }
}

  private static async seedDepartments(db: PoolClient): Promise<void> {
  for (const [name, description] of DEPARTMENTS) {
    await db.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, description],
    );
  }
}

  private static async seedUsers(db: PoolClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, env.BCRYPT_ROUNDS);

  for (const u of DEV_USERS) {
    let employeeId: string;

    const existing = await db.query(
      `SELECT e.id FROM employees e
       JOIN users u ON u.employee_id = e.id
       WHERE LOWER(u.work_email) = LOWER($1)`,
      [u.email],
    );

    if (existing.rowCount) {
      employeeId = existing.rows[0].id;
    } else {
      const inserted = await db.query(
        `INSERT INTO employees
           (department_id, manager_id, job_title, joining_date)
         VALUES (
           (SELECT id FROM departments WHERE name = $1),
           (SELECT e.id FROM employees e JOIN users u ON u.employee_id = e.id WHERE LOWER(u.work_email) = LOWER($2)),
           $3, CURRENT_DATE
         ) RETURNING id`,
        [u.dept, u.managerEmail ?? null, u.title],
      );
      employeeId = inserted.rows[0].id;
    }

    await db.query(
      `INSERT INTO users (first_name, last_name, work_email, password_hash, role_id, employee_id)
       SELECT $1, $2, $3, $4, r.id, $5 FROM roles r WHERE r.name = $6
       AND NOT EXISTS (SELECT 1 FROM users WHERE employee_id = $5)`,
      [u.first, u.last, u.email, passwordHash, employeeId, u.role],
    );
  }
}

  static async run(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed dev accounts in production');
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = await pool.connect();

  try {
    await db.query('BEGIN');
    await this.seedAccessControl(db);
    await this.seedDepartments(db);
    await this.seedUsers(db);
    await db.query('COMMIT');

    console.log('Seed complete.');
    console.log(`Dev password for all users: ${DEV_PASSWORD}`);
    for (const u of DEV_USERS) console.log(` - ${u.role.padEnd(8)} ${u.email}`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
  }
}

SeedRunner.run();