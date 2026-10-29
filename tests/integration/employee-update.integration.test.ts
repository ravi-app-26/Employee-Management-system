import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { redisClient } from '../../src/providers/redis/redis.provider';
import { sessionKey } from '../../src/providers/redis/session-cache.keys';
import { createUserByRole } from './helpers';

describe('PATCH /api/v1/employees/:id role restrictions', () => {
  it('forbids a manager from editing their own employment record', async () => {
    const manager = await createUserByRole('manager');

    const response = await request(app)
      .patch(`/api/v1/employees/${manager.employeeId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ jobTitle: 'Updated title' });

    expect(response.status).toBe(403);
  });

  it('allows a manager to edit permitted fields for a team member', async () => {
    const manager = await createUserByRole('manager');
    const teamMember = await createUserByRole('employee', {
      managerId: manager.employeeId,
    });

    const response = await request(app)
      .patch(`/api/v1/employees/${teamMember.employeeId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ firstName: 'Updated', jobTitle: 'Senior Engineer' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      firstName: 'Updated',
      jobTitle: 'Senior Engineer',
    });
    const audit = await AppDataSource.query(
      `SELECT actor_user_id AS "actorUserId", action, resource_type AS "resourceType",
              resource_id AS "resourceId"
       FROM audit_logs WHERE action = 'employee.update' AND resource_id = $1`,
      [teamMember.employeeId],
    );
    expect(audit).toEqual([
      expect.objectContaining({
        actorUserId: manager.id,
        action: 'employee.update',
        resourceType: 'employee',
        resourceId: teamMember.employeeId,
      }),
    ]);
  });

  it('rejects manager updates containing fields outside the team-member schema', async () => {
    const manager = await createUserByRole('manager');
    const teamMember = await createUserByRole('employee', {
      managerId: manager.employeeId,
    });

    const response = await request(app)
      .patch(`/api/v1/employees/${teamMember.employeeId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({
        departmentId: 'b09e85a9-e9f9-4cef-84e6-ae613de38dc2',
        employmentStatus: 'inactive',
        managerId: manager.employeeId,
        workEmail: 'changed@example.test',
      });

    expect(response.status).toBe(400);
  });

  it('continues to allow an admin to edit employment fields', async () => {
    const admin = await createUserByRole('admin');
    const employee = await createUserByRole('employee');

    const response = await request(app)
      .patch(`/api/v1/employees/${employee.employeeId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ employmentStatus: 'inactive' });

    expect(response.status).toBe(200);
    expect(response.body.data.employmentStatus).toBe('inactive');

    const deactivateAudit = await AppDataSource.query(
      `SELECT actor_user_id AS "actorUserId", action, resource_type AS "resourceType",
              resource_id AS "resourceId"
       FROM audit_logs WHERE action = 'employee.deactivate' AND resource_id = $1`,
      [employee.employeeId],
    );
    expect(deactivateAudit).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: 'employee.deactivate',
        resourceType: 'employee',
        resourceId: employee.employeeId,
      }),
    ]);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: employee.email, password: employee.password });
    expect(loginResponse.status).toBe(401);

    const existingTokenResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(existingTokenResponse.status).toBe(401);
  });

  it('allows an admin to deactivate an employee login and audits the target', async () => {
    const admin = await createUserByRole('admin');
    const employee = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [employee.id],
    );

    const response = await request(app)
      .delete(`/api/v1/employees/${employee.employeeId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(204);
    expect(await redisClient.get(sessionKey(familyId))).toBeNull();
    const revokedAccess = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(revokedAccess.status).toBe(401);
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', employee.refreshCookie.split(';', 1)[0]);
    expect(refresh.status).toBe(401);
    const users = await AppDataSource.query(
      'SELECT is_active AS "isActive" FROM users WHERE id = $1',
      [employee.id],
    );
    expect(users).toEqual([{ isActive: false }]);

    const audit = await AppDataSource.query(
      `SELECT actor_user_id AS "actorUserId", action, resource_type AS "resourceType",
              resource_id AS "resourceId"
       FROM audit_logs WHERE action = 'employee.deactivate' AND resource_id = $1`,
      [employee.employeeId],
    );
    expect(audit).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: 'employee.deactivate',
        resourceType: 'employee',
        resourceId: employee.employeeId,
      }),
    ]);
  });

  it.each(['manager', 'employee'])(
    'denies %s deactivation of an out-of-scope employee without writing an audit row',
    async (role) => {
      const caller = await createUserByRole(role);
      const target = await createUserByRole('employee');

      const response = await request(app)
        .delete(`/api/v1/employees/${target.employeeId}`)
        .set('Authorization', `Bearer ${caller.accessToken}`);

      expect(response.status).toBe(403);
      const audit = await AppDataSource.query(
        `SELECT id FROM audit_logs
         WHERE action = 'employee.deactivate' AND resource_id = $1`,
        [target.employeeId],
      );
      expect(audit).toHaveLength(0);
      const users = await AppDataSource.query(
        'SELECT is_active AS "isActive" FROM users WHERE id = $1',
        [target.id],
      );
      expect(users).toEqual([{ isActive: true }]);
    },
  );
});