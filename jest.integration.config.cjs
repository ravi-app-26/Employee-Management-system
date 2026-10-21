module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  globalSetup: '<rootDir>/tests/integration/global-setup.cjs',
  setupFiles: ['<rootDir>/tests/integration/setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          '@babel/plugin-transform-class-properties',
        ],
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
};