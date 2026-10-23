module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/routes/auth.routes.test.ts',
    '<rootDir>/src/config/logger.test.ts',
    '<rootDir>/src/services/employee-document.service.test.ts',
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