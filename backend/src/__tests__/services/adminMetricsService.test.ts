// Mock data-source before imports
const mockCount = jest.fn();
const mockGetRawMany = jest.fn();
const mockGetCount = jest.fn();
const mockCreateQueryBuilder = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawMany: mockGetRawMany,
  getCount: mockGetCount,
});
const mockAppDataSource = {
  isInitialized: true,
  getRepository: jest.fn().mockReturnValue({
    count: mockCount,
    createQueryBuilder: mockCreateQueryBuilder,
  }),
};

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock monitoring services
jest.mock('../../services/caching/EnhancedCacheService', () => ({
  enhancedCacheService: {
    getMetrics: jest.fn().mockReturnValue({
      hits: 80,
      misses: 20,
      keys: 100,
      hitRate: 80,
      ksize: 1024,
      vsize: 4096,
    }),
  },
}));

jest.mock('../../services/monitoring/QueryAnalyzerService', () => ({
  queryAnalyzerService: {
    getQueryStats: jest.fn().mockReturnValue({
      totalQueries: 500,
      averageDuration: 35,
      maxDuration: 200,
      minDuration: 1,
      p50Duration: 25,
      p95Duration: 100,
      p99Duration: 180,
      slowQueryCount: 5,
      queriesByTable: {},
    }),
  },
}));

jest.mock('../../services/admin/AdminSecurityLogService', () => ({
  AdminSecurityLogService: {
    getLogSummary: jest.fn().mockReturnValue({
      period: '24h',
      totalEvents: 50,
      byType: {
        login_success: 30,
        login_failure: 10,
        permission_denied: 5,
        suspicious_activity: 5,
      },
      bySeverity: { info: 30, warning: 15, critical: 5 },
      topEvents: [],
      suspiciousActivity: { total: 5 },
      authenticationStats: { successfulLogins: 30, failedLogins: 10 },
      authorizationStats: { permissionDenials: 5 },
    }),
    getRecentEvents: jest.fn().mockReturnValue([]),
  },
}));

import {
  AdminMetricsService,
  SystemMetrics,
  UserActionMetrics,
} from '../../services/admin/AdminMetricsService';

describe('AdminMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppDataSource.isInitialized = true;
    mockCount.mockResolvedValue(0);
    mockGetRawMany.mockResolvedValue([]);
    mockGetCount.mockResolvedValue(0);
  });

  describe('getSystemMetrics', () => {
    it('should return comprehensive system metrics', async () => {
      // Setup different counts for different repository calls
      mockCount.mockResolvedValue(42);

      const metrics: SystemMetrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.users).toBeDefined();
      expect(metrics.organizations).toBeDefined();
      expect(metrics.activities).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.health).toBeDefined();
    });

    it('should include user metrics with correct structure', async () => {
      mockCount.mockResolvedValue(100);

      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.users).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          active24h: expect.any(Number),
          active7d: expect.any(Number),
          active30d: expect.any(Number),
          newUsers24h: expect.any(Number),
          newUsers7d: expect.any(Number),
          newUsers30d: expect.any(Number),
        })
      );
    });

    it('should include organization metrics with correct structure', async () => {
      mockCount.mockResolvedValue(10);

      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.organizations).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          inactive: expect.any(Number),
          avgMembersPerOrg: expect.any(Number),
        })
      );
    });

    it('should include activity metrics with correct structure', async () => {
      mockCount.mockResolvedValue(500);

      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.activities).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          created24h: expect.any(Number),
          created7d: expect.any(Number),
          created30d: expect.any(Number),
          byType: expect.any(Object),
          byStatus: expect.any(Object),
        })
      );
    });

    it('should include performance metrics', async () => {
      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.performance).toEqual(
        expect.objectContaining({
          cacheHitRate: expect.any(Number),
          avgResponseTime: expect.any(Number),
          totalQueries24h: expect.any(Number),
          errorRate: expect.any(Number),
        })
      );
    });

    it('should include health metrics with database and memory status', async () => {
      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.health.databaseStatus).toBe('connected');
      expect(metrics.health.cacheStatus).toBe('operational');
      expect(metrics.health.uptime).toBeGreaterThan(0);
      expect(metrics.health.memoryUsage).toEqual(
        expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        })
      );
    });

    it('should report database as disconnected when not initialized', async () => {
      mockAppDataSource.isInitialized = false;

      const metrics = await AdminMetricsService.getSystemMetrics();

      expect(metrics.health.databaseStatus).toBe('disconnected');
    });

    it('should handle repository errors gracefully and return zero values', async () => {
      mockCount.mockRejectedValue(new Error('Database connection failed'));

      const metrics = await AdminMetricsService.getSystemMetrics();

      // Should not throw — errors are caught internally
      expect(metrics).toBeDefined();
      expect(metrics.users.total).toBe(0);
      expect(metrics.organizations.total).toBe(0);
      expect(metrics.activities.total).toBe(0);
    });
  });

  describe('getUserActionMetrics', () => {
    it('should return user action metrics for default period (24h)', async () => {
      const metrics: UserActionMetrics = await AdminMetricsService.getUserActionMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.period).toBe('24h');
      expect(metrics.totalActions).toBeGreaterThanOrEqual(0);
      expect(metrics.actionsByType).toBeDefined();
      expect(metrics.topActions).toBeDefined();
      expect(Array.isArray(metrics.topActions)).toBe(true);
      expect(metrics.errors).toBeDefined();
    });

    it('should accept different period values', async () => {
      const periods: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];

      for (const period of periods) {
        const metrics = await AdminMetricsService.getUserActionMetrics(period);
        expect(metrics.period).toBe(period);
      }
    });

    it('should not include user identification in action metrics', async () => {
      const metrics = await AdminMetricsService.getUserActionMetrics();

      // Top actions should only have action name and count — no user info
      for (const action of metrics.topActions) {
        expect(action).toHaveProperty('action');
        expect(action).toHaveProperty('count');
        expect(action).not.toHaveProperty('userId');
        expect(action).not.toHaveProperty('username');
        expect(action).not.toHaveProperty('email');
      }
    });

    it('should include error breakdown by type', async () => {
      const metrics = await AdminMetricsService.getUserActionMetrics();

      expect(metrics.errors.total).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.errors.byType).toBe('object');
    });
  });

  describe('getTimeSeriesMetrics', () => {
    it('should return time series data for users metric', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('users', 7);

      expect(data).toHaveLength(7);
      data.forEach(point => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('value');
        expect(typeof point.date).toBe('string');
        expect(typeof point.value).toBe('number');
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return time series data for activities metric', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('activities', 7);

      expect(data).toHaveLength(7);
    });

    it('should return time series data for errors metric', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('errors', 7);

      expect(data).toHaveLength(7);
    });

    it('should return correct number of data points', async () => {
      const data3 = await AdminMetricsService.getTimeSeriesMetrics('users', 3);
      const data14 = await AdminMetricsService.getTimeSeriesMetrics('users', 14);

      expect(data3).toHaveLength(3);
      expect(data14).toHaveLength(14);
    });

    it('should return data points in chronological order', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('users', 7);

      for (let i = 1; i < data.length; i++) {
        expect(new Date(data[i].date).getTime()).toBeGreaterThan(
          new Date(data[i - 1].date).getTime()
        );
      }
    });

    it('should use default of 7 days when no period specified', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('users');

      expect(data).toHaveLength(7);
    });

    it('should format dates as ISO date strings (YYYY-MM-DD)', async () => {
      const data = await AdminMetricsService.getTimeSeriesMetrics('users', 3);

      data.forEach(point => {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
