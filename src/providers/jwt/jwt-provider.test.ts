import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/app-error';
import { JwtProvider } from './jwt-provider';

describe('JwtProvider strict expiration', () => {
  it('rejects a JWT whose expiry is already reached', () => {
    const token = jwt.sign(
      {
        role: 'employee',
        employeeId: '5a92a7c2-61ac-4e03-8494-5eb119cd57f1',
        familyId: 'd9428888-122b-4b20-9e2a-63e4c4a99b7e',
      },
      env.JWT_ACCESS_SECRET,
      {
        subject: 'd9428888-122b-4b20-9e2a-63e4c4a99b7e',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithm: 'HS256',
        expiresIn: -1,
      },
    );

    expect(() => new JwtProvider().verifyAccessToken(token)).toThrow(UnauthorizedError);
  });
});
