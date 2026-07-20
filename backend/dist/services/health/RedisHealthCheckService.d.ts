import { ComponentHealth, HealthStatus, IHealthCheckable } from './ServiceHealthMonitor';
export interface RedisHealthDetails {
    connected: boolean;
    enabled: boolean;
    responseTimeMs?: number;
    memoryUsage?: string;
    connectedClients?: number;
    usedMemoryPeak?: string;
    keyCount?: number;
    uptime?: number;
    version?: string;
    error?: string;
}
export declare class RedisHealthCheckService implements IHealthCheckable {
    private serviceName;
    private lastCheck;
    private lastHealthStatus;
    private checkHistory;
    private readonly maxHistory;
    getServiceName(): string;
    healthCheck(): Promise<ComponentHealth>;
    private pingRedis;
    private getRedisDetails;
    private buildHealthResult;
    private recordCheck;
    getCheckHistory(): Array<{
        timestamp: Date;
        status: HealthStatus;
        responseTime: number;
    }>;
    getAverageResponseTime(): number | null;
    getUptimePercentage(): number | null;
    getLastHealthStatus(): HealthStatus;
    getLastCheckTime(): Date | null;
}
export declare const redisHealthService: RedisHealthCheckService;
//# sourceMappingURL=RedisHealthCheckService.d.ts.map