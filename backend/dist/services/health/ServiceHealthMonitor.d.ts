export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy",
    UNKNOWN = "unknown"
}
export interface ComponentHealth {
    name: string;
    status: HealthStatus;
    message?: string;
    responseTime?: number;
    details?: Record<string, unknown>;
    lastCheck: Date;
}
export interface SystemHealth {
    status: HealthStatus;
    timestamp: Date;
    uptime: number;
    version: string;
    components: ComponentHealth[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
    };
}
export interface IHealthCheckable {
    healthCheck(): Promise<ComponentHealth>;
    getServiceName(): string;
}
export declare class ServiceHealthMonitor {
    private startTime;
    private version;
    private registeredServices;
    constructor(version?: string);
    registerService(service: IHealthCheckable): void;
    unregisterService(serviceName: string): void;
    private checkDatabaseHealth;
    private checkMemoryHealth;
    private checkDiskHealth;
    getSystemHealth(): Promise<SystemHealth>;
    getComponentHealth(componentName: string): Promise<ComponentHealth | null>;
    getUptimeFormatted(): string;
    isHealthy(): Promise<boolean>;
    getUnhealthyComponents(): Promise<ComponentHealth[]>;
    logHealthSummary(): Promise<void>;
}
export declare const healthMonitor: ServiceHealthMonitor;
//# sourceMappingURL=ServiceHealthMonitor.d.ts.map