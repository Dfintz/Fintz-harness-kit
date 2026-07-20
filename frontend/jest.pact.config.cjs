module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/pact/**/*.pact.test.ts'],
  transform: {
    '^.+\\.ts$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 60000, // 60 seconds for Pact tests
  verbose: true,
  maxWorkers: 1, // Run tests sequentially to avoid port conflicts
};
