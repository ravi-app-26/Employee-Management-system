import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { createUserByRole } from './helpers';

async function createDepartment(): Promise<string> {
  const rows: Array<{ id: string }> = await AppDataSource.query(
    'INSERT INTO departments (name) VALUES ($1) RETURNING id',
    [`Create Test ${crypto.randomUUID()}`],
  );
  return rows[0].id;
}

describe('POST /api/v1/employees', () => {
  it('creates an employee whose name and email appear in the list', async () => {
    const admin = await createUserByRole('admin');
    const departmentId = await createDepartment();
    const workEmail = `new-employee-${crypto.randomUUID()}@example.test`;

    const createResponse = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        firstName: 'Nora',
        lastName: 'Patel',
        workEmail,
        departmentId,
        jobTitle: 'QA Engineer',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({
      firstName: 'Nora',
      lastName: 'Patel',
      workEmail,
    });

    const listResponse = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstName: 'Nora',
          lastName: 'Patel',
          workEmail,
        }),
      ]),
    );
  });

  it('returns 409 when creating an email that exists with different casing', async () => {
    const admin = await createUserByRole('admin');
    const departmentId = await createDepartment();
    const workEmail = `duplicate-${crypto.randomUUID()}@example.test`;
    const payload = {
      firstName: 'First',
      lastName: 'Employee',
      departmentId,
      jobTitle: 'Engineer',
    };

    const firstResponse = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ ...payload, workEmail });

    expect(firstResponse.status).toBe(201);

    const duplicateResponse = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ ...payload, workEmail: workEmail.toUpperCase() });

    expect(duplicateResponse.status).toBe(409);
  });
});
