import { describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/database';
import { SessionExpirySubscriber } from '../../src/providers/redis/session-expiry.subscriber';
import { sessionKey } from '../../src/providers/redis/session-cache.keys';
import { redisClient } from '../../src/providers/redis/redis.provider';
import { RefreshTokenRepository } from '../../src/repositories/refresh-token.repository';
import { SessionExpiryEventService } from '../../src/services/session-expiry-event.service';
import { createUserByRole } from './helpers';

async function waitForEvent(spy: jest.SpiedFunction<SessionExpiryEventService['handleExpiredKey']>) {
  const deadline = Date.now() + 5000;
  while (spy.mock.calls.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('Redis session expiry handling', () => {
  it('subscribes to expiry events and restores a still-active family marker from PostgreSQL', async () => {
    const user = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    const service = new SessionExpiryEventService(new RefreshTokenRepository(AppDataSource));
    const handler = jest.spyOn(service, 'handleExpiredKey');
    const subscriber = new SessionExpirySubscriber();

    try {
      expect(await subscriber.start(service)).toBe(true);
      await redisClient.set(sessionKey(familyId), '1', { EX: 1 });
      await waitForEvent(handler);

      expect(handler).toHaveBeenCalledWith(sessionKey(familyId), expect.any(Date));
      await handler.mock.results[0].value;
      expect(await redisClient.ttl(sessionKey(familyId))).toBeGreaterThan(60);
    } finally {
      await subscriber.stop();
      handler.mockRestore();
    }
  });

  it('reconciliation cleans Redis state for revoked sessions after a missed event', async () => {
    const user = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    await AppDataSource.query(
      'UPDATE refresh_tokens SET revoked_at = clock_timestamp() WHERE user_id = $1',
      [user.id],
    );
    await redisClient.set(sessionKey(familyId), '1', { EX: 300 });

    const service = new SessionExpiryEventService(new RefreshTokenRepository(AppDataSource));
    const result = await service.reconcileStaleSessions();

    expect(result.families).toBe(1);
    expect(await redisClient.get(sessionKey(familyId))).toBeNull();
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.refreshCookie.split(';', 1)[0]);
    expect(refresh.status).toBe(401);
  });

  it('records a natural session expiry in PostgreSQL during reconciliation', async () => {
    const user = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    await AppDataSource.query(
      `UPDATE refresh_tokens SET expires_at = clock_timestamp() - interval '1 second'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id],
    );

    const service = new SessionExpiryEventService(new RefreshTokenRepository(AppDataSource));
    await service.reconcileStaleSessions();
    await service.reconcileStaleSessions();

    const expiredEvents = await AppDataSource.query(
      `SELECT id FROM session_audit_events
       WHERE session_id = $1 AND event_type = 'SESSION_EXPIRED'`,
      [familyId],
    );
    expect(expiredEvents).toHaveLength(1);
  });

  it('does not restore session markers for inactive users with an unexpired token row', async () => {
    const user = await createUserByRole('employee');
    const [{ familyId }] = await AppDataSource.query(
      'SELECT family_id AS "familyId" FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    await AppDataSource.query('UPDATE users SET is_active = FALSE WHERE id = $1', [user.id]);
    await redisClient.set(sessionKey(familyId), '1', { EX: 300 });

    const service = new SessionExpiryEventService(new RefreshTokenRepository(AppDataSource));
    const result = await service.reconcileStaleSessions();

    expect(result.families).toBe(1);
    expect(await redisClient.get(sessionKey(familyId))).toBeNull();
  });
});
