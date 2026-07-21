import { ActivityStatus, ActivityType, ActivityVisibility } from '../../models/Activity';
import { JobType, ListingCategory, PayType } from '../../models/PublicJobListing';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { ActivitySearchFilters, ActivityService } from '../activity/ActivityService';
import {
  JobListingFilterOptions,
  PublicJobListingService,
  PublicJobListItem,
} from '../organization/PublicJobListingService';
import { ReputationService } from '../social/ReputationService';

// ==================== TYPES ====================

/** The type of opportunity source */
export type OpportunitySourceType = 'job' | 'activity';

/** Combined filter type for unified opportunity search */
export interface UnifiedOpportunityFilters {
  /** Filter by source type: 'all', 'job', or 'activity' */
  sourceType?: 'all' | OpportunitySourceType;

  /** Global search term (applies across both sources) */
  searchTerm?: string;

  /** Organization ID filter */
  organizationId?: string;

  /** Tags filter */
  tags?: string[];

  // -- Job-specific filters --
  /** Filter by job types */
  jobTypes?: JobType[];
  /** Filter by pay types */
  payTypes?: PayType[];
  /** Filter by listing category (job vs service) */
  listingCategory?: ListingCategory;
  /** Minimum pay */
  minPay?: number;
  /** Maximum pay */
  maxPay?: number;

  // -- Activity-specific filters --
  /** Filter by activity types */
  activityTypes?: ActivityType[];
  /** Filter by activity status */
  activityStatus?: ActivityStatus[];
  /** Only show activities with open slots */
  hasOpenSlots?: boolean;
  /** Only featured activities */
  isFeatured?: boolean;
  /** Start date filter */
  startDate?: Date;
  /** End date filter */
  endDate?: Date;

  // -- Advanced filters (Sprint 23-E) --
  /** Minimum reputation score (0-100) for the opportunity creator */
  minReputationScore?: number;
  /** Filter by reputation tiers (e.g., 'Legendary', 'Elite') */
  reputationTiers?: string[];
  /** Minimum success rate (0-100) for the opportunity creator */
  minSuccessRate?: number;
}

/** A unified opportunity item that normalizes both jobs and activities */
export interface UnifiedOpportunityItem {
  /** Unique identifier */
  id: string;
  /** The source type: 'job' or 'activity' */
  sourceType: OpportunitySourceType;
  /** Title of the opportunity */
  title: string;
  /** Description text */
  description?: string;
  /** Organization ID */
  organizationId?: string;
  /** Organization name */
  organizationName?: string;
  /** Organization logo URL */
  organizationLogoUrl?: string;
  /** Tags associated */
  tags?: string[];
  /** When it was posted/created */
  postedAt: Date;
  /** When it expires / scheduled end */
  expiresAt?: Date;
  /** Whether the opportunity is currently active */
  isActive: boolean;

  // -- Job-specific fields --
  /** Job type (only for jobs) */
  jobType?: JobType;
  /** Pay display string (only for jobs) */
  payDisplay?: string;
  /** Pay minimum (only for jobs) */
  payMin?: number;
  /** Pay maximum (only for jobs) */
  payMax?: number;
  /** Experience level (only for jobs) */
  experienceLevel?: number;
  /** Listing category (only for jobs) */
  listingCategory?: ListingCategory;
  /** Crew spots total (only for jobs) */
  crewSpotsTotal?: number;
  /** Crew spots filled (only for jobs) */
  crewSpotsFilled?: number;
  /** Per-ship crew breakdown (only for jobs) */
  shipCrewBreakdown?: unknown[];
  /** Required ships (only for jobs) */
  requiredShips?: unknown[];
  /** Ship requirement type (only for jobs) */
  shipRequirementType?: string;
  /** Owner type (only for jobs) */
  ownerType?: string;
  /** Alliance name (only for jobs) */
  allianceName?: string;
  /** Focus area (only for jobs) */
  focus?: string;

  // -- Activity-specific fields --
  /** Activity type (only for activities) */
  activityType?: ActivityType;
  /** Activity status (only for activities) */
  activityStatus?: ActivityStatus;
  /** Scheduled start date (only for activities) */
  scheduledStartDate?: Date;
  /** Current participants (only for activities) */
  currentParticipants?: number;
  /** Max participants (only for activities) */
  maxParticipants?: number;
  /** Location (only for activities) */
  location?: string;
  /** Difficulty (only for activities) */
  difficulty?: string;

  // -- Reputation enrichment (Sprint 23-E) --
  /** Creator's reputation score (0-100) */
  creatorReputationScore?: number;
  /** Creator's reputation tier */
  creatorReputationTier?: string;
  /** Creator's success rate */
  creatorSuccessRate?: number;
}

// ==================== SERVICE ====================

/**
 * OpportunitySearchService - Unified search across jobs and activities
 *
 * Provides a single endpoint that queries both PublicJobListingService
 * and ActivityService, normalizes results into a common format, and
 * returns a merged, paginated result set.
 *
 * Sprint 19-G: Unified Opportunity Pool
 */
export class OpportunitySearchService {
  private readonly jobListingService: PublicJobListingService;
  private readonly activityService: ActivityService;
  private readonly reputationService: ReputationService;

  constructor(jobListingService?: PublicJobListingService, activityService?: ActivityService) {
    this.jobListingService = jobListingService ?? new PublicJobListingService();
    this.activityService = activityService ?? new ActivityService();
    this.reputationService = new ReputationService();
  }

  /**
   * Search opportunities across jobs and activities with unified filters.
   */
  async searchOpportunities(
    filters: UnifiedOpportunityFilters,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<UnifiedOpportunityItem>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const sourceType = filters.sourceType ?? 'all';

    const includeJobs = sourceType === 'all' || sourceType === 'job';
    const includeActivities = sourceType === 'all' || sourceType === 'activity';

    // NOTE: Merged pagination is approximate. Both sources are over-fetched from
    // page 1 and merged in-memory. For large datasets, later pages may be incomplete
    // because items beyond fetchLimit in either source are never retrieved. Consider
    // cursor-based pagination or a SQL UNION approach for exact results in the future.
    const fetchLimit = limit * 2; // Over-fetch to ensure we have enough after merge

    const [jobResults, activityResults] = await Promise.all([
      includeJobs
        ? this.fetchJobs(filters, { ...pagination, page: 1, limit: fetchLimit })
        : Promise.resolve({ data: [] as PublicJobListItem[], totalJobs: 0 }),
      includeActivities
        ? this.fetchActivities(filters, fetchLimit)
        : Promise.resolve({ activities: [], totalActivities: 0 }),
    ]);

    // Normalize job results (activities are already normalized in fetchActivities)
    const normalizedJobs = jobResults.data.map(job => this.normalizeJob(job));

    // Merge and sort
    let allItems = [...normalizedJobs, ...activityResults.activities];
    const sortBy = pagination.sortBy ?? 'postedAt';
    const sortOrder = pagination.sortOrder ?? 'DESC';
    this.sortItems(allItems, sortBy, sortOrder);

    // Enrich with reputation data and apply advanced filters (Sprint 23-E)
    const hasAdvancedFilters =
      filters.minReputationScore !== undefined ||
      filters.reputationTiers !== undefined ||
      filters.minSuccessRate !== undefined;

    if (hasAdvancedFilters) {
      allItems = await this.enrichAndFilterByReputation(allItems, filters);
    }

    // Calculate total from both sources (adjusted if advanced filters removed items)
    const total = hasAdvancedFilters
      ? allItems.length
      : jobResults.totalJobs + activityResults.totalActivities;

    // Apply pagination to merged results
    const skip = (page - 1) * limit;
    const paginatedItems = allItems.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Count opportunities (jobs + activities) matching the given filters.
   *
   * Uses the same sources and filter semantics as {@link searchOpportunities} so that
   * callers (e.g. the bot's Rich Presence) report a total consistent with the public
   * opportunities directory. Reputation enrichment is intentionally skipped — it only
   * affects ordering/advanced filtering, not the unfiltered total.
   */
  async countOpportunities(filters: UnifiedOpportunityFilters = {}): Promise<number> {
    const sourceType = filters.sourceType ?? 'all';
    const includeJobs = sourceType === 'all' || sourceType === 'job';
    const includeActivities = sourceType === 'all' || sourceType === 'activity';

    const [jobResults, activityResults] = await Promise.all([
      includeJobs
        ? this.fetchJobs(filters, { page: 1, limit: 1 })
        : Promise.resolve({ data: [] as PublicJobListItem[], totalJobs: 0 }),
      includeActivities
        ? this.fetchActivities(filters, 1)
        : Promise.resolve({ activities: [] as UnifiedOpportunityItem[], totalActivities: 0 }),
    ]);

    return jobResults.totalJobs + activityResults.totalActivities;
  }

  // ==================== PRIVATE HELPERS ====================

  private async fetchJobs(
    filters: UnifiedOpportunityFilters,
    pagination: PaginationOptions
  ): Promise<{ data: PublicJobListItem[]; totalJobs: number }> {
    try {
      const jobFilters: JobListingFilterOptions = {
        searchTerm: filters.searchTerm,
        organizationId: filters.organizationId,
        jobTypes: filters.jobTypes,
        payTypes: filters.payTypes,
        listingCategory: filters.listingCategory,
        minPay: filters.minPay,
        maxPay: filters.maxPay,
        isActive: true,
      };

      const result = await this.jobListingService.getPublicJobListings(jobFilters, pagination);

      return { data: result.data, totalJobs: result.pagination.total };
    } catch (error: unknown) {
      logger.error('OpportunitySearchService: Failed to fetch jobs', { error });
      return { data: [], totalJobs: 0 };
    }
  }

  private async fetchActivities(
    filters: UnifiedOpportunityFilters,
    limit: number
  ): Promise<{ activities: UnifiedOpportunityItem[]; totalActivities: number }> {
    try {
      const activityFilters: ActivitySearchFilters = {
        searchTerm: filters.searchTerm,
        organizationId: filters.organizationId,
        visibility: ActivityVisibility.PUBLIC,
        tags: filters.tags,
        activityType: filters.activityTypes,
        status: filters.activityStatus ?? [ActivityStatus.OPEN, ActivityStatus.IN_PROGRESS],
        hasOpenSlots: filters.hasOpenSlots,
        isFeatured: filters.isFeatured,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };

      const result = await this.activityService.searchActivities(activityFilters, 1, limit);

      const normalized = result.activities.map(a =>
        this.normalizeActivity(a as unknown as Record<string, unknown>)
      );
      return { activities: normalized, totalActivities: result.total };
    } catch (error: unknown) {
      logger.error('OpportunitySearchService: Failed to fetch activities', {
        error,
      });
      return { activities: [], totalActivities: 0 };
    }
  }

  private normalizeJob(job: PublicJobListItem): UnifiedOpportunityItem {
    return {
      id: job.id,
      sourceType: 'job',
      title: job.title,
      description: job.description,
      organizationId: job.organizationId,
      organizationName: job.organizationName,
      organizationLogoUrl: job.organizationLogoUrl,
      tags: job.tags,
      postedAt: job.postedAt,
      expiresAt: job.expiresAt,
      isActive: job.isActive,
      jobType: job.jobType,
      payDisplay: job.payDisplay,
      payMin: job.payMin,
      payMax: job.payMax,
      experienceLevel: job.experienceLevel,
      listingCategory: job.listingCategory,
      crewSpotsTotal: job.crewSpotsTotal,
      crewSpotsFilled: job.crewSpotsFilled,
      shipCrewBreakdown: job.shipCrewBreakdown ?? [],
      requiredShips: job.requiredShips ?? [],
      shipRequirementType: job.shipRequirementType ?? 'none',
      ownerType: job.ownerType,
      allianceName: job.allianceName,
      focus: job.focus,
    };
  }

  private normalizeActivity(
    activity: UnifiedOpportunityItem | Record<string, unknown>
  ): UnifiedOpportunityItem {
    // If already normalized (from recursive call), return as-is
    if ('sourceType' in activity && activity.sourceType === 'activity') {
      return activity as UnifiedOpportunityItem;
    }

    const a = activity as Record<string, unknown>;
    const status = a.status as ActivityStatus | undefined;
    const isActive = status === ActivityStatus.OPEN || status === ActivityStatus.IN_PROGRESS;

    return {
      id: a.id as string,
      sourceType: 'activity',
      title: a.title as string,
      description: a.description as string | undefined,
      organizationId: a.organizationId as string | undefined,
      organizationName: a.organizationName as string | undefined,
      tags: a.tags as string[] | undefined,
      postedAt: (a.createdAt as Date) ?? new Date(),
      expiresAt: a.scheduledEndDate as Date | undefined,
      isActive,
      activityType: a.activityType as ActivityType | undefined,
      activityStatus: status,
      scheduledStartDate: a.scheduledStartDate as Date | undefined,
      currentParticipants: a.currentParticipants as number | undefined,
      maxParticipants: a.maxParticipants as number | undefined,
      location: a.location as string | undefined,
      difficulty: a.difficulty as string | undefined,
    };
  }

  private async enrichAndFilterByReputation(
    items: UnifiedOpportunityItem[],
    filters: UnifiedOpportunityFilters
  ): Promise<UnifiedOpportunityItem[]> {
    // Collect unique organization IDs to batch-fetch reputation data
    const orgIds = [...new Set(items.map(i => i.organizationId).filter(Boolean))] as string[];

    // Fetch reputation for each org (the "creator" is the org for opportunities)
    const reputationMap = new Map<string, { score: number; tier: string; successRate: number }>();

    await Promise.all(
      orgIds.map(async orgId => {
        try {
          const rep = await this.reputationService.getUnifiedReputation(orgId);
          reputationMap.set(orgId, {
            score: rep.combinedScore,
            tier: rep.userReputation.tier,
            successRate: rep.userReputation.successRate,
          });
        } catch {
          // If reputation fetch fails, store defaults
          reputationMap.set(orgId, { score: 0, tier: 'Unknown', successRate: 0 });
        }
      })
    );

    // Enrich items with reputation data
    const enriched = items.map(item => {
      if (item.organizationId && reputationMap.has(item.organizationId)) {
        const rep = reputationMap.get(item.organizationId)!;
        return {
          ...item,
          creatorReputationScore: rep.score,
          creatorReputationTier: rep.tier,
          creatorSuccessRate: rep.successRate,
        };
      }
      return item;
    });

    // Apply advanced filters
    return enriched.filter(item => {
      if (filters.minReputationScore !== undefined) {
        if ((item.creatorReputationScore ?? 0) < filters.minReputationScore) {
          return false;
        }
      }
      if (filters.reputationTiers && filters.reputationTiers.length > 0) {
        const tier = item.creatorReputationTier ?? '';
        // Match if the tier string contains any of the requested tier names
        if (!filters.reputationTiers.some(t => tier.toLowerCase().includes(t.toLowerCase()))) {
          return false;
        }
      }
      if (filters.minSuccessRate !== undefined) {
        if ((item.creatorSuccessRate ?? 0) < filters.minSuccessRate) {
          return false;
        }
      }
      return true;
    });
  }

  private sortItems(items: UnifiedOpportunityItem[], sortBy: string, sortOrder: string): void {
    const allowedSortFields = ['postedAt', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'postedAt';
    const order = sortOrder === 'ASC' ? 1 : -1;

    items.sort((a, b) => {
      if (safeSortBy === 'title') {
        return order * (a.title ?? '').localeCompare(b.title ?? '');
      }
      // Default: sort by postedAt date
      const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return order * (dateA - dateB);
    });
  }
}

