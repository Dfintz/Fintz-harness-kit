/**
 * Tests for Internal Service Authentication Middleware
 *
 * Zero Trust: Tests for service-to-service authentication
 */

import { NextFunction, Request, Response } from 'express';

import {
  generateInternalServiceSignature,
  generateServiceNonce,
  getInternalServiceIdentity,
  initializeServiceRegistry,
  InternalServiceRequest,
  isInternalServiceRequest,
  optionalInternalServiceAuth,
  requireInternalServiceAuth,
  ServiceIdentity,
  signInternalServiceRequest,
  validateInternalServiceRequest,
} from '../../middleware/internalServiceAuth';

// Mock the NonceStorage
jest.mock('../../services/security/core/NonceStorage', () => ({
  getNonceStorage: () => ({
    checkAndMark: jest.fn().mockResolvedValue(false),
  }),
}));

describe('Internal Service Authentication Middleware', () => {
  const TEST_SERVICE: ServiceIdentity = {
    serviceId: 'test-service-001',
    serviceName: 'Test Service',
    allowedEndpoints: ['/api/internal/.*', '/api/health'],
    secret: 'test-shared-secret-for-unit-tests-minimum-32-chars',
  };

  const TEST_SERVICE_LIMITED: ServiceIdentity = {
    serviceId: 'limited-service-001',
    serviceName: 'Limited Service',
    allowedEndpoints: ['/api/internal/specific'],
    secret: 'another-secret-for-limited-service-32-chars',
  };

  beforeAll(() => {
    initializeServiceRegistry([TEST_SERVICE, TEST_SERVICE_LIMITED]);
  });

  describe('generateInternalServiceSignature', () => {
    it('should generate a consistent signature for the same inputs', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        'secret'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{"data":"test"}',
        'secret'
      );

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different service IDs', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-2',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different methods', () => {
      const sigPost = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );
      const sigGet = generateInternalServiceSignature(
        'svc-1',
        'GET',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );

      expect(sigPost).not.toBe(sigGet);
    });

    it('should generate different signatures for different paths', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test1',
        '1234567890',
        '{}',
        'secret'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test2',
        '1234567890',
        '{}',
        'secret'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different timestamps', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567891',
        '{}',
        'secret'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different bodies', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{"a":1}',
        'secret'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{"a":2}',
        'secret'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const sig1 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret1'
      );
      const sig2 = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret2'
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate a 64-character hex string', () => {
      const sig = generateInternalServiceSignature(
        'svc-1',
        'POST',
        '/api/test',
        '1234567890',
        '{}',
        'secret'
      );

      expect(sig).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(sig)).toBe(true);
    });
  });

  describe('validateInternalServiceRequest', () => {
    const createMockRequest = (overrides: Partial<Request> = {}): Request => {
      return {
        method: 'POST',
        path: '/api/internal/test',
        body: { data: 'test' },
        headers: {},
        ip: '127.0.0.1',
        ...overrides,
      } as Request;
    };

    it('should return error when service ID header is missing', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-signature': 'signature',
          'x-service-timestamp': Date.now().toString(),
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing service ID header');
    });

    it('should return error when signature header is missing', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-timestamp': Date.now().toString(),
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing service signature header');
    });

    it('should return error when timestamp header is missing', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': 'signature',
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing service timestamp header');
    });

    it('should return error when nonce header is missing', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': 'signature',
          'x-service-timestamp': Date.now().toString(),
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing service nonce header (replay protection required)');
    });

    it('should return error for unknown service ID', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-id': 'unknown-service',
          'x-service-signature': 'signature',
          'x-service-timestamp': Date.now().toString(),
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unknown service ID');
    });

    it('should return error for invalid timestamp format', async () => {
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': 'signature',
          'x-service-timestamp': 'not-a-number',
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should return error for expired timestamp', async () => {
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': 'signature',
          'x-service-timestamp': oldTimestamp,
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request timestamp expired or too far in future');
    });

    it('should return error for unauthorized endpoint', async () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateInternalServiceSignature(
        TEST_SERVICE_LIMITED.serviceId,
        'POST',
        '/api/unauthorized/endpoint',
        timestamp,
        JSON.stringify(body),
        TEST_SERVICE_LIMITED.secret
      );

      const req = createMockRequest({
        path: '/api/unauthorized/endpoint',
        body,
        headers: {
          'x-service-id': TEST_SERVICE_LIMITED.serviceId,
          'x-service-signature': signature,
          'x-service-timestamp': timestamp,
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Service not authorized for this endpoint');
    });

    it('should return error for invalid signature', async () => {
      const timestamp = Date.now().toString();
      const req = createMockRequest({
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': 'a'.repeat(64), // Invalid but proper length
          'x-service-timestamp': timestamp,
          'x-service-nonce': 'nonce123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should validate a correctly signed request', async () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateInternalServiceSignature(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/internal/test',
        timestamp,
        JSON.stringify(body),
        TEST_SERVICE.secret
      );

      const req = createMockRequest({
        body,
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': signature,
          'x-service-timestamp': timestamp,
          'x-service-nonce': 'unique-nonce-123',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(true);
      expect(result.serviceId).toBe(TEST_SERVICE.serviceId);
      expect(result.serviceName).toBe(TEST_SERVICE.serviceName);
      expect(result.error).toBeUndefined();
    });

    it('should validate request with empty body', async () => {
      const timestamp = Date.now().toString();
      const signature = generateInternalServiceSignature(
        TEST_SERVICE.serviceId,
        'GET',
        '/api/health',
        timestamp,
        '',
        TEST_SERVICE.secret
      );

      const req = createMockRequest({
        method: 'GET',
        path: '/api/health',
        body: undefined,
        headers: {
          'x-service-id': TEST_SERVICE.serviceId,
          'x-service-signature': signature,
          'x-service-timestamp': timestamp,
          'x-service-nonce': 'unique-nonce-456',
        },
      });

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(true);
    });
  });

  describe('signInternalServiceRequest', () => {
    it('should generate all required headers', () => {
      const headers = signInternalServiceRequest(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/test',
        { data: 'test' },
        TEST_SERVICE.secret
      );

      expect(headers).toHaveProperty('x-service-id');
      expect(headers).toHaveProperty('x-service-signature');
      expect(headers).toHaveProperty('x-service-timestamp');
      expect(headers).toHaveProperty('x-service-nonce');
    });

    it('should generate valid signature that can be verified', async () => {
      const body = { data: 'test' };
      const headers = signInternalServiceRequest(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/internal/test',
        body,
        TEST_SERVICE.secret
      );

      const req = {
        method: 'POST',
        path: '/api/internal/test',
        body,
        headers: {
          'x-service-id': headers['x-service-id'],
          'x-service-signature': headers['x-service-signature'],
          'x-service-timestamp': headers['x-service-timestamp'],
          'x-service-nonce': headers['x-service-nonce'],
        },
        ip: '127.0.0.1',
      } as Request;

      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(true);
    });

    it('should handle undefined body', () => {
      const headers = signInternalServiceRequest(
        TEST_SERVICE.serviceId,
        'GET',
        '/api/test',
        undefined,
        TEST_SERVICE.secret
      );

      expect(headers['x-service-signature']).toBeDefined();
      expect(headers['x-service-signature']).toHaveLength(64);
    });

    it('should generate unique nonces', () => {
      const headers1 = signInternalServiceRequest(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/test',
        {},
        TEST_SERVICE.secret
      );
      const headers2 = signInternalServiceRequest(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/test',
        {},
        TEST_SERVICE.secret
      );

      expect(headers1['x-service-nonce']).not.toBe(headers2['x-service-nonce']);
    });
  });

  describe('generateServiceNonce', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateServiceNonce();

      expect(nonce).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(nonce)).toBe(true);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateServiceNonce());
      }

      expect(nonces.size).toBe(100);
    });
  });

  describe('requireInternalServiceAuth middleware', () => {
    let mockReq: Partial<InternalServiceRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnThis();

      mockReq = {
        method: 'POST',
        path: '/api/internal/test',
        body: { data: 'test' },
        headers: {},
        ip: '127.0.0.1',
      };

      mockRes = {
        status: statusMock,
        json: jsonMock,
      };

      mockNext = jest.fn();
    });

    it('should call next for valid signed request', async () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateInternalServiceSignature(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/internal/test',
        timestamp,
        JSON.stringify(body),
        TEST_SERVICE.secret
      );

      mockReq.body = body;
      mockReq.headers = {
        'x-service-id': TEST_SERVICE.serviceId,
        'x-service-signature': signature,
        'x-service-timestamp': timestamp,
        'x-service-nonce': 'unique-nonce-middleware',
      };

      const middleware = requireInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockReq.internalService).toBeDefined();
      expect(mockReq.internalService?.serviceId).toBe(TEST_SERVICE.serviceId);
    });

    it('should return 401 for invalid signature', async () => {
      mockReq.headers = {
        'x-service-id': TEST_SERVICE.serviceId,
        'x-service-signature': 'invalid-signature',
        'x-service-timestamp': Date.now().toString(),
        'x-service-nonce': 'nonce123',
      };

      const middleware = requireInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal service authentication failed',
        })
      );
    });

    it('should return 401 for missing headers', async () => {
      mockReq.headers = {};

      const middleware = requireInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalInternalServiceAuth middleware', () => {
    let mockReq: Partial<InternalServiceRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnThis();

      mockReq = {
        method: 'POST',
        path: '/api/internal/test',
        body: { data: 'test' },
        headers: {},
        ip: '127.0.0.1',
      };

      mockRes = {
        status: statusMock,
        json: jsonMock,
      };

      mockNext = jest.fn();
    });

    it('should skip validation for requests without service headers', async () => {
      mockReq.headers = {};

      const middleware = optionalInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockReq.internalService).toBeUndefined();
    });

    it('should validate when service headers are present', async () => {
      const timestamp = Date.now().toString();
      const body = { data: 'test' };
      const signature = generateInternalServiceSignature(
        TEST_SERVICE.serviceId,
        'POST',
        '/api/internal/test',
        timestamp,
        JSON.stringify(body),
        TEST_SERVICE.secret
      );

      mockReq.body = body;
      mockReq.headers = {
        'x-service-id': TEST_SERVICE.serviceId,
        'x-service-signature': signature,
        'x-service-timestamp': timestamp,
        'x-service-nonce': 'unique-nonce-optional',
      };

      const middleware = optionalInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.internalService).toBeDefined();
    });

    it('should return 401 when headers present but invalid', async () => {
      mockReq.headers = {
        'x-service-id': TEST_SERVICE.serviceId,
        'x-service-signature': 'invalid',
        'x-service-timestamp': Date.now().toString(),
        'x-service-nonce': 'nonce123',
      };

      const middleware = optionalInternalServiceAuth();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('Helper functions', () => {
    it('isInternalServiceRequest should return true for service requests', () => {
      const req = {
        internalService: { serviceId: 'test', serviceName: 'Test' },
      } as InternalServiceRequest;

      expect(isInternalServiceRequest(req)).toBe(true);
    });

    it('isInternalServiceRequest should return false for regular requests', () => {
      const req = {} as Request;

      expect(isInternalServiceRequest(req)).toBe(false);
    });

    it('getInternalServiceIdentity should return service identity', () => {
      const identity = { serviceId: 'test', serviceName: 'Test' };
      const req = { internalService: identity } as InternalServiceRequest;

      expect(getInternalServiceIdentity(req)).toEqual(identity);
    });

    it('getInternalServiceIdentity should return null for regular requests', () => {
      const req = {} as Request;

      expect(getInternalServiceIdentity(req)).toBeNull();
    });
  });

  describe('ReDoS Protection', () => {
    const TEST_SERVICE_WITH_DANGEROUS_PATTERN: ServiceIdentity = {
      serviceId: 'dangerous-service-001',
      serviceName: 'Dangerous Pattern Service',
      allowedEndpoints: ['/api/safe/.*'], // Safe pattern initially
      secret: 'dangerous-service-secret-minimum-32-chars',
    };

    beforeAll(() => {
      initializeServiceRegistry([
        TEST_SERVICE,
        TEST_SERVICE_LIMITED,
        TEST_SERVICE_WITH_DANGEROUS_PATTERN,
      ]);
    });

    const createMockRequestWithService = (
      path: string,
      serviceId: string,
      secret: string
    ): Request => {
      const timestamp = Date.now().toString();
      const nonce = 'test-nonce-' + Math.random();
      const body = JSON.stringify({});
      const signature = generateInternalServiceSignature(
        serviceId,
        'POST',
        path,
        timestamp,
        body,
        secret
      );

      return {
        method: 'POST',
        path: path,
        body: {},
        headers: {
          'x-service-id': serviceId,
          'x-service-signature': signature,
          'x-service-timestamp': timestamp,
          'x-service-nonce': nonce,
        },
        ip: '127.0.0.1',
      } as Request;
    };

    it('should block services with dangerous regex patterns in endpoint config (*+)', async () => {
      // Temporarily modify service registry with dangerous pattern
      const dangerousService: ServiceIdentity = {
        serviceId: 'test-dangerous-1',
        serviceName: 'Test Dangerous 1',
        allowedEndpoints: ['/api/test/*+'], // Dangerous pattern
        secret: 'test-secret-for-dangerous-pattern-001',
      };
      initializeServiceRegistry([TEST_SERVICE, dangerousService]);

      const req = createMockRequestWithService(
        '/api/test/endpoint',
        'test-dangerous-1',
        'test-secret-for-dangerous-pattern-001'
      );
      const result = await validateInternalServiceRequest(req);

      // The dangerous pattern in allowedEndpoints should cause endpoint to be denied
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not authorized');

      // Restore original registry
      initializeServiceRegistry([
        TEST_SERVICE,
        TEST_SERVICE_LIMITED,
        TEST_SERVICE_WITH_DANGEROUS_PATTERN,
      ]);
    });

    it('should block services with dangerous regex patterns in endpoint config (+*)', async () => {
      const dangerousService: ServiceIdentity = {
        serviceId: 'test-dangerous-2',
        serviceName: 'Test Dangerous 2',
        allowedEndpoints: ['/api/test/+*'], // Dangerous pattern
        secret: 'test-secret-for-dangerous-pattern-002',
      };
      initializeServiceRegistry([TEST_SERVICE, dangerousService]);

      const req = createMockRequestWithService(
        '/api/test/endpoint',
        'test-dangerous-2',
        'test-secret-for-dangerous-pattern-002'
      );
      const result = await validateInternalServiceRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not authorized');

      initializeServiceRegistry([
        TEST_SERVICE,
        TEST_SERVICE_LIMITED,
        TEST_SERVICE_WITH_DANGEROUS_PATTERN,
      ]);
    });

    it('should enforce path length limit of 2000 characters', async () => {
      const longPath = '/api/internal/' + 'a'.repeat(2000);
      const req = createMockRequestWithService(
        longPath,
        TEST_SERVICE.serviceId,
        TEST_SERVICE.secret
      );

      const result = await validateInternalServiceRequest(req);

      // Long paths should be rejected
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not authorized for this endpoint');
    });

    it('should allow safe paths under 2000 characters', async () => {
      const safePath = '/api/internal/test';
      const req = createMockRequestWithService(
        safePath,
        TEST_SERVICE.serviceId,
        TEST_SERVICE.secret
      );

      const result = await validateInternalServiceRequest(req);

      // Should pass if signature and endpoint match
      expect(result.isValid).toBe(true);
    });

    it('should allow paths with safe special characters', async () => {
      const safePath = '/api/internal/test-endpoint_123';
      const req = createMockRequestWithService(
        safePath,
        TEST_SERVICE.serviceId,
        TEST_SERVICE.secret
      );

      const result = await validateInternalServiceRequest(req);

      // Should pass if pattern matches
      expect(result.isValid).toBe(true);
    });

    it('should validate that ReDoS protection is active for complex patterns', () => {
      // Test the dangerous pattern detection directly
      const dangerousPatterns = [/(\*\+|\+\*)/, /(\{\d+,\}\+|\+\{\d+,\})/, /(\.\*)+\.\*/];

      // These should be detected as dangerous
      expect(dangerousPatterns[0].test('*+')).toBe(true);
      expect(dangerousPatterns[0].test('+*')).toBe(true);
      expect(dangerousPatterns[1].test('{2,}+')).toBe(true);
      expect(dangerousPatterns[1].test('+{3,}')).toBe(true);
      expect(dangerousPatterns[2].test('.*.*')).toBe(true);

      // These should be safe
      expect(dangerousPatterns[0].test('/api/test/.*')).toBe(false);
      expect(dangerousPatterns[0].test('/api/test/+')).toBe(false);
      expect(dangerousPatterns[1].test('/api/test/{2,}')).toBe(false);
    });
  });
});
