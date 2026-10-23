// beforeEach — har test se pehle code chalata hai.
// describe — related tests ko ek group mein rakhta hai.
// expect — result ko check karta hai.
// it — ek test case define karta hai.
// jest — mock functions jaise testing tools deta hai.

// login ke 2, refresh ke 2, sessions ke 2, aur change-password ke 2. Baaki 3 routes ka ek-ek test hai.



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
import * as bcrypt from 'bcrypt';
// Mock environment variables so tests don't depend on the real config.
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
// Fake user used by the authentication middleware in tests.
const user = {
  id: 'd9428888-122b-4b20-9e2a-63e4c4a99b7e',
  role: 'employee',
  employeeId: '5a92a7c2-61ac-4e03-8494-5eb119cd57f1',
};
// Sample session ID and tokens used in test responses.
const sessionId = '3ac25a79-c57a-4baf-b378-65c37a298c90';
const tokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};
const mockLogin = jest
  .fn<(email: string, password: string) => Promise<typeof tokens>>()
  .mockResolvedValue(tokens);
// Mock authentication service methods to avoid calling real business logic.
const service = {
  login: mockLogin,
  refresh: jest.fn<() => Promise<typeof tokens>>().mockResolvedValue(tokens),
  logout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  logoutAll: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),

  //   Promise<typeof tokens> — function ka result ek promise hoga jo tokens jaisi structure wali value dega.
  // mockResolvedValue(tokens) — jab function ko await karoge, to ye fake tokens return karega.
  
  // Return a sample active session.
  listSessions: jest
    .fn<() => Promise<{ id: string; createdAt: string; current: boolean }[]>>()
    .mockResolvedValue([
      {
        id: sessionId,
        createdAt: '2026-10-19T12:00:00.000Z',
        current: true,
      },
    ]),

  revokeSession: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  changePassword: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
} as unknown as AuthService;

// Controls whether the test user is authenticated.
let isAuthenticated = true;

// Fake authentication middleware for testing protected routes.
const authenticate: RequestHandler = (req, _res, next) => {
  if (!isAuthenticated) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  // Attach the test user to the request.
  req.user = user;
  next();
};

// Create an Express app for testing the authentication endpoints.
const app = express();

// Add a fixed request ID to each test request.
app.use((req, _res, next) => {
  req.id = 'auth-route-test-request';
  next();
});

// Parse JSON request bodies and cookies.
app.use(express.json());
app.use(cookieParser());

// Register all authentication routes with the controller and middleware.
app.use(
  '/api/v1/auth',
  AuthRoutes.create(
    new AuthController(service),
    authenticate,
    {} as AuthorizationService,
  ),
);


//for login api without supertest
describe("login service",()=>{
  it("calls the mocked AuthService login function", async()=>{
    mockLogin.mockClear();
    const controller = new AuthController(service);
    const req = {
      body: { email: 'ravi@yopmail.com', password: '123456' },
    };
    const res = {
      req: { id: 'login-test-request' },
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.login(req as never, res as never);

    expect(mockLogin).toHaveBeenCalledWith('ravi@yopmail.com', '123456');
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      tokens.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { accessToken: tokens.accessToken },
      requestId: 'login-test-request',
    });
  })
})

// // Handle errors returned by routes and middleware.
// app.use(ErrorHandlerMiddleware.handle);

// describe('auth routes', () => {
//   // Reset mock call history and authentication state before each test.
//   beforeEach(() => {
//     jest.clearAllMocks();
//     isAuthenticated = true;
//   });

 

//   describe('POST /api/v1/auth/refresh', () => {
//     // A valid refresh token should produce new tokens.
//     it('returns a new access token and refresh token', async () => {
//       const response = await request(app)
//         .post('/api/v1/auth/refresh')
//         .set('Cookie', 'refresh_token=old-refresh-token');

//       expect(response.status).toBe(200);
//       expect(response.body.data.accessToken).toBe(tokens.accessToken);
//       expect(response.headers['set-cookie'][0]).toContain(
//         'refresh_token=mock-refresh-token',
//       );
//       expect(service.refresh).toHaveBeenCalledWith('old-refresh-token');
//     });

//     // Requests without a refresh-token cookie should be rejected.
//     it('rejects requests without a refresh token', async () => {
//       const response = await request(app).post('/api/v1/auth/refresh');

//       expect(response.status).toBe(401);
//       expect(response.body.error.code).toBe('UNAUTHORIZED');
//       expect(service.refresh).not.toHaveBeenCalled();
//     });
//   });

//   describe('POST /api/v1/auth/logout', () => {
//     // Logging out should revoke the current session and clear its cookie.
//     it('logs out and clears the refresh token cookie', async () => {
//       const response = await request(app)
//         .post('/api/v1/auth/logout')
//         .set('Cookie', 'refresh_token=current-refresh-token');

//       expect(response.status).toBe(204);
//       expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
//       expect(service.logout).toHaveBeenCalledWith('current-refresh-token');
//     });
//   });

//   describe('POST /api/v1/auth/logout-all', () => {
//     // Logging out everywhere should revoke all sessions for the current user.
//     it('logs out the user from all sessions', async () => {
//       const response = await request(app).post('/api/v1/auth/logout-all');

//       expect(response.status).toBe(204);
//       expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
//       expect(service.logoutAll).toHaveBeenCalledWith(user.id);
//     });
//   });

//   describe('GET /api/v1/auth/sessions', () => {
//     // The endpoint should return the authenticated user's active sessions.
//     it('returns the user active sessions', async () => {
//       const response = await request(app)
//         .get('/api/v1/auth/sessions')
//         .set('Cookie', 'refresh_token=current-refresh-token');

//       expect(response.status).toBe(200);
//       expect(response.body).toMatchObject({
//         success: true,
//         data: [{ id: sessionId, current: true }],
//       });
//       expect(service.listSessions).toHaveBeenCalledWith(
//         user.id,
//         'current-refresh-token',
//       );
//     });

//     // Unauthenticated users should not be allowed to view their sessions.
//     it('rejects unauthenticated requests', async () => {
//       isAuthenticated = false;

//       const response = await request(app).get('/api/v1/auth/sessions');

//       expect(response.status).toBe(401);
//       expect(service.listSessions).not.toHaveBeenCalled();
//     });
//   });

//   describe('DELETE /api/v1/auth/sessions/:id', () => {
//     // A valid session ID should be passed to the service for revocation.
//     it('revokes a session belonging to the user', async () => {
//       const response = await request(app).delete(
//         `/api/v1/auth/sessions/${sessionId}`,
//       );

//       expect(response.status).toBe(204);
//       expect(service.revokeSession).toHaveBeenCalledWith(user.id, sessionId);
//     });

//     // Malformed session IDs should be rejected without calling the service.
//     it('rejects an invalid session ID', async () => {
//       const response = await request(app).delete(
//         '/api/v1/auth/sessions/not-a-uuid',
//       );

//       expect(response.status).toBe(400);
//       expect(response.body.error.code).toBe('BAD_REQUEST');
//       expect(service.revokeSession).not.toHaveBeenCalled();
//     });
//   });

//   describe('POST /api/v1/auth/change-password', () => {
//     // A valid password change should clear the refresh-token cookie.
//     it('changes the password and clears the refresh token cookie', async () => {
//       const response = await request(app)
//         .post('/api/v1/auth/change-password')
//         .send({
//           currentPassword: 'old-password',
//           newPassword: 'new-password-123',
//         });

//       expect(response.status).toBe(204);
//       expect(response.headers['set-cookie'][0]).toContain('refresh_token=;');
//       expect(service.changePassword).toHaveBeenCalledWith(
//         user.id,
//         'old-password',
//         'new-password-123',
//       );
//     });

//     // Passwords shorter than the minimum allowed length should be rejected.
//     it('rejects a password that is too short', async () => {
//       const response = await request(app)
//         .post('/api/v1/auth/change-password')
//         .send({
//           currentPassword: 'old-password',
//           newPassword: 'short',
//         });

//       expect(response.status).toBe(400);
//       expect(response.body.error.code).toBe('VALIDATION_ERROR');
//       expect(service.changePassword).not.toHaveBeenCalled();
//     });
//   });
// });
