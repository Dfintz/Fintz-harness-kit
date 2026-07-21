module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.helper\\.ts$',
    '/helpers/',
    '/utils/mockFactory',
    '/setup/',
  ],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 33,
      functions: 35,
      lines: 40,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.+/)*utils/logger$': '<rootDir>/src/__mocks__/logger.ts',
    '^@sc-fleet-manager/shared-types$': '<rootDir>/../packages/shared-types/src/index.ts',
    '^@sc-fleet-manager/shared-types/(.*)$': '<rootDir>/../packages/shared-types/src/$1',
    '^@sc-fleet-manager/test-utils$': '<rootDir>/../packages/test-utils/src/index.ts',
    '^@sc-fleet-manager/test-utils/(.*)$': '<rootDir>/../packages/test-utils/src/$1',
    // Resolve ESM .js extensions to .ts for relative imports within shared-types
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  verbose: false, // Less output = faster
  testTimeout: 5000,
  // Use forceExit to ensure Jest doesn't hang, but don't let it fail the process
  forceExit: true,
  // Run tests in parallel but with lower concurrency for stability
  maxWorkers: '50%', // Use 50% of CPU cores
  globalTeardown: undefined,
  // Cache results for faster reruns
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};
