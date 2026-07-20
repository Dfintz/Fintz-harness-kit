/**
 * Tests for Performance Monitoring Service
 */

import { apiClient } from '@/services/apiClient';
import { PERFORMANCE_BUDGETS, PerformanceMonitoringService } from '@/services/performanceMonitoring';

jest.mock('../../services/apiClient', () => ({
  apiClient: {
    postRaw: jest.fn(),
  },
}));

const mockPostRaw = apiClient.postRaw as jest.Mock;

// Mock web-vitals
jest.mock('web-vitals', () => ({
  onCLS: jest.fn((callback) => {
    // Simulate CLS metric
    callback({
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      delta: 0.05,
      id: 'cls-1',
      navigationType: 'navigate',
    });
  }),
  onLCP: jest.fn((callback) => {
    // Simulate LCP metric
    callback({
      name: 'LCP',
      value: 1800,
      rating: 'good',
      delta: 1800,
      id: 'lcp-1',
      navigationType: 'navigate',
    });
  }),
  onINP: jest.fn((callback) => {
    // Simulate INP metric
    callback({
      name: 'INP',
      value: 150,
      rating: 'good',
      delta: 150,
      id: 'inp-1',
      navigationType: 'navigate',
    });
  }),
  onTTFB: jest.fn((callback) => {
    // Simulate TTFB metric
    callback({
      name: 'TTFB',
      value: 500,
      rating: 'good',
      delta: 500,
      id: 'ttfb-1',
      navigationType: 'navigate',
    });
  }),
}));

describe('PerformanceMonitoringService', () => {
  let performanceMonitoringService: PerformanceMonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset singleton instance for testing
    (PerformanceMonitoringService as any).instance = undefined;
    performanceMonitoringService = PerformanceMonitoringService.getInstance();

    mockPostRaw.mockResolvedValue({ success: true });

    // Mock console methods
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    performanceMonitoringService.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PerformanceMonitoringService.getInstance();
      const instance2 = PerformanceMonitoringService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize service successfully', () => {
      performanceMonitoringService.initialize();
      expect(console.info).toHaveBeenCalledWith('[INFO] PerformanceMonitoringService initialized successfully');
    });

    it('should not initialize twice', () => {
      performanceMonitoringService.initialize();
      performanceMonitoringService.initialize();
      expect(console.warn).toHaveBeenCalledWith('[WARN] PerformanceMonitoringService already initialized');
    });

    it('should capture Web Vitals metrics', () => {
      performanceMonitoringService.initialize();
      const metrics = performanceMonitoringService.getQueuedMetrics();
      
      // Should have captured metrics from web-vitals mock
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('getMetricRating', () => {
    it('should return "good" for values below good threshold', () => {
      expect(performanceMonitoringService.getMetricRating('LCP', 2000)).toBe('good');
      expect(performanceMonitoringService.getMetricRating('INP', 100)).toBe('good');
      expect(performanceMonitoringService.getMetricRating('CLS', 0.05)).toBe('good');
      expect(performanceMonitoringService.getMetricRating('TTFB', 500)).toBe('good');
    });

    it('should return "needs-improvement" for values between good and poor', () => {
      expect(performanceMonitoringService.getMetricRating('LCP', 3000)).toBe('needs-improvement');
      expect(performanceMonitoringService.getMetricRating('INP', 300)).toBe('needs-improvement');
      expect(performanceMonitoringService.getMetricRating('CLS', 0.15)).toBe('needs-improvement');
      expect(performanceMonitoringService.getMetricRating('TTFB', 1200)).toBe('needs-improvement');
    });

    it('should return "poor" for values above poor threshold', () => {
      expect(performanceMonitoringService.getMetricRating('LCP', 5000)).toBe('poor');
      expect(performanceMonitoringService.getMetricRating('INP', 600)).toBe('poor');
      expect(performanceMonitoringService.getMetricRating('CLS', 0.3)).toBe('poor');
      expect(performanceMonitoringService.getMetricRating('TTFB', 2000)).toBe('poor');
    });
  });

  describe('flush', () => {
    it('should send queued metrics to backend', async () => {
      performanceMonitoringService.initialize();
      
      await performanceMonitoringService.flush();

      expect(mockPostRaw).toHaveBeenCalledWith(
        '/api/v2/metrics/web-vitals',
        expect.objectContaining({
          metrics: expect.any(Array),
        })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      mockPostRaw.mockRejectedValue(new Error('Network error'));
      
      performanceMonitoringService.initialize();
      
      // Should not throw
      await expect(performanceMonitoringService.flush()).resolves.not.toThrow();
      
      // Metrics should be kept in queue on error
      const metrics = performanceMonitoringService.getQueuedMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      performanceMonitoringService.initialize();
      performanceMonitoringService.destroy();
      
      // Verify timer is cleared
      expect((performanceMonitoringService as any).batchSendTimer).toBeUndefined();
      expect((performanceMonitoringService as any).isInitialized).toBe(false);
    });
  });

  describe('PERFORMANCE_BUDGETS', () => {
    it('should have budgets for all Core Web Vitals', () => {
      expect(PERFORMANCE_BUDGETS.LCP).toBeDefined();
      expect(PERFORMANCE_BUDGETS.INP).toBeDefined();
      expect(PERFORMANCE_BUDGETS.CLS).toBeDefined();
      expect(PERFORMANCE_BUDGETS.TTFB).toBeDefined();
    });

    it('should have good and poor thresholds for each metric', () => {
      Object.values(PERFORMANCE_BUDGETS).forEach((budget) => {
        expect(budget.good).toBeDefined();
        expect(budget.poor).toBeDefined();
        expect(budget.good).toBeLessThan(budget.poor);
      });
    });
  });
});
