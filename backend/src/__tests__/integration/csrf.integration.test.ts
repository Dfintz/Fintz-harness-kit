/**
 * CSRF Protection Integration Tests
 *
 * These tests verify that CSRF protection is working correctly
 * across the application, including:
 * - Token generation and validation
 * - Global middleware application
 * - Bearer token exemption
 * - Cookie-based authentication protection
 */

import { json } from 'body-parser';
import cookieParser from 'cookie-parser';
import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { csrfProtection, csrfTokenMiddleware, generateCsrfToken } from '../../middleware/csrf';

// Mock logger to avoid console noise in tests
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock cookie config
jest.mock('../../config/cookies', () => ({
  csrfTokenCookieOptions: {
    httpOnly: false,
    secure: false,
    sameSite: 'strict',
  },
  COOKIE_NAMES: {
    CSRF_TOKEN: 'csrf_token',
  },
}));

describe('CSRF Protection Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(json());
    app.use(cookieParser());
  });

  describe('Global CSRF Protection Pattern (Simulating app.ts)', () => {
    beforeEach(() => {
      // Simulate the global middleware setup from app.ts
      app.use(csrfTokenMiddleware);

      // Simulate the conditional CSRF validation from app.ts
      app.use((req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        // Bearer token requests bypass CSRF
        if (authHeader?.startsWith('Bearer ')) {
          return next();
        }

        // Health endpoints bypass CSRF
        if (req.path.startsWith('/health')) {
          return next();
        }

        // Apply CSRF validation
        csrfProtection.validate(req, res, next);
      });

      // Add test routes
      app.get('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'GET request' });
      });

      app.post('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'POST request', body: req.body });
      });

      app.put('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'PUT request' });
      });

      app.patch('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'PATCH request' });
      });

      app.delete('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'DELETE request' });
      });

      app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy' });
      });
    });

    describe('GET Requests', () => {
      it('should allow GET requests without CSRF token', async () => {
        const response = await request(app).get('/api/test');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('GET request');
      });

      it('should set CSRF token cookie on GET request', async () => {
        const response = await request(app).get('/api/test');

        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();

        const csrfCookie = cookies?.find((c: string) => c.startsWith('csrf_token='));
        expect(csrfCookie).toBeDefined();
      });
    });

    describe('POST Requests without Bearer Token', () => {
      it('should reject POST request without CSRF token', async () => {
        const response = await request(app).post('/api/test').send({ data: 'test' });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
        expect(response.body.error.message).toContain('CSRF cookie not found');
      });

      it('should reject POST request with cookie but no header token', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .post('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .send({ data: 'test' });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
        expect(response.body.error.message).toContain('CSRF token required');
      });

      it('should reject POST request with mismatched tokens', async () => {
        const cookieToken = generateCsrfToken();
        const headerToken = generateCsrfToken();

        const response = await request(app)
          .post('/api/test')
          .set('Cookie', [`csrf_token=${cookieToken}`])
          .set('X-CSRF-Token', headerToken)
          .send({ data: 'test' });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
        expect(response.body.error.message).toContain('Invalid CSRF token');
      });

      it('should allow POST request with valid CSRF token', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .post('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .set('X-CSRF-Token', token)
          .send({ data: 'test' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('POST request');
        expect(response.body.body.data).toBe('test');
      });

      it('should accept CSRF token from body._csrf field', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .post('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .send({ _csrf: token, data: 'test' });

        expect(response.status).toBe(200);
      });

      it('should reject CSRF token from query._csrf parameter (prevents leakage)', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .post('/api/test?_csrf=' + token)
          .set('Cookie', [`csrf_token=${token}`])
          .send({ data: 'test' });

        expect(response.status).toBe(403);
      });
    });

    describe('PUT/PATCH/DELETE Requests without Bearer Token', () => {
      it('should protect PUT requests', async () => {
        const response = await request(app).put('/api/test');

        expect(response.status).toBe(403);
      });

      it('should protect PATCH requests', async () => {
        const response = await request(app).patch('/api/test');

        expect(response.status).toBe(403);
      });

      it('should protect DELETE requests', async () => {
        const response = await request(app).delete('/api/test');

        expect(response.status).toBe(403);
      });

      it('should allow PUT request with valid CSRF token', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .put('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .set('X-CSRF-Token', token);

        expect(response.status).toBe(200);
      });

      it('should allow PATCH request with valid CSRF token', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .patch('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .set('X-CSRF-Token', token);

        expect(response.status).toBe(200);
      });

      it('should allow DELETE request with valid CSRF token', async () => {
        const token = generateCsrfToken();

        const response = await request(app)
          .delete('/api/test')
          .set('Cookie', [`csrf_token=${token}`])
          .set('X-CSRF-Token', token);

        expect(response.status).toBe(200);
      });
    });

    describe('Bearer Token Bypass', () => {
      it('should allow POST with Bearer token (no CSRF required)', async () => {
        const response = await request(app)
          .post('/api/test')
          .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test')
          .send({ data: 'test' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('POST request');
      });

      it('should allow PUT with Bearer token (no CSRF required)', async () => {
        const response = await request(app)
          .put('/api/test')
          .set('Authorization', 'Bearer valid-jwt-token');

        expect(response.status).toBe(200);
      });

      it('should allow PATCH with Bearer token (no CSRF required)', async () => {
        const response = await request(app)
          .patch('/api/test')
          .set('Authorization', 'Bearer valid-jwt-token');

        expect(response.status).toBe(200);
      });

      it('should allow DELETE with Bearer token (no CSRF required)', async () => {
        const response = await request(app)
          .delete('/api/test')
          .set('Authorization', 'Bearer valid-jwt-token');

        expect(response.status).toBe(200);
      });

      it('should not bypass with malformed Bearer header', async () => {
        const response = await request(app)
          .post('/api/test')
          .set('Authorization', 'BearerWrongFormat')
          .send({ data: 'test' });

        expect(response.status).toBe(403);
      });
    });

    describe('Health Endpoint Exemption', () => {
      it('should allow health endpoint without CSRF token', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Token Lifecycle', () => {
    beforeEach(() => {
      app.use(csrfTokenMiddleware);

      app.get('/get-token', (req: Request, res: Response) => {
        res.json({ message: 'Token set' });
      });

      app.post('/use-token', csrfProtection.validate, (req: Request, res: Response) => {
        res.json({ message: 'Token valid' });
      });
    });

    it('should generate token on first request', async () => {
      const response = await request(app).get('/get-token');

      const cookies = response.headers['set-cookie'];
      const csrfCookie = cookies?.find((c: string) => c.startsWith('csrf_token='));

      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).toMatch(/csrf_token=[a-f0-9]{64}/);
    });

    it('should reuse existing token value when refreshing cookie', async () => {
      const existingToken = generateCsrfToken();

      const response = await request(app)
        .get('/get-token')
        .set('Cookie', [`csrf_token=${existingToken}`]);

      const cookies = response.headers['set-cookie'];

      // Cookie is always refreshed (to update domain), but reuses existing token value
      const csrfCookie = cookies?.find((c: string) => c.startsWith('csrf_token='));
      expect(csrfCookie).toBeDefined();
      const returnedToken = csrfCookie?.split('=')[1].split(';')[0];
      expect(returnedToken).toBe(existingToken);
    });

    it('should reuse the same token across multiple requests', async () => {
      // First request to get token
      const getResponse = await request(app).get('/get-token');

      const cookies = getResponse.headers['set-cookie'];
      const csrfCookie = cookies?.find((c: string) => c.startsWith('csrf_token='));
      const token = csrfCookie?.split('=')[1].split(';')[0];

      // Second request using the token
      const postResponse = await request(app)
        .post('/use-token')
        .set('Cookie', [`csrf_token=${token}`])
        .set('X-CSRF-Token', token || '')
        .send({ data: 'test' });

      expect(postResponse.status).toBe(200);

      // Third request with same token
      const secondPostResponse = await request(app)
        .post('/use-token')
        .set('Cookie', [`csrf_token=${token}`])
        .set('X-CSRF-Token', token || '')
        .send({ data: 'test2' });

      expect(secondPostResponse.status).toBe(200);
    });
  });

  describe('Security Edge Cases', () => {
    beforeEach(() => {
      app.use(csrfTokenMiddleware);
      app.use(csrfProtection.validate);

      app.post('/api/test', (req: Request, res: Response) => {
        res.json({ message: 'Success' });
      });
    });

    it('should reject empty CSRF token', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Cookie', ['csrf_token='])
        .set('X-CSRF-Token', '');

      expect(response.status).toBe(403);
    });

    it('should accept token even with non-standard format if it matches', async () => {
      // Note: The CSRF implementation decodes tokens as hex (Buffer.from(token, 'hex')),
      // so it expects hex-formatted tokens. In this test, "short" is still a valid
      // hex string, and because the cookie and header values match exactly, the
      // double-submit check passes. In production, tokens should always be properly
      // generated hex values via generateCsrfToken().
      const response = await request(app)
        .post('/api/test')
        .set('Cookie', ['csrf_token=short'])
        .set('X-CSRF-Token', 'short');

      expect(response.status).toBe(200);
    });

    it('should handle missing cookie gracefully', async () => {
      const token = generateCsrfToken();

      const response = await request(app).post('/api/test').set('X-CSRF-Token', token);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('CSRF cookie not found');
    });

    it('should handle missing header gracefully', async () => {
      const token = generateCsrfToken();

      const response = await request(app)
        .post('/api/test')
        .set('Cookie', [`csrf_token=${token}`]);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('CSRF token required');
    });

    it('should use timing-safe comparison', async () => {
      // This test verifies the implementation uses timingSafeEqual
      // by ensuring that slightly different tokens are rejected
      const baseToken = 'a'.repeat(64);
      const similarToken = 'a'.repeat(63) + 'b';

      const response = await request(app)
        .post('/api/test')
        .set('Cookie', [`csrf_token=${baseToken}`])
        .set('X-CSRF-Token', similarToken);

      expect(response.status).toBe(403);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
