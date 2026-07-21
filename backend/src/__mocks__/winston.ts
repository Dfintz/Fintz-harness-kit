/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
/**
 * Jest manual mock for winston module
 * Jest automatically uses files in __mocks__ directories - requires any/Function for mock compatibility
 */

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
  transports: [mockTransport],
};

module.exports = {
  createLogger: jest.fn(() => mockLogger),
  // `format` is callable in real winston (winston.format(fn)) AND carries the
  // helper methods below. Keep both so modules that build a custom format at
  // load time (e.g. logRedaction) work under test.
  format: Object.assign(
    jest.fn((transform: (...args: any[]) => any) =>
      jest.fn((options?: any) => ({ transform, options }))
    ),
    {
      combine: jest.fn((formats: any) => formats),
      timestamp: jest.fn(() => ({})),
      errors: jest.fn(() => ({})),
      splat: jest.fn(() => ({})),
      json: jest.fn(() => ({})),
      colorize: jest.fn(() => ({})),
      printf: jest.fn((fn: (...args: any[]) => string) => fn),
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
