import { ComponentHealth, IHealthCheckable } from './ServiceHealthMonitor';
export interface ExternalServiceConfig {
    name: string;
    url: string;
    timeout?: number;
    expectedStatusCodes?: number[];
    headers?: Record<string, string>;
    method?: 'GET' | 'HEAD';
    critical?: boolean;
}
export interface ExternalServiceHealthDetails {
    url: string;
    statusCode?: number;
    responseTimeMs: number;
    lastSuccessfulCheck?: Date;
    consecutiveFailures: number;
    critical: boolean;
}
export interface ExternalServiceResult {
    name: string;
    health: ComponentHealth;
}
export declare class ExternalServiceHealthCheckService implements IHealthCheckable {
    private serviceName;
    private services;
    private serviceHealth;
    private lastOverallCheck;
    constructor();
    private registerDefaultServices;
    getServiceName(): string;
    registerService(config: ExternalServiceConfig): void;
    unregisterService(name: string): void;
    healthCheck(): Promise<ComponentHealth>;
    checkAllServices(): Promise<ExternalServiceResult[]>;
    checkService(name: string): Promise<ExternalServiceResult>;
    getServiceHealthDetails(name: string): ExternalServiceHealthDetails | undefined;
    getRegisteredServices(): string[];
    hasCriticalFailures(): boolean;
    getFailingServices(): string[];
}
export declare const externalServiceHealthService: ExternalServiceHealthCheckService;
//# sourceMappingURL=ExternalServiceHealthCheckService.d.ts.map