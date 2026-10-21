import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
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

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: employee.email, password: employee.password });
    expect(loginResponse.status).toBe(401);

    const existingTokenResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(existingTokenResponse.status).toBe(401);
  });
});