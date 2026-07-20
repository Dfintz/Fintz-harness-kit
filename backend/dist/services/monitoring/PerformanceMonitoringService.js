"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitoringService = exports.PerformanceMonitoringService = exports.PerformanceHealthStatus = void 0;
const os_1 = __importDefault(require("os"));
const data_source_1 = require("../../data-source");
const logger_1 = require("../../utils/logger");
const EnhancedCacheService_1 = require("../caching/EnhancedCacheService");
const QueryAnalyzerService_1 = require("./QueryAnalyzerService");
var PerformanceHealthStatus;
(function (PerformanceHealthStatus) {
    PerformanceHealthStatus["HEALTHY"] = "healthy";
    PerformanceHealthStatus["DEGRADED"] = "degraded";
    PerformanceHealthStatus["CRITICAL"] = "critical";
})(PerformanceHealthStatus || (exports.PerformanceHealthStatus = PerformanceHealthStatus = {}));
class PerformanceMonitoringService {
    thresholds;
    reportHistory = [];
    maxReportHistory = 60;
    monitoringInterval;
    constructor(thresholds) {
        this.thresholds = {
            queryP95ThresholdMs: thresholds?.queryP95ThresholdMs ?? 100,
            slowQueryThresholdMs: thresholds?.slowQueryThresholdMs ?? 200,
            cacheHitRateThreshold: thresholds?.cacheHitRateThreshold ?? 70,
            memoryUsageThreshold: thresholds?.memoryUsageThreshold ?? 80
        };
        logger_1.logger.info('PerformanceMonitoringService initialized', { thresholds: this.thresholds });
    }
    async generateReport() {
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
        const recommendations = this.generateRecommendations(databaseReport, cacheReport, memoryReport, cpuReport);
        const report = {
            timestamp: new Date(),
            overallStatus,
            database: databaseReport,
            cache: cacheReport,
            memory: memoryReport,
            cpu: cpuReport,
            recommendations
        };
        this.addToHistory(report);
        return report;
    }
    getReportHistory() {
        return [...this.reportHistory];
    }
    async getQuickSummary() {
        const queryStats = QueryAnalyzerService_1.queryAnalyzerService.getQueryStats();
        const cacheMetrics = EnhancedCacheService_1.enhancedCacheService.getMetrics();
        const memory = process.memoryUsage();
        const memoryUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
        const statuses = [];
        if (queryStats.p95Duration > this.thresholds.queryP95ThresholdMs) {
            statuses.push(queryStats.p95Duration > this.thresholds.slowQueryThresholdMs
                ? PerformanceHealthStatus.CRITICAL
                : PerformanceHealthStatus.DEGRADED);
        }
        else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }
        if (cacheMetrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            statuses.push(cacheMetrics.hitRate < 50
                ? PerformanceHealthStatus.CRITICAL
                : PerformanceHealthStatus.DEGRADED);
        }
        else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }
        if (memoryUsagePercent > this.thresholds.memoryUsageThreshold) {
            statuses.push(memoryUsagePercent > 90
                ? PerformanceHealthStatus.CRITICAL
                : PerformanceHealthStatus.DEGRADED);
        }
        else {
            statuses.push(PerformanceHealthStatus.HEALTHY);
        }
        const loadAvg = os_1.default.loadavg();
        const coreCount = os_1.default.cpus().length;
        const normalizedLoad = loadAvg[0] / coreCount;
        if (normalizedLoad > 0.9) {
            statuses.push(PerformanceHealthStatus.CRITICAL);
        }
        else if (normalizedLoad > 0.7) {
            statuses.push(PerformanceHealthStatus.DEGRADED);
        }
        else {
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
    startMonitoring(intervalMs = 60000) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.generateReport();
            }
            catch (error) {
                logger_1.logger.error('Performance monitoring error', { error });
            }
        }, intervalMs);
        logger_1.logger.info('Performance monitoring started', { intervalMs });
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    updateThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
        logger_1.logger.info('Performance thresholds updated', { thresholds: this.thresholds });
    }
    getThresholds() {
        return { ...this.thresholds };
    }
    async getDatabasePerformance() {
        const queryStats = QueryAnalyzerService_1.queryAnalyzerService.getQueryStats();
        const slowQueries = QueryAnalyzerService_1.queryAnalyzerService.analyzeSlowQueries();
        const indexRecommendations = QueryAnalyzerService_1.queryAnalyzerService.getIndexRecommendations();
        let connectionPoolStatus;
        if (data_source_1.AppDataSource.isInitialized) {
            try {
                const poolInfo = data_source_1.AppDataSource.driver?.pool;
                if (poolInfo) {
                    connectionPoolStatus = {
                        active: poolInfo.totalCount - poolInfo.idleCount,
                        idle: poolInfo.idleCount,
                        total: poolInfo.totalCount
                    };
                }
            }
            catch {
            }
        }
        let status = PerformanceHealthStatus.HEALTHY;
        if (queryStats.p95Duration > this.thresholds.slowQueryThresholdMs || slowQueries.length > 10) {
            status = PerformanceHealthStatus.CRITICAL;
        }
        else if (queryStats.p95Duration > this.thresholds.queryP95ThresholdMs || slowQueries.length > 5) {
            status = PerformanceHealthStatus.DEGRADED;
        }
        return {
            status,
            queryStats,
            slowQueries: slowQueries.slice(0, 10),
            indexRecommendations: indexRecommendations.slice(0, 5),
            connectionPoolStatus
        };
    }
    getCachePerformance() {
        const metrics = EnhancedCacheService_1.enhancedCacheService.getMetrics();
        const history = EnhancedCacheService_1.enhancedCacheService.getMetricsHistory();
        let hitRateTrend = 'stable';
        if (history.length >= 3) {
            const recent = history.slice(-3);
            const oldAvg = recent.slice(0, 2).reduce((sum, s) => sum + s.hitRate, 0) / 2;
            const newRate = recent[recent.length - 1].hitRate;
            if (newRate > oldAvg + 5) {
                hitRateTrend = 'improving';
            }
            else if (newRate < oldAvg - 5) {
                hitRateTrend = 'declining';
            }
        }
        let status = PerformanceHealthStatus.HEALTHY;
        if (metrics.hitRate < 50) {
            status = PerformanceHealthStatus.CRITICAL;
        }
        else if (metrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            status = PerformanceHealthStatus.DEGRADED;
        }
        return {
            status,
            metrics,
            hitRateTrend
        };
    }
    getCpuPerformance() {
        const loadAvg = os_1.default.loadavg();
        const coreCount = os_1.default.cpus().length;
        const cpuUsage = process.cpuUsage();
        const normalizedLoad = loadAvg[0] / coreCount;
        let status = PerformanceHealthStatus.HEALTHY;
        if (normalizedLoad > 0.9) {
            status = PerformanceHealthStatus.CRITICAL;
        }
        else if (normalizedLoad > 0.7) {
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
    getMemoryPerformance() {
        const memory = process.memoryUsage();
        const usagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
        let status = PerformanceHealthStatus.HEALTHY;
        if (usagePercent > 90) {
            status = PerformanceHealthStatus.CRITICAL;
        }
        else if (usagePercent > this.thresholds.memoryUsageThreshold) {
            status = PerformanceHealthStatus.DEGRADED;
        }
        return {
            status,
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
            external: Math.round(memory.external / 1024 / 1024),
            rss: Math.round(memory.rss / 1024 / 1024),
            usagePercent
        };
    }
    determineOverallStatus(statuses) {
        if (statuses.includes(PerformanceHealthStatus.CRITICAL)) {
            return PerformanceHealthStatus.CRITICAL;
        }
        if (statuses.includes(PerformanceHealthStatus.DEGRADED)) {
            return PerformanceHealthStatus.DEGRADED;
        }
        return PerformanceHealthStatus.HEALTHY;
    }
    generateRecommendations(database, cache, memory, cpu) {
        const recommendations = [];
        if (database.queryStats.p95Duration > this.thresholds.queryP95ThresholdMs) {
            recommendations.push(`Query p95 latency (${database.queryStats.p95Duration}ms) exceeds threshold. ` +
                'Review slow queries and add appropriate indices.');
        }
        if (database.indexRecommendations.length > 0) {
            recommendations.push(`${database.indexRecommendations.length} index recommendations available. ` +
                'Consider implementing high-priority indices.');
        }
        if (database.slowQueries.length > 5) {
            recommendations.push(`${database.slowQueries.length} slow queries detected. ` +
                'Review and optimize the most frequent offenders.');
        }
        if (cache.metrics.hitRate < this.thresholds.cacheHitRateThreshold) {
            recommendations.push(`Cache hit rate (${cache.metrics.hitRate}%) is below threshold. ` +
                'Consider implementing cache warming or increasing TTL.');
        }
        if (cache.hitRateTrend === 'declining') {
            recommendations.push('Cache hit rate is declining. Review invalidation patterns and key design.');
        }
        if (memory.usagePercent > this.thresholds.memoryUsageThreshold) {
            recommendations.push(`Memory usage (${memory.usagePercent}%) is above threshold. ` +
                'Consider reviewing memory allocations or increasing resources.');
        }
        if (cpu) {
            const normalizedLoad = cpu.loadAvg1m / cpu.coreCount;
            if (normalizedLoad > 0.9) {
                recommendations.push(`CPU load average (${cpu.loadAvg1m}) exceeds core count (${cpu.coreCount}). ` +
                    'Consider scaling horizontally or optimizing CPU-intensive operations.');
            }
            else if (normalizedLoad > 0.7) {
                recommendations.push(`CPU load average (${cpu.loadAvg1m}) is elevated relative to ${cpu.coreCount} cores. ` +
                    'Monitor for further increases.');
            }
        }
        if (recommendations.length === 0) {
            recommendations.push('All performance metrics are within healthy thresholds.');
        }
        return recommendations;
    }
    addToHistory(report) {
        if (this.reportHistory.length >= this.maxReportHistory) {
            this.reportHistory.shift();
        }
        this.reportHistory.push(report);
    }
}
exports.PerformanceMonitoringService = PerformanceMonitoringService;
exports.performanceMonitoringService = new PerformanceMonitoringService();
//# sourceMappingURL=PerformanceMonitoringService.js.map