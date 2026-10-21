import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createUserByRole } from './helpers';

describe('authentication integration', () => {
  it('logs in a real database user and returns usable access credentials', async () => {
    const user = await createUserByRole('employee');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: user.id,
        role: 'employee',
        employeeId: user.employeeId,
      },
    });
    expect(user.refreshCookie).toContain('refresh_token=');
  });

  it('allows only one of two simultaneous refreshes and rejects token reuse', async () => {
    const user = await createUserByRole('employee');
    const refreshCookie = user.refreshCookie.split(';', 1)[0];

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.find((response) => response.status === 401)?.body.error.code).toBe(
      'UNAUTHORIZED',
    );
  });
});
