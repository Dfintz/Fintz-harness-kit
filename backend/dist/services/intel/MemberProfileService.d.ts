import type { MemberIntelProfile } from '@sc-fleet-manager/shared-types';
export declare class MemberProfileService {
    private readonly rsiLinkRepo;
    private readonly rsiCacheRepo;
    private readonly citizenOrgRepo;
    private readonly membershipRepo;
    private readonly guildOrgRepo;
    private readonly userRepo;
    private readonly auditService;
    private readonly watchlistService;
    private readonly visibilityService;
    private readonly roleMappingService;
    constructor();
    getProfile(organizationId: string, targetUserId: string, viewerId?: string, isPlatformAdmin?: boolean): Promise<MemberIntelProfile>;
    private safeFetch;
    private fetchOtherRsiOrgs;
    private fetchPlatformMemberships;
    private crossReferenceWatchlist;
    private fetchModerationSummary;
    private fetchDiscordPresence;
    private fetchDiscordPresenceViaIPC;
    private applyVisibilityRules;
    private buildRsiPresence;
    private mapSyncStatus;
    private buildRoleAlignment;
}
//# sourceMappingURL=MemberProfileService.d.ts.map