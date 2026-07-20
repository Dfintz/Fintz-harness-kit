import { apiClient } from '@/services/apiClient';
import { BaseService } from '@/services/baseService';

/**
 * OpportunityService — Sprint 19-G: Unified Opportunity Pool
 *
 * Extends BaseService for consistency with the rest of the codebase.
 */

/**
 * Source type for unified opportunity items
 */
export type OpportunitySourceType = 'all' | 'job' | 'activity';

/**
 * Unified opportunity search filters
 */
export interface OpportunitySearchFilters {
  sourceType?: OpportunitySourceType;
  searchTerm?: string;
  organizationId?: string;
  tags?: string[];

  // Job-specific
  jobTypes?: string[];
  payTypes?: string[];
  listingCategory?: string;
  minPay?: number;
  maxPay?: number;

  // Activity-specific
  activityTypes?: string[];
  activityStatus?: string[];
  hasOpenSlots?: boolean;
  isFeatured?: boolean;
  startDate?: string;
  endDate?: string;

  // Advanced filters (Sprint 23-E)
  minReputationScore?: number;
  reputationTiers?: string[];
  minSuccessRate?: number;
}

/**
 * Unified opportunity item returned from search API
 */
export interface UnifiedOpportunityItem {
  id: string;
  sourceType: 'job' | 'activity';
  title: string;
  description?: string;
  organizationId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  tags?: string[];
  postedAt?: string;
  expiresAt?: string;
  isActive?: boolean;

  // Job-specific
  jobType?: string;
  payDisplay?: string;
  payMin?: number;
  payMax?: number;
  experienceLevel?: string;
  listingCategory?: string;
  crewSpotsTotal?: number;
  crewSpotsFilled?: number;
  shipCrewBreakdown?: Array<{
    shipName: string;
    crewCapacity: number;
    roles: Array<{
      role: string;
      total: number;
      filled: number;
      assignedUserName?: string | null;
    }>;
    isLoaner?: boolean;
    contributedByUserName?: string | null;
    parentShipIndex?: number;
    isTransported?: boolean;
    transportType?: 'hangar' | 'cargo';
    passengers?: Array<{
      role: string;
      capacity: number;
      filled: number;
      assignedUserNames?: string[];
    }>;
  }>;
  requiredShips?: string[];
  shipRequirementType?: string;
  ownerType?: string;
  allianceName?: string;
  focus?: string;

  // Activity-specific
  activityType?: string;
  activityStatus?: string;
  scheduledStartDate?: string;
  currentParticipants?: number;
  maxParticipants?: number;
  location?: string;
  difficulty?: string;

  // Reputation enrichment (Sprint 23-E)
  creatorReputationScore?: number;
  creatorReputationTier?: string;
  creatorSuccessRate?: number;
}

export interface OpportunitySearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface OpportunitySearchResponse {
  data: UnifiedOpportunityItem[];
  pagination: OpportunitySearchPagination;
}

/** String filter keys that map directly to params */
const STRING_FILTER_KEYS: ReadonlyArray<keyof OpportunitySearchFilters> = [
  'searchTerm',
  'organizationId',
  'listingCategory',
  'startDate',
  'endDate',
];

/** Array filter keys that get joined with commas */
const ARRAY_FILTER_KEYS: ReadonlyArray<keyof OpportunitySearchFilters> = [
  'tags',
  'jobTypes',
  'payTypes',
  'activityTypes',
  'activityStatus',
  'reputationTiers',
];

/** Boolean/number filter keys that get stringified */
const STRINGIFY_FILTER_KEYS: ReadonlyArray<keyof OpportunitySearchFilters> = [
  'minPay',
  'maxPay',
  'hasOpenSlots',
  'isFeatured',
  'minReputationScore',
  'minSuccessRate',
];

function buildFilterParams(filters: OpportunitySearchFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.sourceType && filters.sourceType !== 'all') {
    params.sourceType = filters.sourceType;
  }

  for (const key of STRING_FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      params[key] = String(value);
    }
  }

  for (const key of ARRAY_FILTER_KEYS) {
    const value = filters[key] as string[] | undefined;
    if (value && value.length > 0) {
      params[key] = value.join(',');
    }
  }

  for (const key of STRINGIFY_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) {
      params[key] = String(value);
    }
  }

  return params;
}

/**
 * Search opportunities across jobs and activities
 */
class OpportunityService extends BaseService {
  protected basePath = '/api/v2/search/opportunities';

  async search(
    filters: OpportunitySearchFilters = {},
    page = 1,
    limit = 20,
    sortBy = 'postedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<OpportunitySearchResponse> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
      ...buildFilterParams(filters),
    };

    try {
      this.log('search', { filters, page, limit, sortBy, sortOrder });
      // apiClient.get() returns the response body directly (already unwrapped from Axios).
      // The backend sends { data: [...], pagination: {...} } without an ApiResponse envelope,
      // so we treat the full response as OpportunitySearchResponse.
      const body = await apiClient.get(this.basePath, { params }) as unknown as OpportunitySearchResponse;
      return {
        data: Array.isArray(body.data) ? body.data : [],
        pagination: body.pagination ?? { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    } catch (error) {
      this.handleError(error, 'search');
    }
  }
}

const opportunityService = new OpportunityService();

/**
 * Convenience function wrapping the service instance.
 * Preserves backward-compatible function signature used by the React Query hook.
 */
export async function searchOpportunities(
  filters: OpportunitySearchFilters = {},
  page = 1,
  limit = 20,
  sortBy = 'postedAt',
  sortOrder: 'ASC' | 'DESC' = 'DESC'
): Promise<OpportunitySearchResponse> {
  return opportunityService.search(filters, page, limit, sortBy, sortOrder);
}
