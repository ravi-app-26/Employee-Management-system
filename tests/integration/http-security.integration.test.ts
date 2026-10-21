import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createUserByRole } from './helpers';

describe('HTTP security configuration', () => {
  it('returns the CORS header for an allowed origin', async () => {
    const response = await request(app)
      .get('/health/live')
      .set('Origin', 'https://client.example.test');

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://client.example.test',
    );
  });

  it('does not return the CORS header for a disallowed origin', async () => {
    const response = await request(app)
      .get('/health/live')
      .set('Origin', 'https://untrusted.example.test');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('excludes health endpoints from the global rate limit', async () => {
    let response;
    for (let attempt = 0; attempt < 35; attempt += 1) {
      response = await request(app)
        .get('/health/live')
        .set('X-Forwarded-For', '198.51.100.43');
    }

    expect(response?.status).toBe(200);
  });

  it('limits login to eight requests per minute for one client IP', async () => {
    const user = await createUserByRole('employee');
    const clientIp = '198.51.100.42';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', clientIp)
        .send({ email: user.email, password: user.password });

      expect(response.status).toBe(200);
    }

    const limitedResponse = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({ email: user.email, password: user.password });

    expect(limitedResponse.status).toBe(429);
  });
});
