/**
 * Jest Setup File
 * Runs before each test file
 */

import 'reflect-metadata';

// Preserve original console for warnings/errors while silencing verbose output
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug
  info: jest.fn(), // Mock console.info
  warn: originalConsole.warn, // Keep warnings for important issues
  error: originalConsole.error, // Keep errors for debugging
};

// Jest globals are available when running under Jest; declare for the TypeScript checker
declare const jest: any;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test_user:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock timers for faster tests (optional)
// jest.useFakeTimers();

// Create a robust logger mock that handles all cases
// IMPORTANT: default and logger must reference the SAME object so that
// source code using `import { logger }` (named) and test code using
// `import logger` (default) share the same jest.fn() instances.
const createLoggerMock = () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    trace: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
    logger: mockLogger,
  };
};

// Mock sharp to avoid native binary requirement in CI
jest.mock('sharp', () => {
  const pipeline = {
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, format: 'png' }),
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image')),
    toFormat: jest.fn().mockReturnThis(),
  };
  const sharpFn = jest.fn(() => pipeline);
  return { __esModule: true, default: sharpFn };
});

// Setup common mocks - path relative to backend root
// Mock the project's logger module in a shape that matches common imports
jest.mock('./src/utils/logger', () => createLoggerMock());

// Also mock winston to handle indirect dependencies
jest.mock('winston', () => {
  const mockTransport = {
    silent: false,
  };
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    trace: jest.fn(),
    transports: [mockTransport], // auditLogger.transports is an array
  };
  return {
    createLogger: jest.fn(() => mockLogger),
    // `format` is callable in real winston (winston.format(fn)) AND carries the
    // helper methods below. Keep both so modules that build a custom format at
    // load time (e.g. logRedaction) work under test.
    format: Object.assign(
      jest.fn(transform => jest.fn(options => ({ transform, options }))),
      {
        combine: jest.fn(formats => formats),
        timestamp: jest.fn(() => ({})),
        errors: jest.fn(() => ({})),
        splat: jest.fn(() => ({})),
        json: jest.fn(() => ({})),
        colorize: jest.fn(() => ({})),
        printf: jest.fn(fn => fn),
      }
    ),
    transports: {
      Console: jest.fn(function () {
        this.silent = false;
      }),
      File: jest.fn(function () {
        this.silent = false;
      }),
    },
  };
});
