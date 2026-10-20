module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/routes/auth.routes.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        plugins: [['@babel/plugin-proposal-decorators', { version: 'legacy' }]],
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
};