import { CacheMetrics } from '../caching/EnhancedCacheService';
import { QueryStats, SlowQueryAnalysis, IndexRecommendation } from './QueryAnalyzerService';
export declare enum PerformanceHealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    CRITICAL = "critical"
}
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
        processUser: number;
        processSystem: number;
    };
    recommendations: string[];
}
export interface PerformanceThresholds {
    queryP95ThresholdMs: number;
    slowQueryThresholdMs: number;
    cacheHitRateThreshold: number;
    memoryUsageThreshold: number;
}
export declare class PerformanceMonitoringService {
    private thresholds;
    private reportHistory;
    private readonly maxReportHistory;
    private monitoringInterval?;
    constructor(thresholds?: Partial<PerformanceThresholds>);
    generateReport(): Promise<PerformanceReport>;
    getReportHistory(): PerformanceReport[];
    getQuickSummary(): Promise<{
        status: PerformanceHealthStatus;
        queryLatencyP95: number;
        cacheHitRate: number;
        memoryUsagePercent: number;
        cpuLoadNormalized: number;
    }>;
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    updateThresholds(thresholds: Partial<PerformanceThresholds>): void;
    getThresholds(): PerformanceThresholds;
    private getDatabasePerformance;
    private getCachePerformance;
    private getCpuPerformance;
    private getMemoryPerformance;
    private determineOverallStatus;
    private generateRecommendations;
    private addToHistory;
}
export declare const performanceMonitoringService: PerformanceMonitoringService;
//# sourceMappingURL=PerformanceMonitoringService.d.ts.map