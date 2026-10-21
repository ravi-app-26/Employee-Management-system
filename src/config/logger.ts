import pino, { LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  redact: {
    paths: [
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'token',
      'tokenHash',
      'accessToken',
      'refreshToken',
      'authorization',
      'headers.authorization',
      'req.headers.authorization',
      'request.headers.authorization',
      'cookie',
      'cookies.refresh_token',
      'req.cookies.refresh_token',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.authorization',
    ],
    censor: '[REDACTED]',
  },
};

export const logger = pino(loggerOptions);
