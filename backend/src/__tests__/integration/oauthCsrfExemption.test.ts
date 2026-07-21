/**
 * Integration test to verify OAuth callback routes and login are exempted from CSRF validation
 * This test ensures that Discord and Azure AD OAuth callbacks work without CSRF tokens,
 * as they use the OAuth state parameter for CSRF protection instead.
 * Also verifies that the login endpoint is exempted since it's the initial authentication point.
 */

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

import { csrfProtection, csrfTokenMiddleware } from '../../middleware/csrf';

describe('OAuth CSRF Exemption Integration Tests', () => {
  let app: express.Application;

  // Paths that are exempt from CSRF validation (matches app.ts configuration)
  const CSRF_EXEMPT_PATHS = new Set([
    '/api/v2/auth/discord/callback', // OAuth callbacks use state parameter for CSRF protection
    '/api/v2/auth/azuread/callback', // OAuth callbacks use state parameter for CSRF protection
    '/api/auth/login', // Initial authentication - no CSRF token available yet
    '/api/v2/auth/login', // Admin login - username/password auth doesn't need CSRF protection
  ]);

  beforeEach(() => {
    app = express();
    app.disable('x-powered-by');
    app.use(express.json());
    app.use(cookieParser());

    // Replicate the CSRF middleware setup from app.ts
    app.use(csrfTokenMiddleware);
    app.use((req, res, next) => {
      // Skip CSRF for API endpoints using Bearer token authentication
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        return next();
      }
      // Skip CSRF for health checks and swagger docs
      if (req.path.startsWith('/health') || req.path.startsWith('/api-docs')) {
        return next();
      }
      // Skip CSRF for exempt paths (OAuth callbacks, login)
      if (CSRF_EXEMPT_PATHS.has(req.path)) {
        return next();
      }
      // Apply CSRF validation for cookie-based sessions
      csrfProtection.validate(req, res, next);
    });

    // Add test routes
    app.get('/api/v2/auth/discord/callback', (req, res) => {
      res.status(200).json({ message: 'Discord OAuth callback success (GET)' });
    });

    app.post('/api/v2/auth/discord/callback', (req, res) => {
      res.status(200).json({ message: 'Discord OAuth callback success' });
    });

    app.post('/api/v2/auth/azuread/callback', (req, res) => {
      res.status(200).json({ message: 'Azure AD OAuth callback success' });
    });

    app.post('/api/auth/login', (req, res) => {
      res.status(200).json({ message: 'Login success' });
    });

    app.post('/api/test/csrf-protected', (req, res) => {
      res.status(200).json({ message: 'CSRF protected route success' });
    });
  });

  describe('POST /api/v2/auth/discord/callback', () => {
    it('should succeed without CSRF token (exempted from CSRF validation)', async () => {
      const response = await request(app)
        .post('/api/v2/auth/discord/callback')
        .send({ code: 'test-code', redirectUri: 'http://localhost' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Discord OAuth callback success');
    });

    it('should succeed with Bearer token authentication', async () => {
      const response = await request(app)
        .post('/api/v2/auth/discord/callback')
        .set('Authorization', 'Bearer test-token')
        .send({ code: 'test-code', redirectUri: 'http://localhost' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v2/auth/discord/callback', () => {
    it('should succeed with query parameters (direct Discord redirect)', async () => {
      const response = await request(app)
        .get('/api/v2/auth/discord/callback')
        .query({ code: 'test-code-123', state: 'random-state' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Discord OAuth callback success (GET)');
    });

    it('should be exempted from CSRF validation (uses OAuth state parameter)', async () => {
      // This test ensures GET requests don't require CSRF tokens
      // since OAuth uses the state parameter for CSRF protection
      const response = await request(app)
        .get('/api/v2/auth/discord/callback')
        .query({ code: 'test-code-456', state: 'csrf-state-param' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/v2/auth/azuread/callback', () => {
    it('should succeed without CSRF token (exempted from CSRF validation)', async () => {
      const response = await request(app)
        .post('/api/v2/auth/azuread/callback')
        .send({ code: 'test-code', redirectUri: 'http://localhost' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Azure AD OAuth callback success');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should succeed without CSRF token (exempted from CSRF validation)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login success');
    });

    it('should succeed with Bearer token authentication', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Authorization', 'Bearer test-token')
        .send({ username: 'test', password: 'test' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/test/csrf-protected', () => {
    it('should fail without CSRF token (CSRF validation applies)', async () => {
      const response = await request(app).post('/api/test/csrf-protected').send({ data: 'test' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'CSRF_VALIDATION_FAILED');
    });

    it('should succeed with Bearer token authentication (bypasses CSRF)', async () => {
      const response = await request(app)
        .post('/api/test/csrf-protected')
        .set('Authorization', 'Bearer test-token')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
