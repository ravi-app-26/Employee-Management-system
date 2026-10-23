import { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors/app-error';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/api-response';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const clearCookieOptions: CookieOptions = { ...cookieOptions, maxAge: undefined };

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response) => {
    const user = await this.service.register(req.body, req.user!.id, req.id);
    ApiResponse.created(res, user);
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const tokens = await this.service.login(email, password);

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    ApiResponse.ok(res, { accessToken: tokens.accessToken });
  };

  refresh = async (req: Request, res: Response) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedError('Invalid refresh token');

    const tokens = await this.service.refresh(raw);

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    ApiResponse.ok(res, { accessToken: tokens.accessToken });
  };

  logout = async (req: Request, res: Response) => {
    await this.service.logout(req.cookies?.[REFRESH_COOKIE]);

    res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    ApiResponse.noContent(res);
  };

  me = async (req: Request, res: Response) => {
    ApiResponse.ok(res, req.user);
  };

  sessions = async (req: Request, res: Response) => {
    const data = await this.service.listSessions(
      req.user!.id,
      req.cookies?.[REFRESH_COOKIE],
    );
    ApiResponse.ok(res, data);
  };

  revokeSession = async (req: Request, res: Response) => {
    await this.service.revokeSession(req.user!.id, String(req.params.id));
    ApiResponse.noContent(res);
  };

  logoutAll = async (req: Request, res: Response) => {
    await this.service.logoutAll(req.user!.id);

    res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    ApiResponse.noContent(res);
  };

  changePassword = async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await this.service.changePassword(req.user!.id, currentPassword, newPassword);

    res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    ApiResponse.noContent(res);
  };
}