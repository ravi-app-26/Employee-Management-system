import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppDataSource } from '../../src/config/database';
import { app } from '../../src/app';
import { redisClient } from '../../src/providers/redis/redis.provider';
import { sessionKey } from '../../src/providers/redis/session-cache.keys';
import { createUserByRole } from './helpers';

async function auditRows(action: string, resourceId: string) {
  return AppDataSource.query(
    `SELECT actor_user_id AS "actorUserId", action, resource_type AS "resourceType",
            resource_id AS "resourceId", request_id AS "requestId"
     FROM audit_logs WHERE action = $1 AND resource_id = $2 ORDER BY timestamp DESC`,
    [action, resourceId],
  ) as Promise<Array<Record<string, string>>>;
}

describe('user administration and own data export', () => {
  it('allows only admins to assign roles and audits the target user', async () => {
    const admin = await createUserByRole('admin');
    const employee = await createUserByRole('employee');

    const allowed = await request(app)
      .patch(`/api/v1/users/${employee.id}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'hr' });

    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toEqual({ id: employee.id, role: 'hr' });
    expect(await auditRows('user.role.assign', employee.id)).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: 'user.role.assign',
        resourceType: 'user',
        resourceId: employee.id,
      }),
    ]);

    const forbidden = await request(app)
      .patch(`/api/v1/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ role: 'admin' });

    expect(forbidden.status).toBe(403);
  });

  it('allows admins to revoke another user sessions and audits the target', async () => {
    const admin = await createUserByRole('admin');
    const employee = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [employee.id],
    );

    const allowed = await request(app)
      .post(`/api/v1/users/${employee.id}/sessions/revoke`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(allowed.status).toBe(204);
    expect(await redisClient.get(sessionKey(familyId))).toBeNull();
    const revokedAccess = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(revokedAccess.status).toBe(401);
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', employee.refreshCookie.split(';', 1)[0]);
    expect(refresh.status).toBe(401);
    const activeTokens = await AppDataSource.query(
      'SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [employee.id],
    );
    expect(activeTokens).toHaveLength(0);
    expect(await auditRows('session.revoke_any', employee.id)).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: 'session.revoke_any',
        resourceType: 'user',
        resourceId: employee.id,
      }),
    ]);

    const otherEmployee = await createUserByRole('employee');
    const forbidden = await request(app)
      .post(`/api/v1/users/${admin.id}/sessions/revoke`)
      .set('Authorization', `Bearer ${otherEmployee.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('exports only the authenticated user data and audits the employee target', async () => {
    const employee = await createUserByRole('employee');

    const allowed = await request(app)
      .get('/api/v1/me/export')
      .set('Authorization', `Bearer ${employee.accessToken}`);

    expect(allowed.status).toBe(200);
    expect(allowed.body.data.user).toMatchObject({
      id: employee.id,
      email: employee.email,
      role: 'employee',
    });
    expect(allowed.body.data.employee.id).toBe(employee.employeeId);
    expect(JSON.stringify(allowed.body)).not.toContain('passwordHash');
    expect(await auditRows('profile.export_own', employee.employeeId)).toEqual([
      expect.objectContaining({
        actorUserId: employee.id,
        action: 'profile.export_own',
        resourceType: 'employee',
        resourceId: employee.employeeId,
      }),
    ]);

    const unprivileged = await createUserByRole('guest');
    const forbidden = await request(app)
      .get('/api/v1/me/export')
      .set('Authorization', `Bearer ${unprivileged.accessToken}`);
    expect(forbidden.status).toBe(403);
  });
});