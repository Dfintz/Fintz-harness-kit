import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

// Mock dependencies BEFORE importing auth middleware
jest.mock('../../utils/auditLogger');
jest.mock('../../services/authentication', () => ({
  AuthenticationService: jest.fn().mockImplementation(() => ({
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    validateAccessToken: jest.fn().mockImplementation(async token => {
      // Simple validation for testing
      try {
        const jwt = require('jsonwebtoken');
        return jwt.verify(token, 'test-jwt-secret-for-testing');
      } catch (error) {
        throw new Error('Invalid or expired token');
      }
    }),
    generateAccessToken: jest.fn().mockImplementation(payload => {
      const jwt = require('jsonwebtoken');
      return jwt.sign(payload, 'test-jwt-secret-for-testing', { expiresIn: '1h' });
    }),
  })),
}));
jest.mock('../../services/infrastructure', () => ({
  SecretsManagerService: {
    getInstance: jest.fn().mockReturnValue({
      getJwtSecret: jest.fn().mockReturnValue('test-jwt-secret-for-testing'),
    }),
  },
  SecretsManagerServiceDefault: {
    getInstance: jest.fn().mockReturnValue({
      getJwtSecret: jest.fn().mockReturnValue('test-jwt-secret-for-testing'),
    }),
  },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
  },
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Now import after mocks are defined
import {
  __resetSessionBindingWarnStateForTests,
  authenticateToken,
  AuthRequest,
  generateToken,
} from '../../middleware/auth';
import * as auditLogger from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      path: '/api/test',
      method: 'GET',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    __resetSessionBindingWarnStateForTests();
    process.env.SESSION_BINDING_ENFORCE = 'false';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SESSION_BINDING_ENFORCE;
  });

  describe('authenticateToken', () => {
    it('should call next() with a valid token', async () => {
      const payload = { id: '1', username: 'testuser', role: 'user' };
      const token = generateToken(payload);

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
        'user-agent': 'Test Agent',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.username).toBe('testuser');
      expect(auditLogger.logAuthenticationAttempt).toHaveBeenCalledWith(
        true,
        '1',
        'testuser',
        '127.0.0.1',
        'Test Agent'
      );
    });

    it('should return 401 if no token is provided', async () => {
      mockRequest.headers = {
        'user-agent': 'Test Agent',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(nextFunction).not.toHaveBeenCalled();
      expect(auditLogger.logAuditEvent).toHaveBeenCalled();
    });

    it('should not allow x-bot-internal-token to bypass auth', async () => {
      mockRequest.headers = {
        'user-agent': 'Test Agent',
        'x-bot-internal-token': 'bot-token-only',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(nextFunction).not.toHaveBeenCalled();
      expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            hasBotToken: true,
          }),
        })
      );
    });

    it('should return 401 with an invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken',
        'user-agent': 'Test Agent',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(nextFunction).not.toHaveBeenCalled();
      expect(auditLogger.logAuthenticationAttempt).toHaveBeenCalledWith(
        false,
        undefined,
        undefined,
        '127.0.0.1',
        'Test Agent',
        expect.any(String)
      );
    });

    it('should log session binding mismatch once per cooldown window in warn-only mode', async () => {
      const payload = {
        id: '1',
        username: 'testuser',
        role: 'user',
        sessionBinding: {
          ipHash: 'mismatch-ip-hash',
          uaHash: 'mismatch-ua-hash',
        },
      };
      const token = generateToken(
        payload as unknown as { id: string; username: string; role: string }
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
        'user-agent': 'Test Agent',
      };
      mockRequest.path = '/api/v2/auth/me';

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);
      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      const warnCalls = (logger.warn as jest.Mock).mock.calls.filter(
        ([message]: [string]) => message === 'Session binding mismatch'
      );

      expect(warnCalls).toHaveLength(1);
      expect(nextFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { id: '1', username: 'testuser', role: 'admin' };
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded.id).toBe('1');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('admin');
    });
  });
});
