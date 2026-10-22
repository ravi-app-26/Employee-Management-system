import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { createUserByRole } from './helpers';

describe('GET /api/v1/employees sorting', () => {
  it('sorts joined names and emails correctly across paginated results', async () => {
    const admin = await createUserByRole('admin');
    const alpha = await createUserByRole('employee');
    const zulu = await createUserByRole('employee');

    await AppDataSource.query(
      `UPDATE users SET first_name = CASE id
         WHEN $1 THEN 'Alpha'
         WHEN $2 THEN 'Zulu'
       END,
       work_email = CASE id
         WHEN $1 THEN 'alpha-sort@example.test'
         WHEN $2 THEN 'zulu-sort@example.test'
       END
       WHERE id IN ($1, $2)`,
      [alpha.id, zulu.id],
    );

    const firstNamePageOne = await request(app)
      .get('/api/v1/employees?sortBy=firstName&order=asc&page=1&limit=1')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    const firstNamePageTwo = await request(app)
      .get('/api/v1/employees?sortBy=firstName&order=asc&page=2&limit=1')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    const emailDescending = await request(app)
      .get('/api/v1/employees?sortBy=workEmail&order=desc&page=1&limit=1')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(firstNamePageOne.status).toBe(200);
    expect(firstNamePageOne.body.data.data[0]).toMatchObject({
      id: alpha.employeeId,
      firstName: 'Alpha',
    });
    expect(firstNamePageOne.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    });

    expect(firstNamePageTwo.status).toBe(200);
    expect(firstNamePageTwo.body.data.data[0]).toMatchObject({
      id: admin.employeeId,
      firstName: 'Integration',
    });

    expect(emailDescending.status).toBe(200);
    expect(emailDescending.body.data.data[0]).toMatchObject({
      id: zulu.employeeId,
      workEmail: 'zulu-sort@example.test',
    });
  });
});