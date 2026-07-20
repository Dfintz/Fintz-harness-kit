export interface RoleMutationAuthorizationInput {
    organizationId: string;
    guildId: string;
    roleId: string;
    discordUserId: string;
}
export declare class RsiRoleMutationAuthorizationService {
    private readonly cacheTtlMs;
    private readonly scheduleCache;
    private readonly roleAllowedCache;
    constructor(cacheTtlMs?: number);
    private getCachedValue;
    private setCachedValue;
    private evictIfOverCapacity;
    private getSchedule;
    private isMappedRole;
    validateRoleMutation(payload: RoleMutationAuthorizationInput): Promise<string | null>;
    clearCachesForTests(): void;
}
export declare const rsiRoleMutationAuthorizationService: RsiRoleMutationAuthorizationService;
//# sourceMappingURL=RsiRoleMutationAuthorizationService.d.ts.map