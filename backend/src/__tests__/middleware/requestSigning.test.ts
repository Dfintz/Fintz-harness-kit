/**
 * Tests for Request Signing Middleware
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

import {
  generateRequestSignature,
  validateRequestSignature,
  requireSignedRequest,
  signRequest,
  generateNonce,
} from '../../middleware/requestSigning';

describe('Request Signing Middleware', () => {
  const TEST_SECRET = 'test-signing-secret-for-unit-tests-32chars';

  describe('generateRequestSignature', () => {
    it('should generate a consistent signature for the same inputs', () => {
      const sig1 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );
      const sig2 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different methods', () => {
      const sigPost = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );
      const sigGet = generateRequestSignature(
        'GET',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );

      expect(sigPost).not.toBe(sigGet);
    });

    it('should generate different signatures for different paths', () => {
      const sig1 = generateRequestSignature(
        'POST',
        '/api/test1',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );
      const sig2 = generateRequestSignature(
        'POST',
        '/api/test2',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different timestamps', () => {
      const sig1 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        TEST_SECRET
      );
      const sig2 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567891',
        '{"data":"test"}',
        TEST_SECRET
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different bodies', () => {
      const sig1 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test1"}',
        TEST_SECRET
      );
      const sig2 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test2"}',
        TEST_SECRET
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const sig1 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        'secret1'
      );
      const sig2 = generateRequestSignature(
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        'secret2'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate a 64-character hex string', () => {
      const sig = generateRequestSignature('POST', '/api/test', '1234567890', '{}', TEST_SECRET);

      expect(sig).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(sig)).toBe(true);
    });
  });

  describe('validateRequestSignature', () => {
    const createMockRequest = (overrides: Partial<Request> = {}): Request => {
      const headers = overrides.headers || {};
      return {
        method: 'POST',
        path: '/api/test',
        body: { data: 'test' },
        headers,
        ip: '127.0.0.1',
        get: (name: string) => {
          const key = name.toLowerCase();
          const val = (headers as Record<string, string | string[] | undefined>)[key];
          return Array.isArray(val) ? val[0] : val;
        },
        ...overrides,
      } as Request;
    };

    it('should return error when signature header is missing', () => {
      const req = createMockRequest({
        headers: {
          'x-request-timestamp': Date.now().toString(),
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing request signature');
    });

    it('should return error when timestamp header is missing', () => {
      const req = createMockRequest({
        headers: {
          'x-request-signature': 'some-signature',
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing request timestamp');
    });

    it('should return error for invalid timestamp format', () => {
      const req = createMockRequest({
        headers: {
          'x-request-signature': 'some-signature',
          'x-request-timestamp': 'not-a-number',
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should return error for expired timestamp', () => {
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
      const req = createMockRequest({
        headers: {
          'x-request-signature': 'some-signature',
          'x-request-timestamp': oldTimestamp,
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request timestamp expired or too far in future');
    });

    it('should return error for future timestamp', () => {
      const futureTimestamp = (Date.now() + 10 * 60 * 1000).toString(); // 10 minutes in future
      const req = createMockRequest({
        headers: {
          'x-request-signature': 'some-signature',
          'x-request-timestamp': futureTimestamp,
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request timestamp expired or too far in future');
    });

    it('should return error for invalid signature', () => {
      const timestamp = Date.now().toString();
      const req = createMockRequest({
        headers: {
          'x-request-signature': 'a'.repeat(64), // Invalid but proper length
          'x-request-timestamp': timestamp,
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should validate a correctly signed request', () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateRequestSignature(
        'POST',
        '/api/test',
        timestamp,
        JSON.stringify(body),
        TEST_SECRET
      );

      const req = createMockRequest({
        body,
        headers: {
          'x-request-signature': signature,
          'x-request-timestamp': timestamp,
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate request with empty body', () => {
      const timestamp = Date.now().toString();
      const signature = generateRequestSignature('GET', '/api/test', timestamp, '', TEST_SECRET);

      const req = createMockRequest({
        method: 'GET',
        body: undefined,
        headers: {
          'x-request-signature': signature,
          'x-request-timestamp': timestamp,
        },
      });

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(true);
    });
  });

  describe('signRequest', () => {
    it('should generate all required headers', () => {
      const headers = signRequest('POST', '/api/test', { data: 'test' }, TEST_SECRET);

      expect(headers).toHaveProperty('x-request-signature');
      expect(headers).toHaveProperty('x-request-timestamp');
      expect(headers).toHaveProperty('x-request-nonce');
    });

    it('should generate valid signature that can be verified', () => {
      const body = { data: 'test' };
      const headers = signRequest('POST', '/api/test', body, TEST_SECRET);

      const reqHeaders: Record<string, string> = {
        'x-request-signature': headers['x-request-signature'],
        'x-request-timestamp': headers['x-request-timestamp'],
        'x-request-nonce': headers['x-request-nonce'],
      };
      const req = {
        method: 'POST',
        path: '/api/test',
        body,
        headers: reqHeaders,
        get: (name: string) => reqHeaders[name.toLowerCase()],
      } as unknown as Request;

      const result = validateRequestSignature(req, TEST_SECRET);

      expect(result.isValid).toBe(true);
    });

    it('should handle undefined body', () => {
      const headers = signRequest('GET', '/api/test', undefined, TEST_SECRET);

      expect(headers['x-request-signature']).toBeDefined();
      expect(headers['x-request-signature']).toHaveLength(64);
    });

    it('should generate unique nonces', () => {
      const headers1 = signRequest('POST', '/api/test', { data: 'test' }, TEST_SECRET);
      const headers2 = signRequest('POST', '/api/test', { data: 'test' }, TEST_SECRET);

      expect(headers1['x-request-nonce']).not.toBe(headers2['x-request-nonce']);
    });
  });

  describe('generateNonce', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateNonce();

      expect(nonce).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(nonce)).toBe(true);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }

      expect(nonces.size).toBe(100);
    });
  });

  describe('requireSignedRequest middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnThis();

      const mockHeaders: Record<string, string> = {};
      mockReq = {
        method: 'POST',
        path: '/api/test',
        body: { data: 'test' },
        headers: mockHeaders,
        ip: '127.0.0.1',
        get: function (this: typeof mockReq, name: string) {
          const hdrs = (this as Record<string, unknown>).headers as Record<
            string,
            string | string[] | undefined
          >;
          const val = hdrs[name.toLowerCase()];
          return Array.isArray(val) ? val[0] : val;
        } as Request['get'],
      };

      mockRes = {
        status: statusMock,
        json: jsonMock,
      };

      mockNext = jest.fn();
    });

    it('should skip validation in development without secret', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const middleware = requireSignedRequest({ secret: undefined });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should call next for valid signature', () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateRequestSignature(
        'POST',
        '/api/test',
        timestamp,
        JSON.stringify(body),
        TEST_SECRET
      );

      mockReq.body = body;
      mockReq.headers = {
        'x-request-signature': signature,
        'x-request-timestamp': timestamp,
      };

      const middleware = requireSignedRequest({ secret: TEST_SECRET });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid signature', () => {
      mockReq.headers = {
        'x-request-signature': 'invalid',
        'x-request-timestamp': Date.now().toString(),
      };

      const middleware = requireSignedRequest({ secret: TEST_SECRET });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Request signature validation failed',
        })
      );
    });

    it('should skip validation for unsigned requests when optional', () => {
      mockReq.headers = {};

      const middleware = requireSignedRequest({ secret: TEST_SECRET, optional: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should validate when signature present even if optional', () => {
      mockReq.headers = {
        'x-request-signature': 'invalid',
        'x-request-timestamp': Date.now().toString(),
      };

      const middleware = requireSignedRequest({ secret: TEST_SECRET, optional: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });
});
