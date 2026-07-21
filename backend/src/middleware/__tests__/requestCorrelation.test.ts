/**
 * Tests for Request Correlation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestCorrelationMiddleware,
  addBreadcrumb,
  getBreadcrumbs,
  getCorrelationData,
  CorrelatedRequest,
} from '../requestCorrelation';

describe('Request Correlation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let setHeaderSpy: jest.Mock;
  let finishListeners: Array<() => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    finishListeners = [];

    setHeaderSpy = jest.fn();

    mockRequest = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      query: { foo: 'bar' },
      headers: {
        'user-agent': 'test-agent',
      },
    };

    mockResponse = {
      setHeader: setHeaderSpy,
      on: jest.fn((event: string, listener: () => void) => {
        if (event === 'finish') {
          finishListeners.push(listener);
        }
        return mockResponse as Response;
      }),
    };

    nextFunction = jest.fn();
  });

  describe('requestCorrelationMiddleware', () => {
    it('should generate request and correlation IDs', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.requestId).toBeDefined();
      expect(correlatedReq.correlationId).toBeDefined();
      expect(correlatedReq.requestId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(correlatedReq.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should call next function', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should track response completion on finish event', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(finishListeners.length).toBe(1);
    });

    it('should use existing request ID from header', () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        'x-request-id': 'existing-request-id',
      };

      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.requestId).toBe('existing-request-id');
    });

    it('should use existing correlation ID from header', () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        'x-correlation-id': 'existing-correlation-id',
      };

      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.correlationId).toBe('existing-correlation-id');
    });

    it('should set correlation headers on response', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Request-Id', correlatedReq.requestId);
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Correlation-Id', correlatedReq.correlationId);
    });

    it('should initialize breadcrumbs array', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.breadcrumbs).toBeDefined();
      expect(Array.isArray(correlatedReq.breadcrumbs)).toBe(true);
    });

    it('should add initial breadcrumb', () => {
      const middleware = requestCorrelationMiddleware();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.breadcrumbs?.length).toBeGreaterThan(0);
      expect(correlatedReq.breadcrumbs?.[0]).toMatchObject({
        category: 'http',
        level: 'info',
        message: expect.stringContaining('GET /api/test'),
      });
    });

    it('should track request start time', () => {
      const middleware = requestCorrelationMiddleware();
      const before = Date.now();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      const after = Date.now();

      const correlatedReq = mockRequest as CorrelatedRequest;
      expect(correlatedReq.startTime).toBeGreaterThanOrEqual(before);
      expect(correlatedReq.startTime).toBeLessThanOrEqual(after);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb to request', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.breadcrumbs = [];

      addBreadcrumb(correlatedReq, {
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info',
        data: { foo: 'bar' },
      });

      expect(correlatedReq.breadcrumbs.length).toBe(1);
      expect(correlatedReq.breadcrumbs[0]).toMatchObject({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info',
        data: { foo: 'bar' },
        timestamp: expect.any(Number),
      });
    });

    it('should initialize breadcrumbs array if not present', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;

      addBreadcrumb(correlatedReq, {
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info',
      });

      expect(correlatedReq.breadcrumbs).toBeDefined();
      expect(correlatedReq.breadcrumbs?.length).toBe(1);
    });

    it('should add timestamp to breadcrumb', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.breadcrumbs = [];

      const before = Date.now();
      addBreadcrumb(correlatedReq, {
        category: 'test',
        message: 'Test',
        level: 'info',
      });
      const after = Date.now();

      const breadcrumb = correlatedReq.breadcrumbs[0];
      expect(breadcrumb.timestamp).toBeGreaterThanOrEqual(before);
      expect(breadcrumb.timestamp).toBeLessThanOrEqual(after);
    });

    it('should limit breadcrumbs to 50 items', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.breadcrumbs = [];

      // Add 60 breadcrumbs
      for (let i = 0; i < 60; i++) {
        addBreadcrumb(correlatedReq, {
          category: 'test',
          message: `Breadcrumb ${i}`,
          level: 'info',
        });
      }

      expect(correlatedReq.breadcrumbs.length).toBe(50);
      // Should keep the most recent ones
      expect(correlatedReq.breadcrumbs[0].message).toBe('Breadcrumb 10');
      expect(correlatedReq.breadcrumbs[49].message).toBe('Breadcrumb 59');
    });

    it('should support different breadcrumb levels', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.breadcrumbs = [];

      addBreadcrumb(correlatedReq, { category: 'test', message: 'Debug', level: 'debug' });
      addBreadcrumb(correlatedReq, { category: 'test', message: 'Info', level: 'info' });
      addBreadcrumb(correlatedReq, { category: 'test', message: 'Warning', level: 'warning' });
      addBreadcrumb(correlatedReq, { category: 'test', message: 'Error', level: 'error' });

      expect(correlatedReq.breadcrumbs[0].level).toBe('debug');
      expect(correlatedReq.breadcrumbs[1].level).toBe('info');
      expect(correlatedReq.breadcrumbs[2].level).toBe('warning');
      expect(correlatedReq.breadcrumbs[3].level).toBe('error');
    });

    it('should handle breadcrumbs without data field', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.breadcrumbs = [];

      addBreadcrumb(correlatedReq, {
        category: 'test',
        message: 'Simple breadcrumb',
        level: 'info',
      });

      expect(correlatedReq.breadcrumbs[0].data).toBeUndefined();
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return breadcrumbs from request', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      const expectedBreadcrumbs = [
        {
          timestamp: Date.now(),
          category: 'test',
          message: 'Test 1',
          level: 'info' as const,
        },
        {
          timestamp: Date.now(),
          category: 'test',
          message: 'Test 2',
          level: 'warning' as const,
        },
      ];
      correlatedReq.breadcrumbs = expectedBreadcrumbs;

      const result = getBreadcrumbs(correlatedReq);

      expect(result).toEqual(expectedBreadcrumbs);
    });

    it('should return empty array if no breadcrumbs', () => {
      const result = getBreadcrumbs(mockRequest as Request);

      expect(result).toEqual([]);
    });
  });

  describe('getCorrelationData', () => {
    it('should return correlation data from request', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.requestId = 'test-request-id';
      correlatedReq.correlationId = 'test-correlation-id';
      correlatedReq.startTime = Date.now() - 1000; // 1 second ago

      const result = getCorrelationData(correlatedReq);

      expect(result).toMatchObject({
        requestId: 'test-request-id',
        correlationId: 'test-correlation-id',
        duration: expect.any(Number),
      });
      expect(result.duration).toBeGreaterThan(900);
      expect(result.duration).toBeLessThan(1100);
    });

    it('should return unknown for missing IDs', () => {
      const result = getCorrelationData(mockRequest as Request);

      expect(result).toEqual({
        requestId: 'unknown',
        correlationId: 'unknown',
        duration: undefined,
      });
    });

    it('should return undefined duration if no start time', () => {
      const correlatedReq = mockRequest as CorrelatedRequest;
      correlatedReq.requestId = 'test-request-id';
      correlatedReq.correlationId = 'test-correlation-id';

      const result = getCorrelationData(correlatedReq);

      expect(result.duration).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
