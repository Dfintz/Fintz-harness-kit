interface RsiOrganizationData {
    id?: string;
    name?: string;
    sid?: string;
    description?: string;
    memberCount?: number;
    lastFetched?: string;
    isStub?: boolean;
    members?: Array<{
        handle: string;
        rank?: string;
        isMain?: boolean;
    }>;
    [key: string]: unknown;
}
interface RsiUserData {
    handle?: string;
    displayName?: string;
    moniker?: string;
    bio?: string;
    badge?: string;
    badgeImage?: string;
    image?: string;
    enlisted?: string;
    fluency?: string[];
    location?: string;
    website?: string;
    title?: string;
    citizenRecord?: string;
    probation?: boolean;
    probationEnd?: string | null;
    lastFetched?: string;
    isStub?: boolean;
    organizations?: RsiUserOrganization[];
    [key: string]: unknown;
}
interface RsiUserOrganization {
    sid?: string;
    name?: string;
    rank?: string;
    stars?: number;
    rankNumber?: number;
    isMain?: boolean;
    isAffiliate?: boolean;
    isHidden?: boolean;
    [key: string]: unknown;
}
interface RsiVerificationResult {
    verified: boolean;
    handle?: string;
    displayName?: string;
    bio?: string;
    organizations?: RsiUserOrganization[];
    error?: string;
}
export type MembershipStatus = 'member' | 'not_member' | 'account_not_found' | 'unknown';
interface RsiOrganizationVerificationResult {
    verified: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    membershipStatus: MembershipStatus;
    sid?: string;
    name?: string;
    rank?: string;
    error?: string;
}
interface CacheStats {
    keys: number;
    hits: number;
    misses: number;
    ksize: number;
    vsize: number;
}
export declare class RsiApiService {
    private cache;
    private staleCache;
    private staleTtlMs;
    private static readonly OWNER_RANKS;
    private static readonly ADMIN_RANKS;
    private static readonly MIN_ADMIN_STARS;
    constructor();
    private setStaleCache;
    private getStaleCache;
    private cleanStaleCache;
    getCircuitStatus(): {
        state: string;
        failures: number;
        lastFailure: Date | null;
    };
    isDegraded(): boolean;
    getStaleCacheStats(): {
        entries: number;
        oldestAgeMs: number | null;
    };
    fetchOrganizationData(identifier: string): Promise<RsiOrganizationData>;
    fetchUserData(handle: string): Promise<RsiUserData>;
    clearCache(): void;
    getCacheStats(): CacheStats;
    verifyHandle(handle: string): Promise<RsiVerificationResult>;
    verifyBioCode(handle: string, verificationCode: string): Promise<boolean>;
    verifyOrgDescriptionCode(orgSid: string, verificationCode: string): Promise<boolean>;
    verifyOrganizationMembership(handle: string, orgSid: string): Promise<RsiOrganizationVerificationResult>;
}
export type { RsiOrganizationData, RsiOrganizationVerificationResult, RsiUserData, RsiUserOrganization, RsiVerificationResult, };
export declare const rsiApiService: RsiApiService;
//# sourceMappingURL=RSIApiService.d.ts.map