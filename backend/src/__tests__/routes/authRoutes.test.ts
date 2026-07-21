/**
 * Test for explicit OPTIONS handlers in auth routes
 * Verifies that CORS preflight requests are handled correctly for OAuth endpoints
 */

import cors from 'cors';
import express, { Application, Router } from 'express';
import request from 'supertest';

describe('Auth Routes OPTIONS Handling', () => {
  let app: Application;

  beforeAll(() => {
    // Simulate production CORS configuration
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

    // Apply CORS globally
    app.use(corsConfig);

    const router = Router();

    // Explicit OPTIONS handlers for OAuth callbacks
    router.options('/auth/discord/callback', corsConfig);
    router.post('/auth/discord/callback', (req, res) => {
      res.json({ success: true, message: 'Discord callback' });
    });

    router.options('/auth/azuread/callback', corsConfig);
    router.post('/auth/azuread/callback', (req, res) => {
      res.json({ success: true, message: 'Azure AD callback' });
    });

    app.use('/api/v2', router);
  });

  describe('Discord OAuth Callback', () => {
    it('should handle OPTIONS request with proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('should reject OPTIONS request from unauthorized origin', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      // When using a single origin string with callback validation,
      // unauthorized origins should not get matching CORS headers
      expect(response.status).toBe(204);
      // The origin header should either be missing or not match the request origin
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      }
    });

    it('should handle POST request with credentials', async () => {
      const response = await request(app)
        .post('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .send({ code: 'test-code', redirectUri: 'https://fringecore.space/login' });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Azure AD OAuth Callback', () => {
    it('should handle OPTIONS request with proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v2/auth/azuread/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('should handle POST request with credentials', async () => {
      const response = await request(app)
        .post('/api/v2/auth/azuread/callback')
        .set('Origin', 'https://fringecore.space')
        .send({ code: 'test-code', redirectUri: 'https://fringecore.space/login' });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('CORS Pitfall Prevention', () => {
    it('should never return wildcard origin when credentials are enabled', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST');

      // Verify we're NOT returning wildcard
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
      // Verify we're returning specific origin
      expect(response.headers['access-control-allow-origin']).toBe('https://fringecore.space');
      // Verify credentials are enabled
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include exposed headers for JavaScript access', async () => {
      const response = await request(app)
        .options('/api/v2/auth/discord/callback')
        .set('Origin', 'https://fringecore.space')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-expose-headers']).toBeDefined();
      expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
    });
  });
});
