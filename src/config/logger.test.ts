import { describe, expect, it } from '@jest/globals';
import pino from 'pino';
import { Writable } from 'node:stream';
import { loggerOptions } from './logger';

describe('logger secret redaction', () => {
  it('redacts credentials, access tokens, refresh tokens, and authorization headers', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = pino(loggerOptions, destination);

    logger.info({
      password: 'plain-password',
      currentPassword: 'old-password',
      token: 'opaque-token',
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      authorization: 'Bearer header-secret',
      headers: { authorization: 'Bearer nested-header-secret' },
      req: {
        headers: { authorization: 'Bearer request-header-secret' },
        cookies: { refresh_token: 'cookie-refresh-secret' },
        body: {
          password: 'request-body-password',
          refreshToken: 'request-body-refresh-token',
        },
      },
      request: { body: { accessToken: 'nested-access-token' } },
    });

    expect(output).not.toContain('plain-password');
    expect(output).not.toContain('old-password');
    expect(output).not.toContain('opaque-token');
    expect(output).not.toContain('access-secret');
    expect(output).not.toContain('refresh-secret');
    expect(output).not.toContain('header-secret');
    expect(output).not.toContain('cookie-refresh-secret');
    expect(output).not.toContain('request-body-password');
    expect(output).not.toContain('request-body-refresh-token');
    expect(output).not.toContain('nested-access-token');
    expect(output).toContain('[REDACTED]');
  });
});
