export declare const RATE_LIMIT_WINDOW_MS: number;
export declare const RATE_LIMIT_MAX_REQUESTS: number;
export declare const RATE_LIMIT_REDIS_ENABLED: boolean;
export declare const RATE_LIMIT_REDIS_PREFIX: string;
export declare const RATE_LIMIT_WHITELIST_USERS: string[];
export declare const RATE_LIMIT_WHITELIST_IPS: string[];
export declare const RATE_LIMIT_LOGGING_ENABLED: boolean;
export declare const RATE_LIMIT_ALERT_THRESHOLD: number;
export declare const ROLE_RATE_LIMIT_MULTIPLIERS: Record<string, number>;
export declare function getRoleLimitMultiplier(role?: string): number;
export declare function isUserWhitelisted(userId: string): boolean;
export declare function isIpWhitelisted(ip: string): boolean;
export declare function logRateLimitConfig(): void;
//# sourceMappingURL=rateLimitConfig.d.ts.map