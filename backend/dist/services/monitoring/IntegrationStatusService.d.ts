export declare enum IntegrationStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy",
    UNKNOWN = "unknown"
}
export interface IntegrationHealth {
    name: string;
    description: string;
    status: IntegrationStatus;
    lastCheck: Date;
    responseTime?: number;
    errorMessage?: string;
    circuitBreakerState?: string;
    metrics?: {
        successRate?: number;
        avgResponseTime?: number;
        requestCount?: number;
    };
}
export interface SystemHealthSummary {
    overallStatus: IntegrationStatus;
    timestamp: Date;
    integrations: IntegrationHealth[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        unknown: number;
    };
}
export declare class IntegrationStatusService {
    private static instance;
    private readonly healthCache;
    private readonly cacheTtlMs;
    private lastCacheUpdate;
    private constructor();
    static getInstance(): IntegrationStatusService;
    getSystemHealth(): Promise<SystemHealthSummary>;
    private checkAllIntegrations;
    private checkMemoryHealth;
    private checkDatabaseHealth;
    private checkRedisHealth;
    private checkRSIApiHealth;
    private checkUIFApiHealth;
    private checkDiscordHealth;
    private checkAzureServicesHealth;
    private createHealthEntry;
    getIntegrationHealth(integrationName: string): Promise<IntegrationHealth | null>;
    refreshHealth(): Promise<SystemHealthSummary>;
}
export declare const integrationStatusService: IntegrationStatusService;
//# sourceMappingURL=IntegrationStatusService.d.ts.map