import { ActivityLevel, OrgPrimaryFocus, PublicOrgProfile } from '../../models/PublicOrgProfile';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface DirectoryFilterOptions {
    primaryFocus?: OrgPrimaryFocus;
    primaryFocuses?: OrgPrimaryFocus[];
    activityLevel?: ActivityLevel;
    activityLevels?: ActivityLevel[];
    isRecruiting?: boolean;
    isVerified?: boolean;
    minMemberCount?: number;
    maxMemberCount?: number;
    languages?: string[];
    timezone?: string;
    searchTerm?: string;
}
export interface PublicOrgListItem {
    id: string;
    organizationId: string;
    organizationName: string;
    rsiSid?: string;
    slug: string;
    organizationDescription?: string;
    organizationLogoUrl?: string;
    tagline?: string;
    primaryFocus: OrgPrimaryFocus;
    secondaryFocus?: OrgPrimaryFocus[];
    memberCount: number;
    activityLevel: ActivityLevel;
    rsiUrl?: string;
    discordInvite?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
    twitchUrl?: string;
    websiteUrl?: string;
    bannerUrl?: string;
    languages?: string[];
    timezone?: string;
    isVerified: boolean;
    isRecruiting: boolean;
    rsiArchetype?: string;
    rsiCommitment?: string;
    rsiRolePlay?: boolean;
    rsiExclusive?: boolean;
    skillDistribution?: Record<string, {
        low: number;
        medium: number;
        high: number;
        expert: number;
    }>;
}
export interface PublicProfileInput {
    isPublic?: boolean;
    tagline?: string;
    primaryFocus?: OrgPrimaryFocus;
    secondaryFocus?: OrgPrimaryFocus[];
    rsiUrl?: string;
    discordInvite?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
    twitchUrl?: string;
    websiteUrl?: string;
    bannerUrl?: string;
    logoUrl?: string;
    languages?: string[];
    timezone?: string;
    isRecruiting?: boolean;
    useDiscordForApplications?: boolean;
    scstatsVisibility?: {
        showVerification?: boolean;
        showSkills?: boolean;
        showTimezone?: boolean;
        showAnalytics?: boolean;
    };
}
export declare class PublicOrgDirectoryService {
    private readonly profileRepository;
    private readonly organizationRepository;
    constructor();
    getPublicDirectory(filters?: DirectoryFilterOptions, pagination?: PaginationOptions): Promise<PaginatedResponse<PublicOrgListItem>>;
    getPublicProfile(identifier: string): Promise<PublicOrgListItem | null>;
    getOrCreateProfile(organizationId: string): Promise<PublicOrgProfile>;
    updateProfile(organizationId: string, input: PublicProfileInput): Promise<PublicOrgProfile>;
    private getLiveMemberCounts;
    private batchGetSkillDistributions;
    private fetchMemberOrgMapping;
    private aggregateImportsIntoDistribution;
    private distributeCareerHoursToOrgs;
    private bucketFlightHours;
    syncMemberCount(organizationId: string): Promise<PublicOrgProfile | null>;
    syncFromRsi(organizationId: string, rsiSid: string): Promise<PublicOrgProfile>;
    private applyRsiFieldsToProfile;
    private applyRsiMetadataToProfile;
    private syncOrgEntityFromRsi;
    private applyDirectoryFilters;
    private mapRsiFocusToEnum;
    setVerificationStatus(organizationId: string, isVerified: boolean): Promise<PublicOrgProfile>;
    deleteProfile(organizationId: string): Promise<boolean>;
    syncSlug(organizationId: string, newName: string): Promise<PublicOrgProfile | null>;
    private generateUniqueSlug;
    getFocusOptions(): OrgPrimaryFocus[];
    getActivityLevelOptions(): ActivityLevel[];
    getDirectoryStats(): Promise<{
        totalOrganizations: number;
        recruitingOrganizations: number;
        verifiedOrganizations: number;
        byFocus: Record<string, number>;
    }>;
}
//# sourceMappingURL=PublicOrgDirectoryService.d.ts.map