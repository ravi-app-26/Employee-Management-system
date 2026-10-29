module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/routes/auth.routes.test.ts',
    '<rootDir>/src/config/logger.test.ts',
    '<rootDir>/src/repositories/refresh-token.repository.test.ts',
    '<rootDir>/src/providers/jwt/jwt-provider.test.ts',
    '<rootDir>/src/services/session-expiry-event.service.test.ts',
    '<rootDir>/src/services/session-audit.service.test.ts',
    '<rootDir>/src/providers/redis/session-expiry.subscriber.test.ts',
    '<rootDir>/src/services/employee-document.service.test.ts',
    '<rootDir>/src/services/department.service.test.ts',
    '<rootDir>/src/services/authorization.service.test.ts',
    '<rootDir>/src/services/user.service.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        plugins: [
          ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
          ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          '@babel/plugin-transform-class-properties',
        ],
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
        ],
      },
    ],
  },
};