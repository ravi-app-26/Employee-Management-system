import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/app-error';
import type { AccessPayload } from '../../interfaces';

export class JwtProvider {
  signAccessToken(payload: AccessPayload): string {
    return jwt.sign({
      role: payload.role,
      employeeId: payload.employeeId,
      familyId: payload.familyId,
    }, env.JWT_ACCESS_SECRET, {
      subject: payload.sub,
      expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(token: string): AccessPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ['HS256'],
        clockTolerance: 0,
      }) as jwt.JwtPayload;

      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.role !== 'string' ||
        typeof decoded.employeeId !== 'string' ||
        typeof decoded.familyId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.familyId)
      ) {
        throw new Error('Invalid access-token claims');
      }

      return {
        sub: decoded.sub,
        role: decoded.role,
        employeeId: decoded.employeeId,
        familyId: decoded.familyId,
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}