export interface RsiOrgData {
    sid: string;
    name: string;
    description?: string;
    history?: string;
    manifesto?: string;
    charter?: string;
    banner?: string;
    logo?: string;
    archetype?: string;
    commitment?: string;
    roleplay?: string;
    memberCount: number;
    affiliateCount: number;
    focus?: {
        primary?: string;
        secondary?: string;
    };
    recruiting?: string;
    language?: string;
    exclusive?: string;
    links?: {
        website?: string;
        discord?: string;
        youtube?: string;
        twitch?: string;
    };
}
export interface RsiMemberData {
    handle: string;
    displayName?: string;
    rank?: string;
    stars: number;
    rankNumber?: number;
    isMain: boolean;
    isAffiliate: boolean;
    isHidden: boolean;
    avatar?: string;
    enlisted?: string;
    roles?: string[];
}
export interface RsiCitizenData {
    handle: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    citizenRecord?: string;
    title?: string;
    enlisted?: string;
    fluency?: string;
    location?: string;
    website?: string;
}
export declare class RsiCrawlerService {
    private baseUrl;
    private timeout;
    private cache;
    private axiosInstance;
    private rateLimiter;
    private circuitState;
    private failures;
    private lastFailureTime;
    private readonly failureThreshold;
    private readonly openDuration;
    constructor();
    private checkCircuitBreaker;
    private recordSuccess;
    private recordFailure;
    private checkRateLimit;
    crawlOrganization(sid: string): Promise<RsiOrgData>;
    crawlOrganizationMembers(sid: string, page?: number): Promise<RsiMemberData[]>;
    crawlUserMemberships(handle: string): Promise<Array<{
        sid: string;
        name: string;
        rank?: string;
        stars: number;
        isMain: boolean;
    }>>;
    private isControlPathErrorMessage;
    crawlCitizen(handle: string): Promise<RsiCitizenData | null>;
    invalidateCitizenCache(handle: string): void;
    invalidateOrgCache(sid: string): void;
    clearCache(): void;
    getCircuitStatus(): {
        state: string;
        failures: number;
        lastFailure: Date | null;
    };
    private extractText;
    private extractOrgTabContent;
    private extractImageUrl;
    private extractNumber;
    private extractCountFromPageText;
    private extractStars;
}
export declare const rsiCrawlerService: RsiCrawlerService;
//# sourceMappingURL=RsiCrawlerService.d.ts.map