export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy"
}
export interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    hitRate: number;
    ksize: number;
    vsize: number;
}
export interface ServiceHealthCheck {
    service: string;
    status: HealthStatus;
    cacheEnabled: boolean;
    cacheStats?: CacheStats;
    databaseConnected: boolean;
    responseTime?: number;
    lastCheck: Date;
    details?: Record<string, unknown>;
}
export interface SystemHealthCheck {
    status: HealthStatus;
    timestamp: Date;
    services: ServiceHealthCheck[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
    };
}
//# sourceMappingURL=health.d.ts.map