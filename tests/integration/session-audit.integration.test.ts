import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { createUserByRole } from './helpers';

describe('session audit endpoints', () => {
  it('returns only the authenticated user session history', async () => {
    const user = await createUserByRole('employee');
    const otherUser = await createUserByRole('employee');
    const [{ otherFamilyId }] = await AppDataSource.query(
      'SELECT family_id AS "otherFamilyId" FROM refresh_tokens WHERE user_id = $1',
      [otherUser.id],
    );

    const history = await request(app)
      .get('/api/v1/auth/sessions/history')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(history.status).toBe(200);
    expect(history.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: 'SESSION_CREATED' }),
    ]));
    expect(history.body.data.every((event: { sessionId: string }) => event.sessionId !== otherFamilyId)).toBe(true);
    expect(history.body.data[0]).not.toHaveProperty('userId');
  });

  it('records logout with request correlation and exposes it in own history', async () => {
    const user = await createUserByRole('employee');
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Cookie', user.refreshCookie.split(';', 1)[0]);

    expect(logout.status).toBe(204);
    const history = await AppDataSource.query(
      `SELECT event_type AS "eventType", correlation_id AS "correlationId"
       FROM session_audit_events WHERE user_id = $1 AND event_type = 'LOGOUT'`,
      [user.id],
    );
    expect(history).toHaveLength(1);
    expect(history[0].correlationId).toBeTruthy();
  });

  it('allows only authorized admins to retrieve daily session metrics', async () => {
    const admin = await createUserByRole('admin');
    const employee = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [employee.id],
    );
    await AppDataSource.query(
      `INSERT INTO session_audit_events
         (event_key, user_id, session_id, event_type, occurred_at, processed_at, processing_status)
       VALUES ($1, $2, $3, 'SESSION_EXPIRED', current_date - interval '1 day' + interval '12 hours', now(), 'PROCESSED')`,
      [`test-expiry:${familyId}`, employee.id, familyId],
    );

    const forbidden = await request(app)
      .get('/api/v1/admin/session-metrics?days=7')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(forbidden.status).toBe(403);

    const metrics = await request(app)
      .get('/api/v1/admin/session-metrics?days=7')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ expiredSessions: '1' }),
    ]));
  });
});
