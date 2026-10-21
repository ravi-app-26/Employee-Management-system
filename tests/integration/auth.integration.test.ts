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
});