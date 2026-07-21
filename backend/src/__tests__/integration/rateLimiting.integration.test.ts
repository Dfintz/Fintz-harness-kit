/**
 * Integration Tests for Rate Limiting Middleware
 */

import express, { Request, Response } from 'express';
import request from 'supertest';

import { createCustomRateLimiter } from '../../middleware/rateLimiting';

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
  }
}));

// Mock Redis client
jest.mock('../../utils/redis', () => ({
  __esModule: true,
  default: {
    getStatus: jest.fn(() => ({ enabled: false, connected: false })),
  },
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock rate limit config
jest.mock('../../config/rateLimitConfig', () => ({
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute for faster tests
  RATE_LIMIT_MAX_REQUESTS: 5,
  RATE_LIMIT_REDIS_ENABLED: false, // Use in-memory for tests
  RATE_LIMIT_REDIS_PREFIX: 'test:ratelimit:',
  RATE_LIMIT_LOGGING_ENABLED: false, // Disable logging in tests
  RATE_LIMIT_ALERT_THRESHOLD: 3,
  RATE_LIMIT_WHITELIST_USERS: [],
  RATE_LIMIT_WHITELIST_IPS: [],
  ROLE_RATE_LIMIT_MULTIPLIERS: {
    admin: 5,
    premium: 3,
    user: 1,
    guest: 0.5,
  },
  getRoleLimitMultiplier: (role?: string) => {
    const multipliers: Record<string, number> = {
      admin: 5,
      premium: 3,
      user: 1,
      guest: 0.5,
    };
    return role ? (multipliers[role.toLowerCase()] || 1) : 1;
  },
  isUserWhitelisted: () => false,
  isIpWhitelisted: () => false,
}));

// Mock rate limit monitor
jest.mock('../../services/security/RateLimitMonitorService', () => ({
  rateLimitMonitor: {
    logViolation: jest.fn(),
  },
}));

// Mock rate limit store
jest.mock('../../utils/rateLimitStore', () => ({
  createRateLimitStore: jest.fn(() => undefined), // Always return undefined for in-memory
}));

describe('Rate Limiting Middleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
  });

  describe('IP-Based Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const limiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: 'ip',
      });

      app.get('/test', limiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Make 5 requests (should all succeed)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      }
    });

    it('should block requests over the limit', async () => {
      const limiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 3,
        keyGenerator: 'ip',
      });

      app.get('/test', limiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Make 3 successful requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Too Many Requests');
      expect(response.body).toHaveProperty('retryAfter');
    });

    it('should include rate limit headers', async () => {
      const limiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: 'ip',
      });

      app.get('/test', limiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      
      // Standard rate limit headers (without x- prefix in newer versions)
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });
  });

  describe('Custom Messages', () => {
    it('should return custom message when rate limited', async () => {
      const customMessage = 'Custom rate limit message';
      const limiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 1,
        message: customMessage,
        keyGenerator: 'ip',
      });

      app.get('/test', limiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // First request succeeds
      await request(app).get('/test');

      // Second request gets custom message
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.message).toBe(customMessage);
    });
  });

  describe('Different Limits for Different Endpoints', () => {
    it('should enforce different limits per endpoint', async () => {
      const strictLimiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 2,
        keyGenerator: 'ip',
      });

      const relaxedLimiter = createCustomRateLimiter({
        windowMs: 60000,
        max: 10,
        keyGenerator: 'ip',
      });

      app.get('/strict', strictLimiter, (req: Request, res: Response) => {
        res.json({ endpoint: 'strict' });
      });

      app.get('/relaxed', relaxedLimiter, (req: Request, res: Response) => {
        res.json({ endpoint: 'relaxed' });
      });

      // Exhaust strict endpoint
      await request(app).get('/strict');
      await request(app).get('/strict');
      const strictResponse = await request(app).get('/strict');
      expect(strictResponse.status).toBe(429);

      // Relaxed endpoint should still work
      const relaxedResponse = await request(app).get('/relaxed');
      expect(relaxedResponse.status).toBe(200);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
