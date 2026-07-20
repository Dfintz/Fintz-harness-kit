export interface EndpointRateLimitOverride {
    windowMs?: number;
    maxRequests?: number;
    updatedAt: string;
    updatedBy: string;
}
export interface RateLimitEndpointConfig {
    windowMs: number;
    maxRequests: number;
    isOverridden: boolean;
}
declare class RateLimitConfigService {
    private static instance;
    private readonly OVERRIDE_KEY;
    private constructor();
    static getInstance(): RateLimitConfigService;
    getOverrides(): Promise<Record<string, EndpointRateLimitOverride>>;
    getEndpointConfig(endpoint: string): Promise<RateLimitEndpointConfig>;
    updateOverrides(endpoints: Record<string, {
        windowMs?: number;
        maxRequests?: number;
    }>, updatedBy: string): Promise<Record<string, EndpointRateLimitOverride>>;
    resetUserRateLimits(userId: string): Promise<{
        cleared: number;
    }>;
}
export declare const rateLimitConfigService: RateLimitConfigService;
export {};
//# sourceMappingURL=RateLimitConfigService.d.ts.map