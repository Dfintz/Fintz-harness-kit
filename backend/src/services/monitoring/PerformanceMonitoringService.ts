import os from 'os';

import { AppDataSource } from '../../data-source';
import { logger } from '../../utils/logger';
import { enhancedCacheService, CacheMetrics } from '../caching/EnhancedCacheService';

import { queryAnalyzerService, QueryStats, SlowQueryAnalysis, IndexRecommendation } from './QueryAnalyzerService';

/**
 * Performance health status
 */
export enum PerformanceHealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    CRITICAL = 'critical'
}

/**
 * System performance report
 */
export interface PerformanceReport {
    timestamp: Date;
    overallStatus: PerformanceHealthStatus;
    database: {
        status: PerformanceHealthStatus;
        queryStats: QueryStats;
        slowQueries: SlowQueryAnalysis[];
        indexRecommendations: IndexRecommendation[];
        connectionPoolStatus?: {
            active: number;
            idle: number;
            total: number;
        };
    };
    cache: {
        status: PerformanceHealthStatus;
        metrics: CacheMetrics;
        hitRateTrend: 'improving' | 'stable' | 'declining';
    };
    memory: {
        status: PerformanceHealthStatus;
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
        usagePercent: number;
    };
    cpu: {
        status: PerformanceHealthStatus;
        loadAvg1m: number;
        loadAvg5m: number;
        loadAvg15m: number;
        coreCount: number;
        /** Process CPU usage in microseconds (user + system) since last measurement */
        processUser: number;
        processSystem: number;
    };
    recommendations: string[];
}

/**
 * Performance thresholds configuration
 */
export interface PerformanceThresholds {
    queryP95ThresholdMs: number;
    slowQueryThresholdMs: number;
    cacheHitRateThreshold: number;
    memoryUsageThreshold: number;
}

/**
 * Performance Monitoring Service
 * 
 * Provides comprehensive system performance monitoring including:
 * - Database query performance analysis
 * - Cache effectiveness tracking
 * - Memory usage monitoring
 * - Performance recommendations
 * - Health status aggregation
 */
export class PerformanceMonitoringService {
    private thresholds: PerformanceThresholds;
    private reportHistory: PerformanceReport[] = [];
    private readonly maxReportHistory = 60; // Keep 1 hour of minute-by-minute reports
    private monitoringInterval?: NodeJS.Timeout;

    constructor(thresholds?: Partial<PerformanceThresholds>) {
        this.thresholds = {
            queryP95ThresholdMs: thresholds?.queryP95ThresholdMs ?? 100,
            slowQueryThresholdMs: thresholds?.slowQueryThresholdMs ?? 200,
            cacheHitRateThreshold: thresholds?.cacheHitRateThreshold ?? 70,
            memoryUsageThreshold: thresholds?.memoryUsageThreshold ?? 80
        };

        logger.info('PerformanceMonitoringService initialized', { thresholds: this.thresholds });
    }

    /**
     * Generate comprehensive performance report
     */
    public async generateReport(): Promise<PerformanceReport> {
        const databaseReport = await this.getDatabasePerformance();
        const cacheReport = this.getCachePerformance();
        const memoryReport = this.getMemoryPerformance();
        const cpuReport = this.getCpuPerformance();

        const overallStatus = this.determineOverallStatus([
            databaseReport.status,
            cacheReport.status,
            memoryReport.status,
            cpuReport.status
        ]);

        const recommendations = this.generateRecommendations(
            databaseReport,
            cacheReport,
            memoryReport,
            cpuReport
        );

        const report: PerformanceReport = {
            timestamp: new Date(),
            overallStatus,
            database: databaseReport,
            cache: cacheReport,
            memory: memoryReport,
            cpu: cpuReport,
            recommendations
        };

        // Store in history
        this.addToHistory(report);

        return report;
    }

    /**
     * Get performance report history
     */
    public getReportHistory(): PerformanceReport[] {
        return [...this.reportHistory];
    }

    /**
     * Get current performance summary (lightweight check)
     */
    public async getQuickSummary(): Promise<{
        status: PerformanceHealthStatus;
        queryLatencyP95: number;
        cacheHitRate: number;
        memoryUsagePercent: number;
        cpuLoadNormalized: number;
    }> {
        const queryStats = queryAnalyzerService.getQueryStats();
        const cacheMetrics = enhancedCacheService.getMetrics();
        const memory = process.memoryUsage();
        const memoryUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);

        const statuses: PerformanceHealthStatus[] = [];
        
        if (queryStats.p95Duration > this.thresholds.queryP95ThresholdMs) {
            statuses.push(queryStats.p95Duration > this.thresholds.slowQueryThresholdMs 
                ? PerformanceHealthStatus.CRITICAL 
                : PerformanceHealthStatus.DEGRADED);
        } else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }

        if (cacheMetrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            statuses.push(cacheMetrics.hitRate < 50 
                ? PerformanceHealthStatus.CRITICAL 
                : PerformanceHealthStatus.DEGRADED);
        } else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }

        if (memoryUsagePercent > this.thresholds.memoryUsageThreshold) {
            statuses.push(memoryUsagePercent > 90 
                ? PerformanceHealthStatus.CRITICAL 
                : PerformanceHealthStatus.DEGRADED);
        } else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }

        const loadAvg = os.loadavg();
        const coreCount = os.cpus().length;
        const normalizedLoad = loadAvg[0] / coreCount;

        if (normalizedLoad > 0.9) {
            statuses.push(PerformanceHealthStatus.CRITICAL);
        } else if (normalizedLoad > 0.7) {
            statuses.push(PerformanceHealthStatus.DEGRADED);
        } else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }

        return {
            status: this.determineOverallStatus(statuses),
            queryLatencyP95: queryStats.p95Duration,
            cacheHitRate: cacheMetrics.hitRate,
            memoryUsagePercent,
            cpuLoadNormalized: Math.round(normalizedLoad * 100) / 100
        };
    }

    /**
     * Start periodic performance monitoring
     */
    public startMonitoring(intervalMs: number = 60000): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.generateReport();
            } catch (error: unknown) {
                logger.error('Performance monitoring error', { error });
            }
        }, intervalMs);

        logger.info('Performance monitoring started', { intervalMs });
    }

    public stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }

    /**
     * Update performance thresholds
     */
    public updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
        logger.info('Performance thresholds updated', { thresholds: this.thresholds });
    }

    /**
     * Get current thresholds
     */
    public getThresholds(): PerformanceThresholds {
        return { ...this.thresholds };
    }

    // Private methods

    private async getDatabasePerformance(): Promise<PerformanceReport['database']> {
        const queryStats = queryAnalyzerService.getQueryStats();
        const slowQueries = queryAnalyzerService.analyzeSlowQueries();
        const indexRecommendations = queryAnalyzerService.getIndexRecommendations();

        let connectionPoolStatus: PerformanceReport['database']['connectionPoolStatus'];
        
        if (AppDataSource.isInitialized) {
            try {
                // Get connection pool info if available
                const poolInfo = (AppDataSource.driver as unknown as { 
                    pool?: { 
                        totalCount: number; 
                        idleCount: number; 
                        waitingCount: number; 
                    } 
                })?.pool;
                if (poolInfo) {
                    connectionPoolStatus = {
                        active: poolInfo.totalCount - poolInfo.idleCount,
                        idle: poolInfo.idleCount,
                        total: poolInfo.totalCount
                    };
                }
            } catch {
                // Pool info not available
            }
        }

        let status = PerformanceHealthStatus.HEALTHY;
        
        if (queryStats.p95Duration > this.thresholds.slowQueryThresholdMs || slowQueries.length > 10) {
            status = PerformanceHealthStatus.CRITICAL;
        } else if (queryStats.p95Duration > this.thresholds.queryP95ThresholdMs || slowQueries.length > 5) {
            status = PerformanceHealthStatus.DEGRADED;
        }

        return {
            status,
            queryStats,
            slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
            indexRecommendations: indexRecommendations.slice(0, 5), // Top 5 recommendations
            connectionPoolStatus
        };
    }

    private getCachePerformance(): PerformanceReport['cache'] {
        const metrics = enhancedCacheService.getMetrics();
        const history = enhancedCacheService.getMetricsHistory();

        // Determine hit rate trend
        let hitRateTrend: 'improving' | 'stable' | 'declining' = 'stable';
        if (history.length >= 3) {
            const recent = history.slice(-3);
            const oldAvg = recent.slice(0, 2).reduce((sum, s) => sum + s.hitRate, 0) / 2;
            const newRate = recent[recent.length - 1].hitRate;
            
            if (newRate > oldAvg + 5) {
                hitRateTrend = 'improving';
            } else if (newRate < oldAvg - 5) {
                hitRateTrend = 'declining';
            }
        }

        let status = PerformanceHealthStatus.HEALTHY;
        if (metrics.hitRate < 50) {
            status = PerformanceHealthStatus.CRITICAL;
        } else if (metrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            status = PerformanceHealthStatus.DEGRADED;
        }

        return {
            status,
            metrics,
            hitRateTrend
        };
    }

    private getCpuPerformance(): PerformanceReport['cpu'] {
        const loadAvg = os.loadavg();
        const coreCount = os.cpus().length;
        const cpuUsage = process.cpuUsage();
        const normalizedLoad = loadAvg[0] / coreCount;

        let status = PerformanceHealthStatus.HEALTHY;
        if (normalizedLoad > 0.9) {
            status = PerformanceHealthStatus.CRITICAL;
        } else if (normalizedLoad > 0.7) {
            status = PerformanceHealthStatus.DEGRADED;
        }

        return {
            status,
            loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
            loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
            loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
            coreCount,
            processUser: cpuUsage.user,
            processSystem: cpuUsage.system
        };
    }

    private getMemoryPerformance(): PerformanceReport['memory'] {
        const memory = process.memoryUsage();
        const usagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);

        let status = PerformanceHealthStatus.HEALTHY;
        if (usagePercent > 90) {
            status = PerformanceHealthStatus.CRITICAL;
        } else if (usagePercent > this.thresholds.memoryUsageThreshold) {
            status = PerformanceHealthStatus.DEGRADED;
        }

        return {
            status,
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
            external: Math.round(memory.external / 1024 / 1024), // MB
            rss: Math.round(memory.rss / 1024 / 1024), // MB
            usagePercent
        };
    }

    private determineOverallStatus(statuses: PerformanceHealthStatus[]): PerformanceHealthStatus {
        if (statuses.includes(PerformanceHealthStatus.CRITICAL)) {
            return PerformanceHealthStatus.CRITICAL;
        }
        if (statuses.includes(PerformanceHealthStatus.DEGRADED)) {
            return PerformanceHealthStatus.DEGRADED;
        }
        return PerformanceHealthStatus.HEALTHY;
    }

    private generateRecommendations(
        database: PerformanceReport['database'],
        cache: PerformanceReport['cache'],
        memory: PerformanceReport['memory'],
        cpu?: PerformanceReport['cpu']
    ): string[] {
        const recommendations: string[] = [];

        // Database recommendations
        if (database.queryStats.p95Duration > this.thresholds.queryP95ThresholdMs) {
            recommendations.push(
                `Query p95 latency (${database.queryStats.p95Duration}ms) exceeds threshold. ` +
                'Review slow queries and add appropriate indices.'
            );
        }

        if (database.indexRecommendations.length > 0) {
            recommendations.push(
                `${database.indexRecommendations.length} index recommendations available. ` +
                'Consider implementing high-priority indices.'
            );
        }

        if (database.slowQueries.length > 5) {
            recommendations.push(
                `${database.slowQueries.length} slow queries detected. ` +
                'Review and optimize the most frequent offenders.'
            );
        }

        // Cache recommendations
        if (cache.metrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            recommendations.push(
                `Cache hit rate (${cache.metrics.hitRate}%) is below threshold. ` +
                'Consider implementing cache warming or increasing TTL.'
            );
        }

        if (cache.hitRateTrend === 'declining') {
            recommendations.push(
                'Cache hit rate is declining. Review invalidation patterns and key design.'
            );
        }

        // Memory recommendations
        if (memory.usagePercent > this.thresholds.memoryUsageThreshold) {
            recommendations.push(
                `Memory usage (${memory.usagePercent}%) is above threshold. ` +
                'Consider reviewing memory allocations or increasing resources.'
            );
        }

        // CPU recommendations
        if (cpu) {
            const normalizedLoad = cpu.loadAvg1m / cpu.coreCount;
            if (normalizedLoad > 0.9) {
                recommendations.push(
                    `CPU load average (${cpu.loadAvg1m}) exceeds core count (${cpu.coreCount}). ` +
                    'Consider scaling horizontally or optimizing CPU-intensive operations.'
                );
            } else if (normalizedLoad > 0.7) {
                recommendations.push(
                    `CPU load average (${cpu.loadAvg1m}) is elevated relative to ${cpu.coreCount} cores. ` +
                    'Monitor for further increases.'
                );
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('All performance metrics are within healthy thresholds.');
        }

        return recommendations;
    }

    private addToHistory(report: PerformanceReport): void {
        if (this.reportHistory.length >= this.maxReportHistory) {
            this.reportHistory.shift();
        }
        this.reportHistory.push(report);
    }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

