import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppDataSource } from '../../src/config/database';
import { app } from '../../src/app';
import { createUserByRole } from './helpers';

describe('employee DTO responses', () => {
  it('returns only public employee fields and omits persistence internals', async () => {
    const admin = await createUserByRole('admin');
    const departments: Array<{ id: string }> = await AppDataSource.query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING id',
      [`DTO ${crypto.randomUUID()}`],
    );

    const response = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        firstName: 'Public',
        lastName: 'DTO',
        workEmail: `dto-${crypto.randomUUID()}@example.test`,
        departmentId: departments[0].id,
        jobTitle: 'Engineer',
      });

    expect(response.status).toBe(201);
    expect(Object.keys(response.body.data).sort()).toEqual([
      'createdAt',
      'departmentId',
      'employmentStatus',
      'firstName',
      'id',
      'jobTitle',
      'joiningDate',
      'lastName',
      'managerId',
      'phone',
      'updatedAt',
      'workEmail',
    ]);
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('roleId');
    expect(response.body.data).not.toHaveProperty('user');
  });
});
