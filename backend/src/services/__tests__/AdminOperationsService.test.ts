/**
 * AdminOperationsService — Service-layer unit tests
 *
 * Verifies aggregation logic for Discord bot commands, scheduled jobs,
 * and data fetchers used by the admin operations dashboard.
 */

// ── Subsystem mocks ──────────────────────────────────────────────────────────

const mockGetSystemStats = jest.fn();
const mockGetAllCommandStats = jest.fn();
const mockExportData = jest.fn();

jest.mock('../../bot/utils/commandAnalytics', () => ({
  CommandAnalytics: {
    getInstance: () => ({
      getSystemStats: mockGetSystemStats,
      getAllCommandStats: mockGetAllCommandStats,
      exportData: mockExportData,
    }),
  },
}));

const mockGetDashboardOverview = jest.fn();
const mockGetAllJobStatuses = jest.fn();

const mockRegistryGetAllJobs = jest.fn();

jest.mock('../admin/AdminJobRegistry', () => ({
  adminJobRegistry: {
    getAllJobs: () => mockRegistryGetAllJobs(),
  },
}));

const mockGetLastFetchStatus = jest.fn();
const mockIsCurrentlyFetching = jest.fn();

jest.mock('../../jobs/shipDataFetcher', () => ({
  ShipDataFetcher: {
    getLastFetchStatus: () => mockGetLastFetchStatus(),
    isCurrentlyFetching: () => mockIsCurrentlyFetching(),
  },
}));

const mockGetFetchStatuses = jest.fn();
const mockGetCachedData = jest.fn();
const mockIsDataStale = jest.fn();
const mockRegolithIsCurrentlyFetching = jest.fn();

jest.mock('../../jobs/regolithDataFetcher', () => ({
  RegolithDataFetcher: {
    getFetchStatuses: () => mockGetFetchStatuses(),
    getCachedData: () => mockGetCachedData(),
    isDataStale: () => mockIsDataStale(),
    isCurrentlyFetching: () => mockRegolithIsCurrentlyFetching(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import { AdminOperationsService } from '../admin/AdminOperationsService';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FetcherStatus {
  name: string;
  isRunning: boolean;
  isStale: boolean;
  lastRun?: {
    success: boolean;
    timestamp: Date;
    error?: string;
    details?: Record<string, unknown>;
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AdminOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default bot command mocks
    mockGetSystemStats.mockReturnValue({
      totalCommands: 150,
      totalSuccessful: 140,
      totalFailed: 10,
      averageExecutionTime: 45,
      uniqueUsers: 25,
      uniqueGuilds: 5,
      topCommands: [{ command: '/fleet', count: 50 }],
      oldestRecord: new Date('2026-04-01'),
      newestRecord: new Date('2026-04-11'),
    });

    mockGetAllCommandStats.mockReturnValue([
      {
        commandName: 'fleet',
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        averageExecutionTime: 30,
        uniqueUsers: 10,
        uniqueGuilds: 3,
        lastUsed: new Date('2026-04-11'),
      },
    ]);

    mockExportData.mockReturnValue([
      {
        commandName: 'fleet',
        success: false,
        error: 'Permission denied',
        timestamp: new Date('2026-04-11T10:00:00Z'),
        userId: 'u1',
        userName: 'User1',
        guildId: 'g1',
        guildName: 'Guild1',
        executionTime: 50,
      },
    ]);

    // Default job registry mocks
    mockRegistryGetAllJobs.mockReturnValue([
      {
        id: 'gdpr-cleanup',
        name: 'GDPR Cleanup',
        description: 'Cleans up old GDPR data',
        category: 'cleanup',
        schedule: 'Daily at 03:00 UTC',
        enabled: true,
        isRunning: false,
        lastExecution: {
          startedAt: new Date('2026-04-11T03:00:00Z'),
          completedAt: new Date('2026-04-11T03:01:12Z'),
          duration: 1200,
          success: true,
          manual: false,
        },
        statistics: {
          totalExecutions: 30,
          successfulExecutions: 29,
          failedExecutions: 1,
          successRate: 96.67,
          averageDuration: 1100,
        },
      },
    ]);

    // Default fetcher mocks
    mockGetLastFetchStatus.mockReturnValue({
      success: true,
      timestamp: new Date('2026-04-11T02:00:00Z'),
      shipsProcessed: 200,
      vehiclesProcessed: 50,
    });
    mockIsCurrentlyFetching.mockReturnValue(false);

    mockGetFetchStatuses.mockReturnValue([
      { source: 'ores', success: true, lastFetch: new Date(), recordCount: 10, url: '' },
      { source: 'market', success: true, lastFetch: new Date(), recordCount: 5, url: '' },
    ]);
    mockGetCachedData.mockReturnValue({
      lastUpdated: new Date('2026-04-11T06:00:00Z'),
      ores: [{ id: '1' }],
      rockClasses: [],
      classLocations: [],
      gems: [],
      refineries: [],
      markets: [{ id: '1' }, { id: '2' }],
    });
    mockIsDataStale.mockReturnValue(false);
    mockRegolithIsCurrentlyFetching.mockReturnValue(false);
  });

  // ── getOverview ────────────────────────────────────────────────────────

  describe('getOverview', () => {
    it('should return aggregated data from all subsystems', async () => {
      const result = await AdminOperationsService.getOverview();

      expect(result.botCommands.totalCommands).toBe(150);
      expect(result.jobs.totalJobs).toBe(1);
      expect(result.fetchers.fetchers).toHaveLength(2);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  // ── getBotCommandStats ────────────────────────────────────────────────

  describe('getBotCommandStats', () => {
    it('should calculate correct success rate', async () => {
      const stats = await AdminOperationsService.getBotCommandStats();
      expect(stats.successRate).toBeCloseTo(93.33, 1);
    });

    it('should include recent errors from usage history', async () => {
      const stats = await AdminOperationsService.getBotCommandStats();
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0]).toEqual(
        expect.objectContaining({ commandName: 'fleet', error: 'Permission denied' })
      );
    });

    it('should map per-command breakdown', async () => {
      const stats = await AdminOperationsService.getBotCommandStats();
      expect(stats.perCommand).toHaveLength(1);
      expect(stats.perCommand[0].commandName).toBe('fleet');
      expect(stats.perCommand[0].averageExecutionTime).toBe(30);
    });

    it('should return zeros when bot analytics is unavailable', async () => {
      mockGetSystemStats.mockImplementation(() => {
        throw new Error('Bot not initialized');
      });

      const stats = await AdminOperationsService.getBotCommandStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.recentErrors).toEqual([]);
      expect(stats.perCommand).toEqual([]);
    });

    it('should default to 100% success rate when no commands exist', async () => {
      mockGetSystemStats.mockReturnValue({
        totalCommands: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        averageExecutionTime: 0,
        uniqueUsers: 0,
        uniqueGuilds: 0,
        topCommands: [],
        oldestRecord: null,
        newestRecord: null,
      });
      mockGetAllCommandStats.mockReturnValue([]);
      mockExportData.mockReturnValue([]);

      const stats = await AdminOperationsService.getBotCommandStats();
      expect(stats.successRate).toBe(100);
    });
  });

  // ── getJobStatuses ────────────────────────────────────────────────────

  describe('getJobStatuses', () => {
    it('should include job health and statistics from registry', async () => {
      const result = await AdminOperationsService.getJobStatuses();
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]).toEqual(
        expect.objectContaining({
          jobId: 'gdpr-cleanup',
          name: 'GDPR Cleanup',
          health: 'healthy',
          statistics: expect.objectContaining({ successRate: 96.67 }),
        })
      );
    });

    it('should compute health summary from registry jobs', async () => {
      const result = await AdminOperationsService.getJobStatuses();
      // 1 job with 96.67% success rate → healthy
      expect(result.healthSummary.healthy).toBe(1);
      expect(result.totalJobs).toBe(1);
      expect(result.enabledJobs).toBe(1);
    });

    it('should return empty when registry is unavailable', async () => {
      mockRegistryGetAllJobs.mockImplementation(() => {
        throw new Error('Registry not running');
      });

      const result = await AdminOperationsService.getJobStatuses();
      expect(result.totalJobs).toBe(0);
      expect(result.jobs).toEqual([]);
    });
  });

  // ── getFetcherStatuses ────────────────────────────────────────────────

  describe('getFetcherStatuses', () => {
    it('should report ship data fetcher status', async () => {
      const result = await AdminOperationsService.getFetcherStatuses();
      const ship = result.fetchers.find((f: FetcherStatus) => f.name === 'Ship Data Fetcher');
      expect(ship).toBeDefined();
      expect(ship!.isRunning).toBe(false);
      expect(ship!.lastRun?.success).toBe(true);
      expect(ship!.lastRun?.details).toEqual(
        expect.objectContaining({ shipsProcessed: 200, vehiclesProcessed: 50 })
      );
    });

    it('should report regolith fetcher with failure details', async () => {
      mockGetFetchStatuses.mockReturnValue([
        { source: 'ores', success: true, lastFetch: new Date(), recordCount: 10, url: '' },
        { source: 'market', success: false, lastFetch: new Date(), recordCount: 0, url: '' },
      ]);

      const result = await AdminOperationsService.getFetcherStatuses();
      const regolith = result.fetchers.find(
        (f: FetcherStatus) => f.name === 'Regolith Data Fetcher'
      );
      expect(regolith!.lastRun?.success).toBe(false);
      expect(regolith!.lastRun?.error).toContain('market');
    });

    it('should mark ship fetcher as stale when no status exists', async () => {
      mockGetLastFetchStatus.mockReturnValue(null);

      const result = await AdminOperationsService.getFetcherStatuses();
      const ship = result.fetchers.find((f: FetcherStatus) => f.name === 'Ship Data Fetcher');
      expect(ship!.isStale).toBe(true);
      expect(ship!.lastRun).toBeUndefined();
    });

    it('should delegate staleness check to RegolithDataFetcher.isDataStale', async () => {
      mockIsDataStale.mockReturnValue(true);

      const result = await AdminOperationsService.getFetcherStatuses();
      const regolith = result.fetchers.find(
        (f: FetcherStatus) => f.name === 'Regolith Data Fetcher'
      );
      expect(regolith!.isStale).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

