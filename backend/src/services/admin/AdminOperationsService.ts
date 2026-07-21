/**
 * Admin Operations Service
 *
 * Aggregates operational health data from Discord bot commands,
 * scheduled jobs, and data fetchers for the admin operations dashboard.
 */

import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BotCommandOverview {
  totalCommands: number;
  totalSuccessful: number;
  totalFailed: number;
  successRate: number;
  averageExecutionTime: number;
  uniqueUsers: number;
  uniqueGuilds: number;
  topCommands: Array<{ command: string; count: number }>;
  recentErrors: Array<{ commandName: string; error: string; timestamp: Date }>;
  perCommand: Array<{
    commandName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastUsed: Date;
  }>;
}

export interface JobOverview {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  healthSummary: { healthy: number; degraded: number; unhealthy: number; unknown: number };
  jobs: Array<{
    jobId: string;
    name: string;
    category: string;
    enabled: boolean;
    isRunning: boolean;
    health: string;
    description?: string;
    schedule?: string;
    lastExecution?: {
      status: string;
      startedAt: Date;
      duration?: number;
      error?: string;
    };
    statistics: {
      totalExecutions: number;
      successfulExecutions: number;
      failedExecutions: number;
      successRate: number;
      averageDuration: number;
    };
  }>;
  recentExecutions: Array<{
    jobId: string;
    status: string;
    startedAt: Date;
    duration?: number;
    error?: string;
  }>;
}

export interface FetcherStatusEntry {
  name: string;
  isRunning: boolean;
  lastRun?: {
    success: boolean;
    timestamp: Date;
    error?: string;
    details?: Record<string, unknown>;
  };
  isStale: boolean;
}

export interface FetcherOverview {
  fetchers: FetcherStatusEntry[];
}

export interface OperationsOverview {
  botCommands: BotCommandOverview;
  jobs: JobOverview;
  fetchers: FetcherOverview;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Stale-data threshold (25 hours for daily fetchers)
// ---------------------------------------------------------------------------
const SHIP_FETCH_STALE_MS = 25 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AdminOperationsService {
  private static toExecutionStatus(execution: {
    outcome: 'executed' | 'skipped';
    success: boolean;
  }): 'skipped' | 'completed' | 'failed' {
    if (execution.outcome === 'skipped') {
      return 'skipped';
    }

    return execution.success ? 'completed' : 'failed';
  }

  /**
   * Get the full aggregated operations overview.
   */
  static async getOverview(): Promise<OperationsOverview> {
    const [botCommands, jobs, fetchers] = await Promise.all([
      AdminOperationsService.getBotCommandStats(),
      AdminOperationsService.getJobStatuses(),
      AdminOperationsService.getFetcherStatuses(),
    ]);

    return { botCommands, jobs, fetchers, timestamp: new Date() };
  }

  /**
   * Aggregate Discord bot command analytics from the in-memory CommandAnalytics singleton.
   */
  static async getBotCommandStats(): Promise<BotCommandOverview> {
    try {
      const { CommandAnalytics } = await import('../../bot/utils/commandAnalytics');
      const analytics = CommandAnalytics.getInstance();
      const systemStats = analytics.getSystemStats();
      const allCommandStats = analytics.getAllCommandStats();

      const usageData = analytics.exportData();
      const recentErrors = usageData
        .filter((u): u is typeof u & { error: string } => !u.success && !!u.error)
        .slice(-50)
        .reverse()
        .map(u => ({
          commandName: u.commandName,
          error: u.error,
          timestamp: u.timestamp,
        }));

      const successRate =
        systemStats.totalCommands > 0
          ? (systemStats.totalSuccessful / systemStats.totalCommands) * 100
          : 100;

      return {
        ...systemStats,
        successRate: Math.round(successRate * 100) / 100,
        recentErrors,
        perCommand: allCommandStats.map(s => ({
          commandName: s.commandName,
          totalExecutions: s.totalExecutions,
          successfulExecutions: s.successfulExecutions,
          failedExecutions: s.failedExecutions,
          averageExecutionTime: Math.round(s.averageExecutionTime),
          lastUsed: s.lastUsed,
        })),
      };
    } catch (error: unknown) {
      logger.warn('Bot command analytics unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalCommands: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        successRate: 100,
        averageExecutionTime: 0,
        uniqueUsers: 0,
        uniqueGuilds: 0,
        topCommands: [],
        recentErrors: [],
        perCommand: [],
      };
    }
  }

  /**
   * Aggregate scheduled job statuses from the AdminJobRegistry.
   */
  static async getJobStatuses(): Promise<JobOverview> {
    try {
      const { adminJobRegistry } = await import('./AdminJobRegistry');
      const jobs = adminJobRegistry.getAllJobs();

      const healthSummary = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
      for (const job of jobs) {
        if (!job.enabled) {
          healthSummary.unknown++;
        } else if (job.statistics.totalExecutions === 0) {
          healthSummary.unknown++;
        } else if (job.statistics.successRate >= 90) {
          healthSummary.healthy++;
        } else if (job.statistics.successRate >= 50) {
          healthSummary.degraded++;
        } else {
          healthSummary.unhealthy++;
        }
      }

      const recentExecutions = jobs
        .filter((j): j is typeof j & { lastExecution: NonNullable<typeof j.lastExecution> } =>
          Boolean(j.lastExecution)
        )
        .map(j => ({
          jobId: j.id,
          status: AdminOperationsService.toExecutionStatus(j.lastExecution),
          startedAt: j.lastExecution.startedAt,
          duration: j.lastExecution.duration,
          error: j.lastExecution.error,
        }))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20);

      return {
        totalJobs: jobs.length,
        enabledJobs: jobs.filter(j => j.enabled).length,
        runningJobs: jobs.filter(j => j.isRunning).length,
        healthSummary,
        jobs: jobs.map(j => {
          let health: string;
          if (!j.enabled) {
            health = 'disabled';
          } else if (j.statistics.totalExecutions === 0) {
            health = 'unknown';
          } else if (j.statistics.successRate >= 90) {
            health = 'healthy';
          } else if (j.statistics.successRate >= 50) {
            health = 'degraded';
          } else {
            health = 'unhealthy';
          }

          const lastExecution = j.lastExecution
            ? {
                status: AdminOperationsService.toExecutionStatus(j.lastExecution),
                startedAt: j.lastExecution.startedAt,
                duration: j.lastExecution.duration,
                error: j.lastExecution.error,
              }
            : undefined;

          return {
            jobId: j.id,
            name: j.name,
            category: j.category,
            enabled: j.enabled,
            isRunning: j.isRunning,
            health,
            description: j.description,
            schedule: j.schedule,
            lastExecution,
            statistics: j.statistics,
          };
        }),
        recentExecutions,
      };
    } catch (error: unknown) {
      logger.warn('Job registry unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalJobs: 0,
        enabledJobs: 0,
        runningJobs: 0,
        healthSummary: { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 },
        jobs: [],
        recentExecutions: [],
      };
    }
  }

  /**
   * Collect status from ShipDataFetcher and RegolithDataFetcher.
   */
  static async getFetcherStatuses(): Promise<FetcherOverview> {
    const fetchers: FetcherStatusEntry[] = [];

    // Ship Data Fetcher
    try {
      const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher');
      const status = ShipDataFetcher.getLastFetchStatus();
      fetchers.push({
        name: 'Ship Data Fetcher',
        isRunning: ShipDataFetcher.isCurrentlyFetching(),
        lastRun: status
          ? {
              success: status.success,
              timestamp: status.timestamp,
              error: status.error,
              details: {
                shipsProcessed: status.shipsProcessed,
                vehiclesProcessed: status.vehiclesProcessed,
              },
            }
          : undefined,
        isStale: !status || Date.now() - status.timestamp.getTime() > SHIP_FETCH_STALE_MS,
      });
    } catch (error: unknown) {
      logger.warn('Ship data fetcher status unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      fetchers.push({ name: 'Ship Data Fetcher', isRunning: false, isStale: true });
    }

    // Regolith Data Fetcher
    try {
      const { RegolithDataFetcher } = await import('../../jobs/regolithDataFetcher');
      const fetchStatuses = RegolithDataFetcher.getFetchStatuses();
      const cachedData = RegolithDataFetcher.getCachedData();
      const successCount = fetchStatuses.filter(s => s.success).length;
      const failedSources = fetchStatuses.filter(s => !s.success);

      fetchers.push({
        name: 'Regolith Data Fetcher',
        isRunning: RegolithDataFetcher.isCurrentlyFetching(),
        lastRun: cachedData
          ? {
              success: failedSources.length === 0,
              timestamp: cachedData.lastUpdated,
              error:
                failedSources.length > 0
                  ? `${failedSources.length} source(s) failed: ${failedSources.map(s => s.source).join(', ')}`
                  : undefined,
              details: {
                successfulSources: successCount,
                totalSources: fetchStatuses.length,
                oresCount: cachedData.ores.length,
                marketsCount: cachedData.markets.length,
              },
            }
          : undefined,
        isStale: RegolithDataFetcher.isDataStale(),
      });
    } catch (error: unknown) {
      logger.warn('Regolith data fetcher status unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      fetchers.push({ name: 'Regolith Data Fetcher', isRunning: false, isStale: true });
    }

    return { fetchers };
  }
}

