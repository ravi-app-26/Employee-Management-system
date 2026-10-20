import cookieParser from 'cookie-parser';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../controllers/auth.controller';
import { ErrorHandlerMiddleware } from '../middlewares/error-handler';
import { UnauthorizedError } from '../errors/app-error';
import { AuthService } from '../services/auth.service';
import { AuthorizationService } from '../services/authorization.service';
import { AuthRoutes } from './auth.routes';

jest.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    REFRESH_TOKEN_TTL_DAYS: 7,
    BCRYPT_ROUNDS: 4,
  },
}));

const user = {
  id: 'd9428888-122b-4b20-9e2a-63e4c4a99b7e', 
  role: 'employee',
  employeeId: '5a92a7c2-61ac-4e03-8494-5eb119cd57f1',
};
const sessionId = '3ac25a79-c57a-4baf-b378-65c37a298c90';
const tokens = { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' };

const service = {
  login: jest.fn<() => Promise<typeof tokens>>().mockResolvedValue(tokens),
  refresh: jest.fn<() => Promise<typeof tokens>>().mockResolvedValue(tokens),
  logout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  logoutAll: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  listSessions: jest.fn<() => Promise<{ id: string; createdAt: string; current: boolean }[]>>().mockResolvedValue([
    { id: sessionId, createdAt: '2026-10-19T12:00:00.000Z', current: true },
  ]),
  revokeSession: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  changePassword: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
} as unknown as AuthService;

let isAuthenticated = true;
const authenticate: RequestHandler = (req, _res, next) => {
  if (!isAuthenticated) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  req.user = user;
  next();
};

const app = express();
app.use((req, _res, next) => {
  req.id = 'auth-route-test-request';
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(
  '/api/v1/auth',
  AuthRoutes.create(
    new AuthController(service),
    authenticate,
    {} as AuthorizationService,
  ),
);
app.use(ErrorHandlerMiddleware.handle);

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns an access token and sets the refresh-token cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.test', password: 'correct-password' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { accessToken: tokens.accessToken },
      });
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=mock-refresh-token');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(service.login).toHaveBeenCalledWith('admin@example.test', 'correct-password');
    });

    it('rejects malformed credentials before calling the service', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(service.login).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates the refresh token and returns a new access token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refresh_token=old-refresh-token');

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe(tokens.accessToken);
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=mock-refresh-token');
      expect(service.refresh).toHaveBeenCalledWith('old-refresh-token');
    });

    it('rejects a request without a refresh-token cookie', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(service.refresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes the refresh-token session and clears its cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refresh_token=current-refresh-token');

      expect(response.status).toBe(204);
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
      expect(service.logout).toHaveBeenCalledWith('current-refresh-token');
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it("revokes all of the authenticated user's sessions", async () => {
      const response = await request(app).post('/api/v1/auth/logout-all');

      expect(response.status).toBe(204);
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
      expect(service.logoutAll).toHaveBeenCalledWith(user.id);
    });
  });

  describe('GET /api/v1/auth/sessions', () => {
    it("returns the authenticated user's active sessions", async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Cookie', 'refresh_token=current-refresh-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: [{ id: sessionId, current: true }],
      });
      expect(service.listSessions).toHaveBeenCalledWith(user.id, 'current-refresh-token');
    });

    it('requires authentication', async () => {
      isAuthenticated = false;
      const response = await request(app).get('/api/v1/auth/sessions');

      expect(response.status).toBe(401);
      expect(service.listSessions).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/auth/sessions/:id', () => {
    it('revokes a session belonging to the authenticated user', async () => {
      const response = await request(app).delete(`/api/v1/auth/sessions/${sessionId}`);

      expect(response.status).toBe(204);
      expect(service.revokeSession).toHaveBeenCalledWith(user.id, sessionId);
    });

    it('rejects a malformed session id without calling the service', async () => {
      const response = await request(app).delete('/api/v1/auth/sessions/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(service.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('changes the password and clears the refresh-token cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'old-password', newPassword: 'new-password-123' });

      expect(response.status).toBe(204);
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
      expect(service.changePassword).toHaveBeenCalledWith(
        user.id,
        'old-password',
        'new-password-123',
      );
    });

    it('rejects a new password shorter than the minimum length', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'old-password', newPassword: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(service.changePassword).not.toHaveBeenCalled();
    });
  });
});