import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppDataSource } from '../../src/config/database';
import { app } from '../../src/app';
import { createUserByRole } from './helpers';

async function addDepartments(names: string[]): Promise<void> {
  for (const name of names) {
    await AppDataSource.query('INSERT INTO departments (name) VALUES ($1)', [name]);
  }
}

describe('GET /api/v1/departments sorting', () => {
  it('sorts by allowlisted fields in ascending and descending order', async () => {
    const admin = await createUserByRole('admin');
    await addDepartments(['Zebra', 'Alpha', 'Middle']);

    const ascending = await request(app)
      .get('/api/v1/departments?sortBy=name&order=asc&limit=100')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(ascending.status).toBe(200);
    expect(ascending.body.data.data.map((department: { name: string }) => department.name)).toEqual(
      [...ascending.body.data.data.map((department: { name: string }) => department.name)].sort(),
    );

    const descending = await request(app)
      .get('/api/v1/departments?sortBy=name&order=desc&limit=100')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(descending.status).toBe(200);
    expect(descending.body.data.data.map((department: { name: string }) => department.name)).toEqual(
      [...ascending.body.data.data.map((department: { name: string }) => department.name)].reverse(),
    );
  });

  it('rejects sorting fields outside the allowlist', async () => {
    const admin = await createUserByRole('admin');
    const response = await request(app)
      .get('/api/v1/departments?sortBy=description')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
