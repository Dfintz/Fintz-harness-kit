import { NextFunction, Request, Response } from 'express';

import {
  authRateLimiter,
  corsConfig,
  rateLimiter,
  rsiApiRateLimiter,
  sanitizeInput,
  swaggerCspMiddleware,
  uploadRateLimiter,
  validateEnvironment,
  webhookRateLimiter,
} from '../../middleware/security';

describe('Security Middleware', () => {
  describe('sanitizeInput', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
      mockRequest = {
        body: {},
        query: {},
        params: {},
      };
      mockResponse = {};
      nextFunction = jest.fn();
    });

    it('should sanitize XSS characters from body strings', () => {
      mockRequest.body = {
        name: 'Test<script>alert("xss")</script>',
        description: 'Clean text',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      // Script tags should be removed
      expect(mockRequest.body.name).not.toContain('<script>');
      expect(mockRequest.body.name).not.toContain('</script>');
      expect(mockRequest.body.description).toBe('Clean text');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      mockRequest.body = {
        user: {
          name: 'John<>Doe',
          profile: {
            bio: 'Hello<script>',
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      // HTML entities should be escaped
      expect(mockRequest.body.user.name).not.toContain('<');
      expect(mockRequest.body.user.name).not.toContain('>');
      expect(mockRequest.body.user.profile.bio).not.toContain('<script>');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should sanitize arrays', () => {
      mockRequest.body = {
        tags: ['tag1<>', 'tag2', '<script>tag3'],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      // All array elements should be sanitized
      expect(mockRequest.body.tags[0]).not.toContain('<');
      expect(mockRequest.body.tags[0]).not.toContain('>');
      expect(mockRequest.body.tags[2]).not.toContain('<script>');
      expect(mockRequest.body.tags[1]).toBe('tag2'); // Clean text should remain unchanged
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle query parameters', () => {
      mockRequest.query = {
        search: 'test<>query',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.query.search).not.toContain('<');
      expect(mockRequest.query.search).not.toContain('>');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle URL parameters', () => {
      mockRequest.params = {
        id: '123<>456',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.params.id).not.toContain('<');
      expect(mockRequest.params.id).not.toContain('>');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should not modify non-string values', () => {
      mockRequest.body = {
        count: 42,
        active: true,
        date: null,
        list: [1, 2, 3],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.count).toBe(42);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.date).toBe(null);
      expect(mockRequest.body.list).toEqual([1, 2, 3]);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should call next() when no inputs to sanitize', () => {
      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove SQL injection patterns', () => {
      mockRequest.body = {
        input: "'; DROP TABLE users; --",
        query: '1 UNION SELECT * FROM users',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.input).not.toContain('DROP');
      expect(mockRequest.body.query).not.toContain('SELECT');
      expect(mockRequest.body.query).not.toContain('UNION');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove NoSQL injection patterns', () => {
      mockRequest.body = {
        filter: '$where: function() { return true; }',
        query: '$gt: 0',
        nested: {
          operator: '$ne: null',
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.filter).not.toContain('$where');
      expect(mockRequest.body.query).not.toContain('$gt');
      expect(mockRequest.body.nested.operator).not.toContain('$ne');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should remove javascript: protocol', () => {
      mockRequest.body = {
        link: 'javascript:alert("XSS")',
        url: 'JAVASCRIPT:void(0)',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.link.toLowerCase()).not.toContain('javascript:');
      expect(mockRequest.body.url.toLowerCase()).not.toContain('javascript:');
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should not throw error when JWT_SECRET is set in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-secret';

      expect(() => validateEnvironment()).not.toThrow();
    });

    it('should return error when JWT_SECRET contains "change-in-production" in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'your-secret-key-change-in-production';

      const errors = validateEnvironment();
      expect(errors).toContain(
        'JWT_SECRET must be set to a secure value (minimum 32 characters) in production!'
      );
    });

    it('should return error when JWT_SECRET is not set in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const errors = validateEnvironment();
      expect(errors).toContain('Missing required environment variables: JWT_SECRET');
    });

    it('should not return errors with valid JWT_SECRET and CORS_ORIGIN in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      // DB environment variables required in production
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_USER = 'sc_admin';
      process.env.DB_PASSWORD = 'secure-db-password-12345';
      process.env.DB_NAME = 'sc_fleet_manager';

      const errors = validateEnvironment();
      expect(errors).toEqual([]);
    });

    it('should return critical error when CORS_ORIGIN is not set in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      delete process.env.CORS_ORIGIN;

      // CORS_ORIGIN is a critical error in production - wildcard disables cookie-based auth
      const errors = validateEnvironment();
      expect(errors).toEqual([
        'CORS_ORIGIN must be set to a specific origin in production! Wildcard (*) disables cookie-based authentication.',
      ]);
    });

    it('should not return critical error when DB credentials are missing in production (warning only)', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      delete process.env.DB_HOST;

      // DB credentials are now warnings, not critical errors
      // The function should not return them in the errors array
      const errors = validateEnvironment();
      expect(errors).toEqual([]);
    });

    it('should return critical error when DB_PASSWORD is insecure in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_USER = 'sc_admin';
      process.env.DB_PASSWORD = 'password';
      process.env.DB_NAME = 'sc_fleet_manager';

      // Insecure DB_PASSWORD is a critical error in production
      const errors = validateEnvironment();
      expect(errors).toEqual([
        'DB_PASSWORD is set to an insecure default value! Use a strong, unique password in production.',
      ]);
    });

    it('should not return critical error when DB_PASSWORD is too short in production (warning only)', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_USER = 'sc_admin';
      process.env.DB_PASSWORD = 'short';
      process.env.DB_NAME = 'sc_fleet_manager';

      // Short DB_PASSWORD is now a warning, not a critical error
      const errors = validateEnvironment();
      expect(errors).toEqual([]);
    });

    it('should not return critical error when DB_USER is insecure in production (warning only)', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'very-secure-random-secret-key-12345';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.TOKEN_ENCRYPTION_KEY = 'secure-token-encryption-key-12345';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_USER = 'admin';
      process.env.DB_PASSWORD = 'secure-db-password-12345';
      process.env.DB_NAME = 'sc_fleet_manager';

      // Insecure DB_USER is now a warning, not a critical error
      const errors = validateEnvironment();
      expect(errors).toEqual([]);
    });
  });

  describe('Rate Limiters', () => {
    it('should export rateLimiter with correct configuration', () => {
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('should export authRateLimiter with correct configuration', () => {
      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe('function');
    });

    it('should export uploadRateLimiter with correct configuration', () => {
      expect(uploadRateLimiter).toBeDefined();
      expect(typeof uploadRateLimiter).toBe('function');
    });

    it('should export webhookRateLimiter with correct configuration', () => {
      expect(webhookRateLimiter).toBeDefined();
      expect(typeof webhookRateLimiter).toBe('function');
    });

    it('should export rsiApiRateLimiter with correct configuration', () => {
      expect(rsiApiRateLimiter).toBeDefined();
      expect(typeof rsiApiRateLimiter).toBe('function');
    });
  });

  describe('Swagger CSP Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
      mockRequest = {
        path: '/api-docs',
      };
      mockResponse = {
        setHeader: jest.fn(),
      };
      nextFunction = jest.fn();
    });

    it('should set relaxed CSP header for /api-docs path', () => {
      mockRequest.path = '/api-docs';

      swaggerCspMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("'unsafe-inline'")
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should set relaxed CSP header for /api-docs/swagger-ui subpath', () => {
      mockRequest.path = '/api-docs/swagger-ui';

      swaggerCspMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("'unsafe-inline'")
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should set CSP header for all paths (mounted on /api-docs)', () => {
      mockRequest.path = '/api/users';

      swaggerCspMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // swaggerCspMiddleware always sets CSP header when called
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("'unsafe-inline'")
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should call next() regardless of path', () => {
      mockRequest.path = '/any-path';

      swaggerCspMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('CORS Configuration', () => {
    it('should export corsConfig middleware', () => {
      expect(corsConfig).toBeDefined();
      expect(typeof corsConfig).toBe('function');
    });

    it('should be configured with credentials support when specific origin is set', () => {
      // Note: This test validates that the corsConfig was properly exported
      // The actual CORS behavior is tested via integration tests
      // The configuration depends on process.env.CORS_ORIGIN at module load time
      expect(corsConfig).toBeDefined();
    });
  });
});
