import CircuitBreaker from 'opossum';
export interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
}
export interface CircuitBreakerStats {
    name: string;
    state: string;
    stats: {
        successes: number;
        failures: number;
        fallbacks: number;
        timeouts: number;
        cacheHits: number;
        fires: number;
        rejects: number;
    };
}
export declare class CircuitBreakerService {
    private static instance;
    private readonly breakers;
    private constructor();
    static getInstance(): CircuitBreakerService;
    getBreaker<T>(name: string, action: () => Promise<T>, options?: CircuitBreakerOptions, fallback?: () => T | Promise<T>): CircuitBreaker<unknown[], T>;
    execute<T>(name: string, action: () => Promise<T>, options?: CircuitBreakerOptions, fallback?: () => T | Promise<T>): Promise<T>;
    getState(name: string): string | null;
    getStats(name: string): CircuitBreakerStats | null;
    getAllStats(): CircuitBreakerStats[];
    reset(name: string): boolean;
    remove(name: string): boolean;
    clearAll(): void;
    private setupEventHandlers;
    isHealthy(name: string): boolean;
    getHealthStatus(): {
        healthy: boolean;
        unhealthyCircuits: string[];
    };
}
export declare const circuitBreakerService: CircuitBreakerService;
//# sourceMappingURL=CircuitBreakerService.d.ts.map