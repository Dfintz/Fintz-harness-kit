/**
 * Tests for Rate Limit Store Factory
 */

import { getRateLimitStoreStatus } from '../../utils/rateLimitStore';

// Mock the Redis client
jest.mock('../../utils/redis', () => ({
  __esModule: true,
  redisClient: {
    getStatus: jest.fn(() => ({ enabled: false, connected: false })),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Rate Limit Store Factory', () => {
  describe('getRateLimitStoreStatus', () => {
    it('should return memory store status when Redis is disabled', () => {
      // Set environment to disable Redis
      const originalEnv = process.env.RATE_LIMIT_REDIS_ENABLED;
      process.env.RATE_LIMIT_REDIS_ENABLED = 'false';

      // Need to reload the module to pick up new env var
      jest.resetModules();
      const { getRateLimitStoreStatus: getStatus } = require('../../utils/rateLimitStore');

      const status = getStatus();
      expect(status.type).toBe('memory');
      expect(status.available).toBe(true);

      // Restore
      process.env.RATE_LIMIT_REDIS_ENABLED = originalEnv;
    });

    it('should return status object with correct structure', () => {
      const status = getRateLimitStoreStatus();
      expect(status).toHaveProperty('type');
      expect(status).toHaveProperty('available');
      expect(['redis', 'memory']).toContain(status.type);
      expect(typeof status.available).toBe('boolean');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
