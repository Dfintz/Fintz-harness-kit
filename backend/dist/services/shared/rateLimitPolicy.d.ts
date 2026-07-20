export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}
export interface BlockableRateLimitResult extends RateLimitResult {
    blockedUntil?: Date;
}
export declare function buildRateLimitKey(domain: string, action: string, ...scope: string[]): string;
export declare function rateLimitRetryAfterSeconds(result: Pick<RateLimitResult, 'resetAt'>, now?: number): number;
//# sourceMappingURL=rateLimitPolicy.d.ts.map