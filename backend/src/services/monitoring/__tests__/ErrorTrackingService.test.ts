/**
 * Tests for ErrorTrackingService
 */

import { Request } from 'express';
import { getAppInsightsClient } from '../../../config/applicationInsights';
import logger from '../../../utils/logger';
import { ErrorContext, ErrorSeverity, ErrorTrackingService } from '../ErrorTrackingService';

// Mock dependencies
jest.mock('../../../config/applicationInsights');
jest.mock('applicationinsights');
jest.mock('../../../middleware/requestCorrelation', () => ({
  getCorrelationData: jest.fn((req: any) => ({
    requestId: req.headers?.['x-request-id'] || 'unknown',
    correlationId: req.headers?.['x-correlation-id'] || 'unknown',
    duration: undefined,
  })),
  getBreadcrumbs: jest.fn(() => []),
  addBreadcrumb: jest.fn(),
}));

describe('ErrorTrackingService', () => {
  let errorTrackingService: ErrorTrackingService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance for testing
    (ErrorTrackingService as any).instance = undefined;
    errorTrackingService = ErrorTrackingService.getInstance();

    // Mock Application Insights client
    mockClient = {
      trackException: jest.fn(),
      flush: jest.fn((options?: any) => {
        if (options?.callback) {
          options.callback();
        }
      }),
    };
    (getAppInsightsClient as jest.Mock).mockReturnValue(mockClient);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorTrackingService.getInstance();
      const instance2 = ErrorTrackingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize service successfully', () => {
      errorTrackingService.initialize();
      expect(logger.info).toHaveBeenCalledWith('ErrorTrackingService initialized successfully');
    });

    it('should not initialize twice', () => {
      errorTrackingService.initialize();
      errorTrackingService.initialize();
      expect(logger.warn).toHaveBeenCalledWith('ErrorTrackingService already initialized');
    });
  });

  describe('trackError', () => {
    it('should track error with minimal options', () => {
      const error = new Error('Test error');

      errorTrackingService.trackError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Error tracked',
        expect.objectContaining({
          error: 'Test error',
          stack: expect.any(String),
        })
      );

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: error,
          properties: expect.objectContaining({
            errorName: 'Error',
            errorMessage: 'Test error',
            severity: 'Error',
          }),
        })
      );
    });

    it('should track error with context', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user123',
        organizationId: 'org456',
        route: '/api/test',
        method: 'GET',
      };

      errorTrackingService.trackError(error, { context });

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            userId: 'user123',
            organizationId: 'org456',
            route: '/api/test',
            method: 'GET',
          }),
        })
      );
    });

    it('should track error with custom tags and metrics', () => {
      const error = new Error('Test error');
      const tags = { customTag: 'value' };
      const metrics = { responseTime: 123 };

      errorTrackingService.trackError(error, { tags, metrics });

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            customTag: 'value',
          }),
          measurements: metrics,
        })
      );
    });

    it('should track critical error and flush immediately', () => {
      const error = new Error('Critical error');

      errorTrackingService.trackError(error, {
        severity: ErrorSeverity.Critical,
      });

      expect(mockClient.trackException).toHaveBeenCalled();
      expect(mockClient.flush).toHaveBeenCalled();
    });

    it('should handle errors when Application Insights client is not available', () => {
      (getAppInsightsClient as jest.Mock).mockReturnValue(undefined);
      const error = new Error('Test error');

      expect(() => errorTrackingService.trackError(error)).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include stack trace in properties', () => {
      const error = new Error('Test error');

      errorTrackingService.trackError(error);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            stackTrace: expect.any(String),
          }),
        })
      );
    });
  });

  describe('trackRequestError', () => {
    it('should extract and track error from request', () => {
      const error = new Error('Request error');
      const mockRequest = {
        user: { id: 'user123' },
        organizationId: 'org456',
        route: { path: '/api/test' },
        method: 'POST',
        headers: {
          'user-agent': 'test-agent',
          'x-request-id': 'req123',
        },
        ip: '127.0.0.1',
      } as any as Request;

      errorTrackingService.trackRequestError(error, mockRequest);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            userId: 'user123',
            organizationId: 'org456',
            route: '/api/test',
            method: 'POST',
            requestId: 'req123',
            correlationId: 'unknown',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1',
          }),
        })
      );
    });

    it('should handle request with minimal information', () => {
      const error = new Error('Request error');
      const mockRequest = {
        path: '/api/test',
        method: 'GET',
        headers: {},
      } as any as Request;

      expect(() => errorTrackingService.trackRequestError(error, mockRequest)).not.toThrow();
      expect(mockClient.trackException).toHaveBeenCalled();
    });
  });

  describe('trackAsyncError', () => {
    it('should track error from promise rejection', () => {
      const error = new Error('Async error');

      errorTrackingService.trackAsyncError(error);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: error,
          properties: expect.objectContaining({
            errorType: 'unhandledRejection',
          }),
        })
      );
    });

    it('should convert non-Error objects to Error', () => {
      errorTrackingService.trackAsyncError('string error');

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: expect.any(Error),
        })
      );
    });

    it('should track async error with context', () => {
      const error = new Error('Async error');
      const context: ErrorContext = {
        userId: 'user123',
        route: '/api/async',
      };

      errorTrackingService.trackAsyncError(error, context);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            userId: 'user123',
            route: '/api/async',
          }),
        })
      );
    });
  });

  describe('trackCriticalError', () => {
    it('should track error with critical severity', () => {
      const error = new Error('Critical error');

      errorTrackingService.trackCriticalError(error);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: ErrorSeverity.Critical,
        })
      );
      expect(mockClient.flush).toHaveBeenCalled();
    });

    it('should track critical error with context', () => {
      const error = new Error('Critical error');
      const context: ErrorContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      errorTrackingService.trackCriticalError(error, context);

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            userId: 'user123',
            organizationId: 'org456',
          }),
        })
      );
    });
  });

  describe('Global error handlers', () => {
    let originalProcessOn: any;
    let processOnSpy: jest.SpyInstance;

    beforeEach(() => {
      originalProcessOn = process.on;
      processOnSpy = jest.spyOn(process, 'on');
    });

    afterEach(() => {
      processOnSpy.mockRestore();
    });

    it('should set up global error handlers on initialization', () => {
      errorTrackingService.initialize();

      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('warning', expect.any(Function));
    });

    it('should filter out Application Insights quota exceeded errors', () => {
      errorTrackingService.initialize();

      // Get the unhandledRejection handler
      const unhandledRejectionHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'unhandledRejection'
      )?.[1];

      expect(unhandledRejectionHandler).toBeDefined();

      // Simulate a quota exceeded error
      const quotaError = new Error(
        'PeriodicExportingMetricReader: metrics export failed (error RestError: {"itemsReceived":2,"itemsAccepted":0,"errors":[{"index":0,"statusCode":439,"message":"Daily quota exceeded"}]})'
      );

      // Call the handler
      unhandledRejectionHandler(quotaError, Promise.resolve());

      // Should log as warning, not error
      expect(logger.warn).toHaveBeenCalledWith(
        'Application Insights quota exceeded - telemetry export throttled',
        expect.objectContaining({
          message: expect.stringContaining('Daily quota exceeded'),
        })
      );

      // Should NOT track as error
      expect(mockClient.trackException).not.toHaveBeenCalled();
    });

    it('should filter out quota errors with statusCode 439', () => {
      errorTrackingService.initialize();

      const unhandledRejectionHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'unhandledRejection'
      )?.[1];

      const quotaError = {
        message: 'Export failed',
        statusCode: 439,
      };

      unhandledRejectionHandler(quotaError, Promise.resolve());

      expect(logger.warn).toHaveBeenCalledWith(
        'Application Insights quota exceeded - telemetry export throttled',
        expect.objectContaining({
          statusCode: 439,
        })
      );
      expect(mockClient.trackException).not.toHaveBeenCalled();
    });

    it('should still track non-quota errors normally', () => {
      errorTrackingService.initialize();

      const unhandledRejectionHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'unhandledRejection'
      )?.[1];

      const normalError = new Error('Some other error');

      unhandledRejectionHandler(normalError, Promise.resolve());

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Promise Rejection detected',
        expect.objectContaining({
          error: 'Some other error',
        })
      );
      expect(mockClient.trackException).toHaveBeenCalled();
    });
  });

  describe('Error context with additional data', () => {
    it('should serialize additional data to JSON', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user123',
        additionalData: {
          customField: 'value',
          nestedObject: { key: 'value' },
        },
      };

      errorTrackingService.trackError(error, { context });

      expect(mockClient.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            additionalData: expect.stringContaining('customField'),
          }),
        })
      );
    });

    it('should redact Authorization and api_key before emitting telemetry', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user123',
        additionalData: {
          Authorization: 'Bearer leaked-token',
          api_key: 'leaked-api-key',
          nested: {
            Authorization: 'Bearer nested-token',
          },
        },
      };

      errorTrackingService.trackError(error, { context });

      const trackExceptionCall = mockClient.trackException.mock.calls[0]?.[0];
      const telemetryProperties = trackExceptionCall?.properties as Record<string, string>;

      expect(telemetryProperties.additionalData).toContain('"Authorization":"[REDACTED]"');
      expect(telemetryProperties.additionalData).toContain('"api_key":"[REDACTED]"');
      expect(telemetryProperties.additionalData).not.toContain('leaked-token');
      expect(telemetryProperties.additionalData).not.toContain('leaked-api-key');
    });

    it('should handle non-serializable additional data gracefully', () => {
      const error = new Error('Test error');
      const circular: any = {};
      circular.self = circular;

      const context: ErrorContext = {
        userId: 'user123',
        additionalData: circular,
      };

      expect(() => errorTrackingService.trackError(error, { context })).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to stringify additional error data',
        expect.any(Object)
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

