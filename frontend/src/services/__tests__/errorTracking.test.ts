/**
 * Tests for Frontend Error Tracking Service
 */

import { apiClient } from '@/services/apiClient';
import { ErrorContext, ErrorSeverity, ErrorTrackingService } from '@/services/errorTracking';

jest.mock('../../services/apiClient', () => ({
  apiClient: {
    postRaw: jest.fn(),
  },
}));

const mockPostRaw = apiClient.postRaw as jest.Mock;

describe('ErrorTrackingService', () => {
  let errorTrackingService: ErrorTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance for testing
    (ErrorTrackingService as any).instance = undefined;
    errorTrackingService = ErrorTrackingService.getInstance();

    mockPostRaw.mockResolvedValue({ success: true });

    // Mock console methods
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(console.info).toHaveBeenCalledWith(
        '[INFO] ErrorTrackingService initialized successfully'
      );
    });

    it('should not initialize twice', () => {
      errorTrackingService.initialize();
      errorTrackingService.initialize();
      expect(console.warn).toHaveBeenCalledWith('[WARN] ErrorTrackingService already initialized');
    });
  });

  describe('trackError', () => {
    it('should track error with minimal options', () => {
      const error = new Error('Test error');

      errorTrackingService.trackError(error);

      expect(mockPostRaw).toHaveBeenCalledWith(
        '/api/v2/errors/track',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
          severity: 'error',
          context: expect.objectContaining({
            page: expect.any(String),
            route: expect.any(String),
          }),
        })
      );
    });

    it('should track error with context', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user123',
        organizationId: 'org456',
        component: 'TestComponent',
      };

      errorTrackingService.trackError(error, { context });

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.context).toMatchObject({
        userId: 'user123',
        organizationId: 'org456',
        component: 'TestComponent',
      });
    });

    it('should track error with custom severity and tags', () => {
      const error = new Error('Test error');
      const tags = { customTag: 'value' };

      errorTrackingService.trackError(error, {
        severity: ErrorSeverity.Critical,
        tags,
      });

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.severity).toBe('critical');
      expect(body.tags).toMatchObject(tags);
    });

    it('should include browser context', () => {
      const error = new Error('Test error');

      errorTrackingService.trackError(error);

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.context).toHaveProperty('page');
      expect(body.context).toHaveProperty('userAgent');
      expect(body.context).toHaveProperty('browserInfo');
      expect(body.context).toHaveProperty('screenResolution');
    });

    it('should handle fetch failure gracefully', async () => {
      mockPostRaw.mockRejectedValue(new Error('Network error'));
      const error = new Error('Test error');

      expect(() => errorTrackingService.trackError(error)).not.toThrow();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  describe('trackCriticalError', () => {
    it('should track error with critical severity', () => {
      const error = new Error('Critical error');

      errorTrackingService.trackCriticalError(error);

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.severity).toBe('critical');
    });

    it('should track critical error with context', () => {
      const error = new Error('Critical error');
      const context: ErrorContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      errorTrackingService.trackCriticalError(error, context);

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.context).toMatchObject({
        userId: 'user123',
        organizationId: 'org456',
      });
    });
  });

  describe('trackAsyncError', () => {
    it('should track error from promise rejection', () => {
      const error = new Error('Async error');

      errorTrackingService.trackAsyncError(error);

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.tags).toMatchObject({
        errorType: 'unhandledRejection',
      });
    });

    it('should convert non-Error objects to Error', () => {
      errorTrackingService.trackAsyncError('string error');

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.error.message).toBe('string error');
    });

    it('should track async error with context', () => {
      const error = new Error('Async error');
      const context: ErrorContext = {
        userId: 'user123',
        route: '/test',
      };

      errorTrackingService.trackAsyncError(error, context);

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.context).toMatchObject({
        userId: 'user123',
        route: '/test',
      });
    });
  });

  describe('trackComponentError', () => {
    it('should track React component error', () => {
      const error = new Error('Component error');
      const componentStack = 'at Component (Component.tsx:10)';

      errorTrackingService.trackComponentError(error, componentStack, 'TestComponent');

      expect(mockPostRaw).toHaveBeenCalled();
      const body = mockPostRaw.mock.calls[0][1];

      expect(body.context.component).toBe('TestComponent');
      expect(body.context.additionalData.componentStack).toBe(componentStack);
      expect(body.tags).toMatchObject({
        errorType: 'reactComponent',
      });
    });
  });

  describe('Error queue', () => {
    it('should add errors to queue', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorTrackingService.trackError(error1);
      errorTrackingService.trackError(error2);

      const queue = errorTrackingService.getQueuedErrors();
      expect(queue).toHaveLength(2);
      expect(queue[0].error.message).toBe('Error 1');
      expect(queue[1].error.message).toBe('Error 2');
    });

    it('should limit queue size', () => {
      // Track more errors than max queue size
      for (let i = 0; i < 150; i++) {
        errorTrackingService.trackError(new Error(`Error ${i}`));
      }

      const queue = errorTrackingService.getQueuedErrors();
      expect(queue.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Global error handlers', () => {
    it('should set up error event listener on initialization', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      errorTrackingService.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });
});
