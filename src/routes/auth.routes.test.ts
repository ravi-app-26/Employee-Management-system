import cookieParser from 'cookie-parser';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../controllers';
import { ErrorHandlerMiddleware } from '../middlewares';
import { UnauthorizedError } from '../errors/app-error';
import { AuthService, AuthorizationService } from '../services';
import { AuthRoutes } from './auth.routes';

jest.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    REFRESH_TOKEN_TTL_DAYS: 7,
    BCRYPT_ROUNDS: 4,
    JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-thirty-two-characters',
    JWT_ACCESS_TTL: '15m',
    JWT_ISSUER: 'ems-api-test',
    JWT_AUDIENCE: 'ems-client-test',
  },
}));

const user = {
  id: 'd9428888-122b-4b20-9e2a-63e4c4a99b7e',
  role: 'employee',
  employeeId: '5a92a7c2-61ac-4e03-8494-5eb119cd57f1',
};
const tokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};
const service = {
  login: jest.fn<(...args: any[]) => Promise<typeof tokens>>().mockResolvedValue(tokens),
  refresh: jest.fn<(...args: any[]) => Promise<typeof tokens>>().mockResolvedValue(tokens),
  logout: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  logoutAll: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  listSessions: jest.fn<(...args: any[]) => Promise<never[]>>().mockResolvedValue([]),
  revokeSession: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  changePassword: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
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
  AuthRoutes.create(new AuthController(service), authenticate, {} as AuthorizationService),
);
app.use(ErrorHandlerMiddleware.handle);

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
  });

  it('logs in and returns the access token while setting a refresh cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ravi@yopmail.com', password: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe(tokens.accessToken);
    expect(response.headers['set-cookie'][0]).toContain('refresh_token=mock-refresh-token');
    expect(service.login).toHaveBeenCalledWith('ravi@yopmail.com', '123456');
  });

  it('rejects refresh requests without a refresh-token cookie', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('rejects protected routes when the request is unauthenticated', async () => {
    isAuthenticated = false;
    const response = await request(app).get('/api/v1/auth/sessions');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(service.listSessions).not.toHaveBeenCalled();
  });
});
