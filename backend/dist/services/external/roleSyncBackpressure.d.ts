import { AdaptiveRateLimiter } from '../../utils/adaptiveRateLimiter';
export interface RoleSyncDiscordService {
    assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
}
export declare function isDiscordRateLimitError(error: unknown): boolean;
export declare function extractRetryAfterMs(error: unknown): number | undefined;
export declare function createRoleSyncRateLimiter(): AdaptiveRateLimiter;
export declare function wrapWithRoleSyncBackpressure(service: RoleSyncDiscordService, limiter: AdaptiveRateLimiter): RoleSyncDiscordService;
//# sourceMappingURL=roleSyncBackpressure.d.ts.map