import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { env } from '../config/env';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/app-error';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessPayload {
  sub: string;
  role: string;
  employeeId: string;
}

// User na mile tab bhi bcrypt chalane ke liye (timing attack se bachav)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-not-used', env.BCRYPT_ROUNDS);

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  // ---------- helpers ----------

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(payload: AccessPayload): string {
    return jwt.sign({ role: payload.role, employeeId: payload.employeeId }, env.JWT_ACCESS_SECRET, {
      subject: payload.sub,
      expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: 'HS256',
    });
  }

  private async issueRefreshToken(userId: string, familyId: string): Promise<string> {
    const token = randomBytes(48).toString('hex'); // asli token, sirf client ko jayega
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.refreshTokens.create({
      userId,
      tokenHash: this.hashToken(token), // DB me sirf hash
      familyId,
      expiresAt,
    });
    return token;
  }

  // Middleware bhi ise use karega
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

  isActive(userId: string): Promise<boolean> {
    return this.users.isActive(userId);
  }

  // ---------- use cases ----------

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findByEmailWithPassword(email);

    // User na ho tab bhi compare chalega
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    // Hamesha ek hi generic message, pata na chale email exist karta hai ya nahi
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = this.signAccessToken({
      sub: user.id,
      role: user.role.name,
      employeeId: user.employeeId,
    });
    const refreshToken = await this.issueRefreshToken(user.id, randomUUID()); // naya login = nayi family

    return { accessToken, refreshToken };
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokens.findByHash(this.hashToken(rawToken));

    if (!stored) throw new UnauthorizedError('Invalid refresh token');

    // REUSE DETECTION: revoke ho chuka token dobara aaya, matlab chori ho sakta hai
    if (stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Revoke the old token and persist its replacement atomically.
    const refreshToken = randomBytes(48).toString('hex');
    const rotated = await this.refreshTokens.rotate(stored.id, stored.familyId, {
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    if (!rotated) throw new UnauthorizedError('Invalid refresh token');

    const accessToken = this.signAccessToken({
      sub: user.id,
      role: user.role.name,
      employeeId: user.employeeId,
    });

    return { accessToken, refreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokens.findByHash(this.hashToken(rawToken));
    if (stored) await this.refreshTokens.revokeFamily(stored.familyId);
  }

  async listSessions(userId: string, rawToken?: string) {
    const current = rawToken
      ? await this.refreshTokens.findByHash(this.hashToken(rawToken))
      : null;
    const sessions = await this.refreshTokens.listActiveSessions(userId);
    return sessions.map((session) => ({
      ...session,
      current: session.id === current?.familyId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.refreshTokens.revokeSession(userId, sessionId);
    if (!revoked) throw new NotFoundError('Session not found');
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user || !user.isActive || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestError('New password must differ from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await this.users.updatePassword(userId, passwordHash);
    await this.refreshTokens.revokeAllForUser(userId);
  }

    async register(
      input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    departmentId: string;
    jobTitle: string;
    },
    actorUserId: string,
    requestId: string,
  ): Promise<{ id: string; email: string }> {
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    // Role hardcoded hai, client role nahi chun sakta
    const user = await this.users.createEmployeeWithUser({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      departmentId: input.departmentId,
      jobTitle: input.jobTitle,
      passwordHash,
      roleName: 'employee',
      audit: {
        actorUserId,
        action: 'employee.create',
        resourceType: 'employee',
        requestId,
      },
    });

    return { id: user.id, email: user.email };
  }
}