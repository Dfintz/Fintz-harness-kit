import { EventEmitter } from 'events';
export interface DashboardConfig {
    metricHistorySize: number;
}
export declare enum RefreshInterval {
    REAL_TIME = 1000,
    FAST = 5000,
    NORMAL = 15000,
    SLOW = 60000
}
export declare enum DashboardWidget {
    SYSTEM_HEALTH = "system_health",
    ACTIVE_USERS = "active_users",
    ERROR_RATE = "error_rate",
    RESPONSE_TIME = "response_time",
    SECURITY_ALERTS = "security_alerts",
    DATABASE_STATUS = "database_status",
    CACHE_PERFORMANCE = "cache_performance",
    MEMORY_USAGE = "memory_usage",
    CPU_USAGE = "cpu_usage",
    NETWORK_TRAFFIC = "network_traffic",
    API_REQUESTS = "api_requests",
    ACTIVE_SESSIONS = "active_sessions"
}
export interface RealTimeMetric {
    timestamp: Date;
    value: number;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
}
export interface DashboardUpdate {
    widget: DashboardWidget;
    data: RealTimeMetric | Record<string, unknown>;
    timestamp: Date;
}
export interface LiveDashboardState {
    lastUpdated: Date;
    systemHealth: {
        status: 'healthy' | 'degraded' | 'critical';
        uptime: number;
        components: {
            database: 'up' | 'down' | 'degraded';
            cache: 'up' | 'down' | 'degraded';
            api: 'up' | 'down' | 'degraded';
            websocket: 'up' | 'down' | 'degraded';
        };
    };
    metrics: {
        activeUsers: RealTimeMetric;
        requestsPerSecond: RealTimeMetric;
        avgResponseTime: RealTimeMetric;
        errorRate: RealTimeMetric;
        memoryUsage: RealTimeMetric;
        cacheHitRate: RealTimeMetric;
    };
    alerts: {
        critical: number;
        warning: number;
        recent: Array<{
            type: string;
            message: string;
            timestamp: Date;
        }>;
    };
}
export declare class AdminRealTimeDashboardService extends EventEmitter {
    private static instance;
    private config;
    private isRunning;
    private refreshIntervals;
    private metricHistory;
    private currentState;
    private subscribers;
    private constructor();
    static getInstance(config?: Partial<DashboardConfig>): AdminRealTimeDashboardService;
    private initializeState;
    private createInitialMetric;
    private initializeMetricHistory;
    start(): void;
    stop(): void;
    private setupRefreshInterval;
    private refreshAllWidgets;
    private refreshWidget;
    private updateSystemHealth;
    private determineOverallHealth;
    private updateActiveUsers;
    private updateErrorRate;
    private updateResponseTime;
    private updateMemoryUsage;
    private updateSecurityAlerts;
    private updateCachePerformance;
    private createMetricWithTrend;
    private calculateTrend;
    private calculateChangePercent;
    getCurrentState(): LiveDashboardState;
    getMetricHistory(metricName: string, limit?: number): Array<{
        timestamp: Date;
        value: number;
    }>;
    subscribe(subscriberId: string): void;
    unsubscribe(subscriberId: string): void;
    getSubscriberCount(): number;
    isActive(): boolean;
    getStatistics(): {
        isRunning: boolean;
        subscriberCount: number;
        lastUpdated: Date;
        metricsTracked: number;
        historySize: Record<string, number>;
    };
}
//# sourceMappingURL=AdminRealTimeDashboardService.d.ts.map