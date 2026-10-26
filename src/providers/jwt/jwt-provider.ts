import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/app-error';
import type { AccessPayload } from '../../interfaces';

export class JwtProvider {
  signAccessToken(payload: AccessPayload): string {
    return jwt.sign({ role: payload.role, employeeId: payload.employeeId }, env.JWT_ACCESS_SECRET, {
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
      }) as jwt.JwtPayload;

      return {
        sub: String(decoded.sub),
        role: String(decoded.role),
        employeeId: String(decoded.employeeId),
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}