"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOperationsService = void 0;
const logger_1 = require("../../utils/logger");
const SHIP_FETCH_STALE_MS = 25 * 60 * 60 * 1000;
class AdminOperationsService {
    static toExecutionStatus(execution) {
        if (execution.outcome === 'skipped') {
            return 'skipped';
        }
        return execution.success ? 'completed' : 'failed';
    }
    static async getOverview() {
        const [botCommands, jobs, fetchers] = await Promise.all([
            AdminOperationsService.getBotCommandStats(),
            AdminOperationsService.getJobStatuses(),
            AdminOperationsService.getFetcherStatuses(),
        ]);
        return { botCommands, jobs, fetchers, timestamp: new Date() };
    }
    static async getBotCommandStats() {
        try {
            const { CommandAnalytics } = await Promise.resolve().then(() => __importStar(require('../../bot/utils/commandAnalytics')));
            const analytics = CommandAnalytics.getInstance();
            const systemStats = analytics.getSystemStats();
            const allCommandStats = analytics.getAllCommandStats();
            const usageData = analytics.exportData();
            const recentErrors = usageData
                .filter((u) => !u.success && !!u.error)
                .slice(-50)
                .reverse()
                .map(u => ({
                commandName: u.commandName,
                error: u.error,
                timestamp: u.timestamp,
            }));
            const successRate = systemStats.totalCommands > 0
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
        }
        catch (error) {
            logger_1.logger.warn('Bot command analytics unavailable', {
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
    static async getJobStatuses() {
        try {
            const { adminJobRegistry } = await Promise.resolve().then(() => __importStar(require('./AdminJobRegistry')));
            const jobs = adminJobRegistry.getAllJobs();
            const healthSummary = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
            for (const job of jobs) {
                if (!job.enabled) {
                    healthSummary.unknown++;
                }
                else if (job.statistics.totalExecutions === 0) {
                    healthSummary.unknown++;
                }
                else if (job.statistics.successRate >= 90) {
                    healthSummary.healthy++;
                }
                else if (job.statistics.successRate >= 50) {
                    healthSummary.degraded++;
                }
                else {
                    healthSummary.unhealthy++;
                }
            }
            const recentExecutions = jobs
                .filter((j) => Boolean(j.lastExecution))
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
                    let health;
                    if (!j.enabled) {
                        health = 'disabled';
                    }
                    else if (j.statistics.totalExecutions === 0) {
                        health = 'unknown';
                    }
                    else if (j.statistics.successRate >= 90) {
                        health = 'healthy';
                    }
                    else if (j.statistics.successRate >= 50) {
                        health = 'degraded';
                    }
                    else {
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
        }
        catch (error) {
            logger_1.logger.warn('Job registry unavailable', {
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
    static async getFetcherStatuses() {
        const fetchers = [];
        try {
            const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
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
        }
        catch (error) {
            logger_1.logger.warn('Ship data fetcher status unavailable', {
                error: error instanceof Error ? error.message : String(error),
            });
            fetchers.push({ name: 'Ship Data Fetcher', isRunning: false, isStale: true });
        }
        try {
            const { RegolithDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/regolithDataFetcher')));
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
                        error: failedSources.length > 0
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
        }
        catch (error) {
            logger_1.logger.warn('Regolith data fetcher status unavailable', {
                error: error instanceof Error ? error.message : String(error),
            });
            fetchers.push({ name: 'Regolith Data Fetcher', isRunning: false, isStale: true });
        }
        return { fetchers };
    }
}
exports.AdminOperationsService = AdminOperationsService;
//# sourceMappingURL=AdminOperationsService.js.map