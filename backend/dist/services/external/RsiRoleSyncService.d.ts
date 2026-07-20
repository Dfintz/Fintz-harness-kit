import { RsiUserOrganization } from './RSIApiService';
export interface RsiOrgMember {
    rsiHandle: string;
    rsiRank: string;
    rsiRankOrder?: number;
    isAffiliate: boolean;
    displayName?: string;
}
export interface RsiRoleSyncConfig {
    refreshInterval: number;
    cacheTTL: number;
    maxMembersPerRequest: number;
    paginationDelay: number;
    autoRefreshEnabled: boolean;
}
export interface CacheRefreshResult {
    success: boolean;
    membersProcessed: number;
    membersAdded: number;
    membersUpdated: number;
    membersRemoved: number;
    errors: string[];
    duration: number;
}
export interface FetchMembersResult {
    success: boolean;
    members: RsiOrgMember[];
    error?: string;
    fromCache: boolean;
}
export declare class RsiRoleSyncService {
    private config;
    private refreshTimers;
    private memberCacheRepository;
    private static readonly DEFAULT_CONFIG;
    constructor(config?: Partial<RsiRoleSyncConfig>);
    getConfig(): RsiRoleSyncConfig;
    updateConfig(config: Partial<RsiRoleSyncConfig>): void;
    fetchOrganizationMembers(organizationId: string, rsiOrgSid: string, forceRefresh?: boolean): Promise<FetchMembersResult>;
    private fetchMembersFromRsi;
    verifyAndCacheMember(organizationId: string, rsiOrgSid: string, rsiHandle: string): Promise<{
        status: 'verified' | 'departed' | 'api_error';
        member?: RsiOrgMember;
    }>;
    getCachedMembers(organizationId: string, rsiOrgSid?: string): Promise<RsiOrgMember[]>;
    getCachedMember(organizationId: string, rsiHandle: string): Promise<RsiOrgMember | null>;
    refreshCache(organizationId: string, rsiOrgSid: string): Promise<CacheRefreshResult>;
    startAutoRefresh(organizationId: string, rsiOrgSid: string): void;
    stopAutoRefresh(organizationId: string, rsiOrgSid: string): void;
    stopAllAutoRefresh(): void;
    clearCache(organizationId: string, rsiOrgSid?: string): Promise<number>;
    getCacheStats(organizationId: string): Promise<{
        totalCached: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
        expiredEntries: number;
    }>;
    needsRefresh(organizationId: string, rsiOrgSid: string): Promise<boolean>;
    mapUserOrgToMember(userOrg: RsiUserOrganization, handle: string): RsiOrgMember;
    private updateMemberCache;
    private cacheSingleMember;
    private removeMemberFromCache;
    private extractRankOrder;
    private isAffiliateRank;
}
export declare const rsiRoleSyncService: RsiRoleSyncService;
//# sourceMappingURL=RsiRoleSyncService.d.ts.map