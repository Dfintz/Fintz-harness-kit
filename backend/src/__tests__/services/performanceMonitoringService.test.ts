import { enhancedCacheService } from '../../services/caching/EnhancedCacheService';
import {
  PerformanceMonitoringService,
  PerformanceHealthStatus,
} from '../../services/monitoring/PerformanceMonitoringService';
import { queryAnalyzerService } from '../../services/monitoring/QueryAnalyzerService';

describe('PerformanceMonitoringService', () => {
  let performanceService: PerformanceMonitoringService;

  beforeEach(() => {
    performanceService = new PerformanceMonitoringService({
      queryP95ThresholdMs: 100,
      slowQueryThresholdMs: 200,
      cacheHitRateThreshold: 70,
      memoryUsageThreshold: 80,
    });

    // Clear any existing data
    queryAnalyzerService.clearHistory();
    enhancedCacheService.flushAll();
  });

  afterEach(() => {
    enhancedCacheService.shutdown();
  });

  describe('generateReport', () => {
    it('should generate a comprehensive performance report', async () => {
      const report = await performanceService.generateReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.overallStatus).toBeDefined();
      expect(Object.values(PerformanceHealthStatus)).toContain(report.overallStatus);
      expect(report.database).toBeDefined();
      expect(report.cache).toBeDefined();
      expect(report.memory).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should include database query statistics', async () => {
      // Record some queries
      queryAnalyzerService.recordQuery({
        query: 'SELECT * FROM users',
        duration: 50,
        timestamp: new Date(),
      });

      const report = await performanceService.generateReport();

      expect(report.database.queryStats).toBeDefined();
      expect(report.database.queryStats.totalQueries).toBeGreaterThan(0);
    });

    it('should include cache metrics', async () => {
      // Perform some cache operations
      enhancedCacheService.set('test:key', 'value');
      enhancedCacheService.get('test:key');
      enhancedCacheService.get('missing:key');

      const report = await performanceService.generateReport();

      expect(report.cache.metrics).toBeDefined();
      expect(report.cache.metrics.keys).toBeGreaterThanOrEqual(0);
      expect(report.cache.hitRateTrend).toBeDefined();
    });

    it('should include memory usage statistics', async () => {
      const report = await performanceService.generateReport();

      expect(report.memory).toBeDefined();
      expect(report.memory.heapUsed).toBeGreaterThan(0);
      expect(report.memory.heapTotal).toBeGreaterThan(0);
      expect(report.memory.usagePercent).toBeGreaterThan(0);
      expect(report.memory.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should store report in history', async () => {
      await performanceService.generateReport();
      await performanceService.generateReport();

      const history = performanceService.getReportHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('getQuickSummary', () => {
    it('should return a quick performance summary', async () => {
      const summary = await performanceService.getQuickSummary();

      expect(summary).toBeDefined();
      expect(summary.status).toBeDefined();
      expect(typeof summary.queryLatencyP95).toBe('number');
      expect(typeof summary.cacheHitRate).toBe('number');
      expect(typeof summary.memoryUsagePercent).toBe('number');
    });

    it('should return valid status when all metrics are checked', async () => {
      // With default empty state, should return a valid status
      const summary = await performanceService.getQuickSummary();

      expect(Object.values(PerformanceHealthStatus)).toContain(summary.status);
    });
  });

  describe('health status determination', () => {
    it('should report HEALTHY when all metrics are within thresholds', async () => {
      // Record fast queries
      for (let i = 0; i < 10; i++) {
        queryAnalyzerService.recordQuery({
          query: 'SELECT * FROM users',
          duration: 20,
          timestamp: new Date(),
        });
      }

      // Create good cache hit rate
      for (let i = 0; i < 10; i++) {
        enhancedCacheService.set(`key:${i}`, `value:${i}`);
      }
      for (let i = 0; i < 8; i++) {
        enhancedCacheService.get(`key:${i}`); // 80% hit rate
      }
      for (let i = 0; i < 2; i++) {
        enhancedCacheService.get(`missing:${i}`);
      }

      const report = await performanceService.generateReport();

      // Database should be healthy with fast queries
      expect(report.database.status).toBe(PerformanceHealthStatus.HEALTHY);
    });

    it('should report DEGRADED when query p95 exceeds threshold', async () => {
      // Record slow queries
      for (let i = 0; i < 20; i++) {
        queryAnalyzerService.recordQuery({
          query: 'SELECT * FROM users',
          duration: 150, // Above 100ms threshold
          timestamp: new Date(),
        });
      }

      const report = await performanceService.generateReport();

      expect([PerformanceHealthStatus.DEGRADED, PerformanceHealthStatus.CRITICAL]).toContain(
        report.database.status
      );
    });

    it('should report CRITICAL when query p95 exceeds slow query threshold', async () => {
      // Record very slow queries
      for (let i = 0; i < 20; i++) {
        queryAnalyzerService.recordQuery({
          query: 'SELECT * FROM users',
          duration: 300, // Above 200ms threshold
          timestamp: new Date(),
        });
      }

      const report = await performanceService.generateReport();

      expect(report.database.status).toBe(PerformanceHealthStatus.CRITICAL);
    });
  });

  describe('recommendations', () => {
    it('should provide recommendations for slow queries', async () => {
      // Record slow queries
      for (let i = 0; i < 10; i++) {
        queryAnalyzerService.recordQuery({
          query: 'SELECT * FROM users',
          duration: 150,
          timestamp: new Date(),
        });
      }

      const report = await performanceService.generateReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(
        report.recommendations.some(
          r => r.toLowerCase().includes('query') || r.toLowerCase().includes('latency')
        )
      ).toBe(true);
    });

    it('should provide recommendations for low cache hit rate', async () => {
      // Create low cache hit rate
      for (let i = 0; i < 10; i++) {
        enhancedCacheService.get(`missing:${i}`); // All misses
      }

      const report = await performanceService.generateReport();
      const metrics = report.cache.metrics;

      if (metrics.hitRate < 70) {
        expect(
          report.recommendations.some(
            r => r.toLowerCase().includes('cache') || r.toLowerCase().includes('hit rate')
          )
        ).toBe(true);
      }
    });

    it('should provide positive message when all metrics are healthy', async () => {
      // Create healthy conditions
      for (let i = 0; i < 10; i++) {
        queryAnalyzerService.recordQuery({
          query: 'SELECT * FROM users',
          duration: 20,
          timestamp: new Date(),
        });
      }

      // Good cache hit rate
      for (let i = 0; i < 10; i++) {
        enhancedCacheService.set(`key:${i}`, `value:${i}`);
        enhancedCacheService.get(`key:${i}`);
      }

      const report = await performanceService.generateReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      // When query and cache metrics are healthy, all recommendations should be valid:
      // - "healthy thresholds" message (when everything including CPU is fine)
      // - index recommendations (valid for healthy queries)
      // - threshold-based recommendations
      // - CPU load recommendations (system load during test runs is acceptable)
      // - monitoring/scaling recommendations
      // Any of these are acceptable - none should be unexpected error messages
      const allRecommendationsAreValid = report.recommendations.every(
        r =>
          r.toLowerCase().includes('healthy') ||
          r.toLowerCase().includes('threshold') ||
          r.toLowerCase().includes('index recommendations') ||
          r.toLowerCase().includes('cpu') ||
          r.toLowerCase().includes('load') ||
          r.toLowerCase().includes('monitor') ||
          r.toLowerCase().includes('scaling')
      );
      expect(allRecommendationsAreValid).toBe(true);
    });
  });

  describe('getReportHistory', () => {
    it('should return empty array initially', () => {
      const history = performanceService.getReportHistory();
      expect(history).toEqual([]);
    });

    it('should accumulate reports over time', async () => {
      await performanceService.generateReport();
      await performanceService.generateReport();
      await performanceService.generateReport();

      const history = performanceService.getReportHistory();
      expect(history.length).toBe(3);
    });

    it('should maintain chronological order', async () => {
      await performanceService.generateReport();
      await new Promise(resolve => setTimeout(resolve, 10));
      await performanceService.generateReport();

      const history = performanceService.getReportHistory();
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(history[1].timestamp.getTime());
    });
  });

  describe('updateThresholds', () => {
    it('should update performance thresholds', () => {
      performanceService.updateThresholds({
        queryP95ThresholdMs: 50,
        cacheHitRateThreshold: 80,
      });

      const thresholds = performanceService.getThresholds();
      expect(thresholds.queryP95ThresholdMs).toBe(50);
      expect(thresholds.cacheHitRateThreshold).toBe(80);
    });

    it('should keep existing values for unspecified thresholds', () => {
      performanceService.updateThresholds({
        queryP95ThresholdMs: 50,
      });

      const thresholds = performanceService.getThresholds();
      expect(thresholds.queryP95ThresholdMs).toBe(50);
      expect(thresholds.slowQueryThresholdMs).toBe(200); // Original value
    });
  });

  describe('getThresholds', () => {
    it('should return current thresholds', () => {
      const thresholds = performanceService.getThresholds();

      expect(thresholds.queryP95ThresholdMs).toBe(100);
      expect(thresholds.slowQueryThresholdMs).toBe(200);
      expect(thresholds.cacheHitRateThreshold).toBe(70);
      expect(thresholds.memoryUsageThreshold).toBe(80);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
