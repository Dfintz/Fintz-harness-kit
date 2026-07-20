import { EventEmitter } from 'events';
export declare enum AnomalySeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum AnomalyType {
    HIGH_RESPONSE_TIME = "high_response_time",
    HIGH_ERROR_RATE = "high_error_rate",
    LOW_CACHE_HIT_RATE = "low_cache_hit_rate",
    HIGH_MEMORY_USAGE = "high_memory_usage",
    HIGH_CPU_USAGE = "high_cpu_usage",
    DATABASE_DEGRADATION = "database_degradation",
    TRAFFIC_SPIKE = "traffic_spike",
    TRAFFIC_DROP = "traffic_drop",
    UNUSUAL_PATTERN = "unusual_pattern",
    BRUTE_FORCE_ATTACK = "brute_force_attack",
    EXCESSIVE_FAILED_LOGINS = "excessive_failed_logins",
    UNUSUAL_ACCESS_PATTERN = "unusual_access_pattern",
    RATE_LIMIT_ABUSE = "rate_limit_abuse",
    SUSPICIOUS_IP_ACTIVITY = "suspicious_ip_activity",
    UNUSUAL_USER_ACTIVITY = "unusual_user_activity",
    MASS_DATA_ACCESS = "mass_data_access",
    PRIVILEGE_ESCALATION_ATTEMPT = "privilege_escalation_attempt"
}
export interface DetectedAnomaly {
    id: string;
    type: AnomalyType;
    severity: AnomalySeverity;
    timestamp: Date;
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    deviationPercent: number;
    description: string;
    affectedComponent: string;
    recommendations: string[];
    isActive: boolean;
    resolvedAt?: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
}
export interface AnomalyDetectionConfig {
    enabled: boolean;
    checkIntervalMs: number;
    maxHistorySize: number;
    maxBaselineSamples: number;
    thresholds: {
        responseTime: {
            warning: number;
            critical: number;
        };
        errorRate: {
            warning: number;
            critical: number;
        };
        memoryUsage: {
            warning: number;
            critical: number;
        };
        cacheHitRate: {
            warning: number;
            critical: number;
        };
        trafficDeviation: {
            warning: number;
            critical: number;
        };
        failedLogins: {
            warning: number;
            critical: number;
        };
    };
    alerting: {
        notifyOnLow: boolean;
        notifyOnMedium: boolean;
        notifyOnHigh: boolean;
        notifyOnCritical: boolean;
    };
}
export declare class AnomalyDetectionService extends EventEmitter {
    private static instance;
    private config;
    private isRunning;
    private checkInterval;
    private baselines;
    private activeAnomalies;
    private anomalyHistory;
    private constructor();
    static getInstance(config?: Partial<AnomalyDetectionConfig>): AnomalyDetectionService;
    private initializeBaselines;
    start(): void;
    stop(): void;
    private runDetection;
    private detectPerformanceAnomalies;
    private detectSecurityAnomalies;
    private reportAnomaly;
    private shouldNotify;
    private addToHistory;
    private checkResolvedAnomalies;
    private resolveAnomaly;
    private updateBaselines;
    private updateBaseline;
    getActiveAnomalies(): DetectedAnomaly[];
    getAnomalyHistory(limit?: number): DetectedAnomaly[];
    getAnomaliesBySeverity(severity: AnomalySeverity): DetectedAnomaly[];
    getAnomaliesByType(type: AnomalyType): DetectedAnomaly[];
    acknowledgeAnomaly(anomalyId: string, userId: string): boolean;
    getConfig(): AnomalyDetectionConfig;
    updateConfig(config: Partial<AnomalyDetectionConfig>): void;
    getStatistics(): {
        isRunning: boolean;
        activeAnomalies: number;
        totalAnomaliesDetected: number;
        bySeverity: Record<AnomalySeverity, number>;
        byType: Record<string, number>;
        baselines: Record<string, {
            mean: number;
            stdDev: number;
            samples: number;
        }>;
    };
    isActive(): boolean;
}
//# sourceMappingURL=AnomalyDetectionService.d.ts.map