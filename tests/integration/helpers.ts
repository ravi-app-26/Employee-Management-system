import bcrypt from 'bcrypt';
import request from 'supertest';
import { AppDataSource } from '../../src/config/database';
import { app } from '../../src/app';

export interface AuthenticatedTestUser {
  id: string;
  employeeId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshCookie: string;
}

export async function createUserByRole(
  role: string,
  overrides: { email?: string; password?: string; managerId?: string } = {},
): Promise<AuthenticatedTestUser> {
  const email = overrides.email ?? `${role}-${crypto.randomUUID()}@example.test`;
  const password = overrides.password ?? 'IntegrationPass#123';
  const roleRows: Array<{ id: number }> = await AppDataSource.query(
    `INSERT INTO roles (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [role],
  );
  const departmentRows: Array<{ id: string }> = await AppDataSource.query(
    `INSERT INTO departments (name) VALUES ($1) RETURNING id`,
    [`Integration ${crypto.randomUUID()}`],
  );
  const employeeRows: Array<{ id: string }> = await AppDataSource.query(
    `INSERT INTO employees (department_id, manager_id, job_title, joining_date)
     VALUES ($1, $2, $3, CURRENT_DATE)
     RETURNING id`,
    [departmentRows[0].id, overrides.managerId ?? null, 'Integration Test User'],
  );
  const passwordHash = await bcrypt.hash(password, 4);
  const userRows: Array<{ id: string }> = await AppDataSource.query(
    `INSERT INTO users
       (first_name, last_name, work_email, password_hash, role_id, employee_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    ['Integration', 'User', email, passwordHash, roleRows[0].id, employeeRows[0].id],
  );

  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
    .send({ email, password });

  if (login.status !== 200) {
    throw new Error(`Test login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }

  const refreshCookie = login.headers['set-cookie']?.[0];
  if (!refreshCookie) {
    throw new Error('Test login response did not include a refresh-token cookie');
  }

  return {
    id: userRows[0].id,
    employeeId: employeeRows[0].id,
    email,
    password,
    accessToken: login.body.data.accessToken as string,
    refreshCookie,
  };
}