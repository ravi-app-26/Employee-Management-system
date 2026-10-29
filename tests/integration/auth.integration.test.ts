import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { redisClient } from '../../src/providers/redis/redis.provider';
import { refreshTokenKey, sessionKey } from '../../src/providers/redis/session-cache.keys';
import { createUserByRole } from './helpers';

describe('authentication integration', () => {
  it('logs in a real database user and returns usable access credentials', async () => {
    const user = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    const payload = jwt.decode(user.accessToken) as jwt.JwtPayload;

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
    expect(payload.familyId).toBe(familyId);
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
    const reuseEvents = await AppDataSource.query(
      `SELECT id FROM session_audit_events
       WHERE user_id = $1 AND event_type = 'REFRESH_TOKEN_REUSE_DETECTED'`,
      [user.id],
    );
    expect(reuseEvents).toHaveLength(1);
  });

  it('rejects an expired refresh token without issuing a replacement', async () => {
    const user = await createUserByRole('employee');
    const refreshCookie = user.refreshCookie.split(';', 1)[0];
    await AppDataSource.query(
      'UPDATE refresh_tokens SET expires_at = clock_timestamp() - interval \'1 millisecond\' WHERE user_id = $1',
      [user.id],
    );

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refresh.status).toBe(401);
    const tokens = await AppDataSource.query(
      'SELECT id FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    expect(tokens).toHaveLength(1);
  });

  it('logout-all revokes refresh tokens and clears Redis session cache', async () => {
    const user = await createUserByRole('employee');
    const rawRefresh = user.refreshCookie.match(/refresh_token=([^;]+)/)?.[1];
    expect(rawRefresh).toBeDefined();
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );

    const logout = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(logout.status).toBe(204);
    expect(await redisClient.get(sessionKey(familyId))).toBeNull();
    const access = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(access.status).toBe(401);
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${rawRefresh}`);
    expect(refresh.status).toBe(401);
  });

  it('rejects a revoked refresh token even when Redis holds a stale token record', async () => {
    const user = await createUserByRole('employee');
    const rawRefresh = user.refreshCookie.match(/refresh_token=([^;]+)/)?.[1];
    expect(rawRefresh).toBeDefined();
    const [{ tokenHash, familyId }] = await AppDataSource.query(
      'SELECT token_hash AS "tokenHash", family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    const cached = await redisClient.get(refreshTokenKey(tokenHash));
    expect(cached).not.toBeNull();

    await AppDataSource.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1',
      [user.id],
    );
    await redisClient.set(sessionKey(familyId), '1', { EX: 60 });

    const access = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(access.status).toBe(401);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${rawRefresh}`);
    expect(refresh.status).toBe(401);
  });

  it('rejects refresh after Redis becomes unavailable', async () => {
    const user = await createUserByRole('employee');
    const rawRefresh = user.refreshCookie.match(/refresh_token=([^;]+)/)?.[1];
    expect(rawRefresh).toBeDefined();
    await AppDataSource.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1',
      [user.id],
    );

    await redisClient.disconnect();
    try {
      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${rawRefresh}`);
      expect(refresh.status).toBe(401);
      const access = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(access.status).toBe(401);
    } finally {
      await redisClient.connect();
    }
  });
});
