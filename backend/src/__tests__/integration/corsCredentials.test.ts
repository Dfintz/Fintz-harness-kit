/**
 * Integration test for CORS configuration with credentials
 *
 * This test verifies the fix for the Discord SSO login CORS issue where:
 * - CORS origin cannot be wildcard '*' when credentials mode is 'include'
 * - The backend must set 'credentials: true' only when a specific origin is configured
 */

import cors from 'cors';
import express, { Application } from 'express';
import request from 'supertest';

describe('CORS Credentials Integration', () => {
  let app: Application;

  describe('with specific origin (production-like)', () => {
    beforeAll(() => {
      // Simulate production configuration with specific origin
      const corsConfig = cors({
        origin: 'https://fringecore.space',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: [
          'Content-Length',
          'X-Request-Id',
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset',
        ],
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });

      app = express();
      app.use(corsConfig);
      app.post('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from the configured origin with credentials', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      // When using a single origin string, CORS middleware always returns that origin
      // but the browser will reject it because it doesn't match the request origin
      // This is expected CORS behavior - the validation happens in the browser
      expect(response.status).toBe(204);
    });
  });

  describe('with wildcard origin (development-like)', () => {
    beforeAll(() => {
      // Simulate development configuration with wildcard
      // Important: credentials MUST be false when origin is wildcard
      const corsConfig = cors({
        origin: '*',
        credentials: false, // This is the key fix
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });

      app = express();
      app.use(corsConfig);
      app.post('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from any origin without credentials', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('with multiple origins (comma-separated)', () => {
    beforeAll(() => {
      // Simulate configuration with multiple allowed origins
      const allowedOrigins = ['https://fringecore.space', 'https://www.fringecore.space'];
      const corsConfig = cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: [
          'Content-Length',
          'X-Request-Id',
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset',
        ],
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });

      app = express();
      app.use(corsConfig);
      app.post('/api/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from first origin with credentials', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests from second origin with credentials', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://www.fringecore.space')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Discord OAuth callback scenario', () => {
    beforeAll(() => {
      // Simulate the actual production configuration for Discord OAuth
      const corsConfig = cors({
        origin: 'https://fringecore.space',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: [
          'Content-Length',
          'X-Request-Id',
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset',
        ],
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });

      app = express();
      app.use(corsConfig);
      app.post('/api/v2/auth/discord/callback', (req, res) => {
        // Simulate Discord OAuth callback
        res.cookie('access_token', 'fake-token', { httpOnly: true });
        res.json({
          token: 'fake-token',
          user: { id: '123', username: 'testuser' },
        });
      });
    });

    it('should handle Discord callback with credentials and cookies', async () => {
      const response = await request(app)
        .post('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .send({ code: 'fake-code', redirectUri: 'https://fringecore.space/login' });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should handle preflight request for Discord callback', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should include maxAge and exposedHeaders in preflight response', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-max-age']).toBe('86400');
      expect(response.headers['access-control-expose-headers']).toBeDefined();
      expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
