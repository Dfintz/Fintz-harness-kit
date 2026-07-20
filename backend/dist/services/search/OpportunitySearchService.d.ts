import { ActivityStatus, ActivityType } from '../../models/Activity';
import { JobType, ListingCategory, PayType } from '../../models/PublicJobListing';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { ActivityService } from '../activity/ActivityService';
import { PublicJobListingService } from '../organization/PublicJobListingService';
export type OpportunitySourceType = 'job' | 'activity';
export interface UnifiedOpportunityFilters {
    sourceType?: 'all' | OpportunitySourceType;
    searchTerm?: string;
    organizationId?: string;
    tags?: string[];
    jobTypes?: JobType[];
    payTypes?: PayType[];
    listingCategory?: ListingCategory;
    minPay?: number;
    maxPay?: number;
    activityTypes?: ActivityType[];
    activityStatus?: ActivityStatus[];
    hasOpenSlots?: boolean;
    isFeatured?: boolean;
    startDate?: Date;
    endDate?: Date;
    minReputationScore?: number;
    reputationTiers?: string[];
    minSuccessRate?: number;
}
export interface UnifiedOpportunityItem {
    id: string;
    sourceType: OpportunitySourceType;
    title: string;
    description?: string;
    organizationId?: string;
    organizationName?: string;
    organizationLogoUrl?: string;
    tags?: string[];
    postedAt: Date;
    expiresAt?: Date;
    isActive: boolean;
    jobType?: JobType;
    payDisplay?: string;
    payMin?: number;
    payMax?: number;
    experienceLevel?: number;
    listingCategory?: ListingCategory;
    crewSpotsTotal?: number;
    crewSpotsFilled?: number;
    shipCrewBreakdown?: unknown[];
    requiredShips?: unknown[];
    shipRequirementType?: string;
    ownerType?: string;
    allianceName?: string;
    focus?: string;
    activityType?: ActivityType;
    activityStatus?: ActivityStatus;
    scheduledStartDate?: Date;
    currentParticipants?: number;
    maxParticipants?: number;
    location?: string;
    difficulty?: string;
    creatorReputationScore?: number;
    creatorReputationTier?: string;
    creatorSuccessRate?: number;
}
export declare class OpportunitySearchService {
    private readonly jobListingService;
    private readonly activityService;
    private readonly reputationService;
    constructor(jobListingService?: PublicJobListingService, activityService?: ActivityService);
    searchOpportunities(filters: UnifiedOpportunityFilters, pagination?: PaginationOptions): Promise<PaginatedResponse<UnifiedOpportunityItem>>;
    countOpportunities(filters?: UnifiedOpportunityFilters): Promise<number>;
    private fetchJobs;
    private fetchActivities;
    private normalizeJob;
    private normalizeActivity;
    private enrichAndFilterByReputation;
    private sortItems;
}
//# sourceMappingURL=OpportunitySearchService.d.ts.map