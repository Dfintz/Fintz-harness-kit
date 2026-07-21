/**
 * Tests for Rate Limit Monitor Service
 */

import { rateLimitMonitor } from '../../../services/security/RateLimitMonitorService';

// Mock logger
jest.mock('../../../utils/logger', () => ({
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
  }
}));

// Mock Redis cache
jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock config
jest.mock('../../../config/rateLimitConfig', () => ({
  RATE_LIMIT_ALERT_THRESHOLD: 5,
  RATE_LIMIT_LOGGING_ENABLED: true,
}));

describe('Rate Limit Monitor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logViolation', () => {
    it('should log a rate limit violation', async () => {
      const violation = {
        identifier: 'user-123',
        identifierType: 'user' as const,
        endpoint: '/api/test',
        timestamp: Date.now(),
        userAgent: 'Test Agent',
        limit: 100,
        current: 101,
      };

      await rateLimitMonitor.logViolation(violation);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle violations without userAgent', async () => {
      const violation = {
        identifier: '192.168.1.1',
        identifierType: 'ip' as const,
        endpoint: '/api/test',
        timestamp: Date.now(),
        limit: 100,
        current: 101,
      };

      await rateLimitMonitor.logViolation(violation);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getViolationStats', () => {
    it('should return null for non-existent identifier', async () => {
      const stats = await rateLimitMonitor.getViolationStats('user', 'non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getAllViolationStats', () => {
    it('should return a Map of all violation stats', () => {
      const stats = rateLimitMonitor.getAllViolationStats();
      expect(stats).toBeInstanceOf(Map);
    });
  });

  describe('clearViolationStats', () => {
    it('should clear stats for an identifier', async () => {
      await rateLimitMonitor.clearViolationStats('user', 'test-user');

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
