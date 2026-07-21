/**
 * Service Health Check Types
 * Used for monitoring service status, cache performance, and database connectivity
 */

/**
 * Health status levels
 */
export enum HealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNHEALTHY = 'unhealthy'
}

/**
 * Cache statistics for performance monitoring
 */
export interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    hitRate: number;
    ksize: number;
    vsize: number;
}

/**
 * Individual service health check result
 */
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

/**
 * Overall system health check result
 */
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
