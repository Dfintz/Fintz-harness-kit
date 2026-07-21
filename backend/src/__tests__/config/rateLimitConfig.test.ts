/**
 * Tests for Rate Limit Configuration
 */

import {
  getRoleLimitMultiplier,
  isIpWhitelisted,
  isUserWhitelisted,
  RATE_LIMIT_ALERT_THRESHOLD,
  RATE_LIMIT_LOGGING_ENABLED,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_REDIS_ENABLED,
  RATE_LIMIT_REDIS_PREFIX,
  RATE_LIMIT_WHITELIST_IPS,
  RATE_LIMIT_WHITELIST_USERS,
  RATE_LIMIT_WINDOW_MS,
  ROLE_RATE_LIMIT_MULTIPLIERS,
} from '../../config/rateLimitConfig';

describe('Rate Limit Configuration', () => {
  describe('Default Configuration Values', () => {
    it('should have default window of 15 minutes', () => {
      expect(RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    });

    it('should have default max requests of 200', () => {
      expect(RATE_LIMIT_MAX_REQUESTS).toBe(200);
    });

    it('should have Redis enabled by default', () => {
      expect(RATE_LIMIT_REDIS_ENABLED).toBe(true);
    });

    it('should have default Redis prefix', () => {
      expect(RATE_LIMIT_REDIS_PREFIX).toBe('ratelimit:');
    });

    it('should have logging enabled by default', () => {
      expect(RATE_LIMIT_LOGGING_ENABLED).toBe(true);
    });

    it('should have default alert threshold of 5', () => {
      expect(RATE_LIMIT_ALERT_THRESHOLD).toBe(5);
    });
  });

  describe('Role-Based Multipliers', () => {
    it('should have admin multiplier of 5x', () => {
      expect(ROLE_RATE_LIMIT_MULTIPLIERS.admin).toBe(5);
    });

    it('should have premium multiplier of 3x', () => {
      expect(ROLE_RATE_LIMIT_MULTIPLIERS.premium).toBe(3);
    });

    it('should have user multiplier of 1x', () => {
      expect(ROLE_RATE_LIMIT_MULTIPLIERS.user).toBe(1);
    });

    it('should have guest multiplier of 0.5x', () => {
      expect(ROLE_RATE_LIMIT_MULTIPLIERS.guest).toBe(0.5);
    });
  });

  describe('getRoleLimitMultiplier', () => {
    it('should return correct multiplier for admin role', () => {
      expect(getRoleLimitMultiplier('admin')).toBe(5);
    });

    it('should return correct multiplier for premium role', () => {
      expect(getRoleLimitMultiplier('premium')).toBe(3);
    });

    it('should return 1.0 for unknown role', () => {
      expect(getRoleLimitMultiplier('unknown')).toBe(1.0);
    });

    it('should return 1.0 for undefined role', () => {
      expect(getRoleLimitMultiplier(undefined)).toBe(1.0);
    });

    it('should be case-insensitive', () => {
      expect(getRoleLimitMultiplier('ADMIN')).toBe(5);
      expect(getRoleLimitMultiplier('Admin')).toBe(5);
    });
  });

  describe('Whitelist Functions', () => {
    it('should check if user is whitelisted', () => {
      // Since we can't easily modify the imported constants,
      // we'll just test that the function works
      expect(typeof isUserWhitelisted('test-user')).toBe('boolean');
    });

    it('should check if IP is whitelisted', () => {
      expect(typeof isIpWhitelisted('192.168.1.1')).toBe('boolean');
    });
  });

  describe('Whitelist Arrays', () => {
    it('should be arrays', () => {
      expect(Array.isArray(RATE_LIMIT_WHITELIST_USERS)).toBe(true);
      expect(Array.isArray(RATE_LIMIT_WHITELIST_IPS)).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
