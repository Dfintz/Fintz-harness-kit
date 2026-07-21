/**
 * Tests for CSRF Protection Middleware
 */

import { NextFunction, Request, Response } from 'express';

import {
  csrfProtection,
  csrfProtectionFor,
  csrfTokenMiddleware,
  generateCsrfToken,
  validateCsrfMiddleware,
  validateCsrfToken,
} from '../../middleware/csrf';

// Mock logger
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

describe('CSRF Protection Middleware', () => {
  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();

      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens on each call', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe('validateCsrfToken', () => {
    it('should return false when cookie token is missing', () => {
      const result = validateCsrfToken('', 'valid-token');
      expect(result).toBe(false);
    });

    it('should return false when header token is missing', () => {
      const result = validateCsrfToken('valid-token', '');
      expect(result).toBe(false);
    });

    it('should return false when tokens have different lengths', () => {
      // Use valid hex tokens of different lengths
      const shortToken = generateCsrfToken().substring(0, 32);
      const longToken = generateCsrfToken();

      const result = validateCsrfToken(shortToken, longToken);
      expect(result).toBe(false);
    });

    it('should return false when tokens do not match', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      const result = validateCsrfToken(token1, token2);
      expect(result).toBe(false);
    });

    it('should return true when tokens match', () => {
      const token = generateCsrfToken();

      const result = validateCsrfToken(token, token);
      expect(result).toBe(true);
    });

    it('should handle invalid hex strings of different decoded lengths', () => {
      // When invalid hex strings produce different buffer lengths, returns false
      // 'ab' decodes to valid hex byte, 'zz' decodes to empty
      const result = validateCsrfToken('ab', 'abcd');
      expect(result).toBe(false);
    });
  });

  describe('csrfTokenMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let cookieMock: jest.Mock;

    beforeEach(() => {
      cookieMock = jest.fn();
      mockReq = {
        cookies: {},
      };
      mockRes = {
        cookie: cookieMock,
      };
      mockNext = jest.fn();
    });

    it('should generate and set a new token when none exists', () => {
      csrfTokenMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(cookieMock).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();

      const cookieCall = cookieMock.mock.calls[0];
      expect(cookieCall[0]).toBe('csrf_token');
      expect(cookieCall[1]).toHaveLength(64);
    });

    it('should not generate a new token when one already exists', () => {
      mockReq.cookies = { csrf_token: 'existing-token' };

      csrfTokenMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Cookie is always refreshed to ensure correct domain, but reuses existing token
      expect(cookieMock).toHaveBeenCalled();
      const cookieCall = cookieMock.mock.calls[0];
      expect(cookieCall[0]).toBe('csrf_token');
      expect(cookieCall[1]).toBe('existing-token');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateCsrfMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnThis();

      mockReq = {
        method: 'POST',
        path: '/api/test',
        ip: '127.0.0.1',
        cookies: {},
        headers: {},
        body: {},
        query: {},
      };
      mockRes = {
        status: statusMock,
        json: jsonMock,
      };
      mockNext = jest.fn();
    });

    it('should skip validation for GET requests', () => {
      mockReq.method = 'GET';

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should skip validation for HEAD requests', () => {
      mockReq.method = 'HEAD';

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip validation for OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when cookie token is missing', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CSRF_VALIDATION_FAILED',
            message: 'CSRF cookie not found',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when header token is missing', () => {
      const token = generateCsrfToken();
      mockReq.cookies = { csrf_token: token };
      mockReq.headers = {};

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CSRF_VALIDATION_FAILED',
            message: 'CSRF token required for this request. Include X-CSRF-Token header.',
          }),
        })
      );
    });

    it('should return 403 when tokens do not match', () => {
      const cookieToken = generateCsrfToken();
      const headerToken = generateCsrfToken();

      mockReq.cookies = { csrf_token: cookieToken };
      mockReq.headers = { 'x-csrf-token': headerToken };

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CSRF_VALIDATION_FAILED',
            message: 'Invalid CSRF token',
          }),
        })
      );
    });

    it('should call next() when tokens match via header', () => {
      const token = generateCsrfToken();

      mockReq.cookies = { csrf_token: token };
      mockReq.headers = { 'x-csrf-token': token };

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should accept token from body._csrf', () => {
      const token = generateCsrfToken();

      mockReq.cookies = { csrf_token: token };
      mockReq.body = { _csrf: token };

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject token from query._csrf (prevents leakage via logs/referrer)', () => {
      const token = generateCsrfToken();

      mockReq.cookies = { csrf_token: token };
      mockReq.query = { _csrf: token };

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should validate for PUT requests', () => {
      mockReq.method = 'PUT';
      mockReq.cookies = {};

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should validate for PATCH requests', () => {
      mockReq.method = 'PATCH';
      mockReq.cookies = {};

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should validate for DELETE requests', () => {
      mockReq.method = 'DELETE';
      mockReq.cookies = {};

      validateCsrfMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('csrfProtection', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        path: '/api/test',
        ip: '127.0.0.1',
        cookies: {},
        headers: {},
        body: {},
        query: {},
      };
      mockRes = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should have generate middleware', () => {
      expect(csrfProtection.generate).toBe(csrfTokenMiddleware);
    });

    it('should have validate middleware', () => {
      expect(csrfProtection.validate).toBe(validateCsrfMiddleware);
    });

    it('protect middleware should generate and validate', () => {
      const token = generateCsrfToken();
      mockReq.method = 'POST';
      mockReq.cookies = { csrf_token: token };
      mockReq.headers = { 'x-csrf-token': token };

      csrfProtection.protect(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('csrfProtectionFor', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        path: '/api/test',
        ip: '127.0.0.1',
        cookies: {},
        headers: {},
        body: {},
        query: {},
      };
      mockRes = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should only validate for specified methods', () => {
      const middleware = csrfProtectionFor(['POST']);

      mockReq.method = 'PUT';
      mockReq.cookies = {}; // No token - would fail validation

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should pass because PUT is not in the list
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate for methods in the list', () => {
      const middleware = csrfProtectionFor(['POST', 'PUT']);

      mockReq.method = 'POST';
      mockReq.cookies = {};

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should use default methods when none specified', () => {
      const middleware = csrfProtectionFor();

      mockReq.method = 'DELETE';
      mockReq.cookies = {};

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
