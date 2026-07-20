import {
  Assignment,
  Build,
  Chat,
  Construction,
  Explore,
  Feedback,
  FlightTakeoff,
  GpsFixed,
  Groups,
  Handshake,
  HelpOutline,
  LocalHospital,
  LocalShipping,
  PersonAdd,
  Shield,
  Star,
  Work,
} from '@mui/icons-material';
import { isAxiosError } from 'axios';
import React from 'react';

import { API_URL } from '@/config/env';
import { apiClient as authClient, isApiClientError } from '@/services/apiClient';
// Build v2 API base path. In dev, API_URL is '' (Vite proxy). In prod, full origin.
const API_V2_BASE_URL = `${API_URL}/api/v2`;

// Use the underlying axios instance from apiClient for public directory calls.
// This preserves CSRF, retry, and cookie handling while keeping standard AxiosResponse shape
// (response.data = JSON body) which the existing response.data.data access pattern relies on.
const axiosClient = authClient.getAxiosInstance();

/**
 * Primary focus areas for organizations
 */
export type OrgPrimaryFocus =
  | 'combat'
  | 'mining'
  | 'trading'
  | 'exploration'
  | 'bounty_hunting'
  | 'medical'
  | 'transport'
  | 'salvage'
  | 'security'
  | 'social'
  | 'piracy'
  | 'racing'
  | 'mixed';

/**
 * Activity level classifications
 */
export type ActivityLevel = 'inactive' | 'low' | 'moderate' | 'high' | 'very_high';

/**
 * Public organization list item from directory
 */
export interface PublicOrgListItem {
  id: string;
  organizationId: string;
  organizationName: string;
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
  useDiscordForApplications?: boolean;
  /** RSI archetype (e.g. "Organization", "Corporation", "PMC") */
  rsiArchetype?: string;
  /** RSI commitment level (e.g. "Casual", "Regular", "Hardcore") */
  rsiCommitment?: string;
  /** RSI roleplay preference */
  rsiRolePlay?: boolean;
  /** RSI exclusive membership */
  rsiExclusive?: boolean;
  scstatsVisibility?: {
    showVerification?: boolean;
    showSkills?: boolean;
    showTimezone?: boolean;
    showAnalytics?: boolean;
  } | null;
  skillDistribution?: Record<string, { low: number; medium: number; high: number; expert: number }>;
}

/**
 * Full public profile entity (for editing)
 */
export interface PublicOrgProfile extends PublicOrgListItem {
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter options for directory search
 * Phase 2: Enhanced with multi-select filters
 */
export interface DirectoryFilters {
  /** Legacy single value (backward compatible) */
  primaryFocus?: OrgPrimaryFocus;
  /** Multi-select primary focus - Phase 2 */
  primaryFocuses?: OrgPrimaryFocus[];
  /** Legacy single value (backward compatible) */
  activityLevel?: ActivityLevel;
  /** Multi-select activity levels - Phase 2 */
  activityLevels?: ActivityLevel[];
  isRecruiting?: boolean;
  isVerified?: boolean;
  minMemberCount?: number;
  maxMemberCount?: number;
  languages?: string[];
  timezone?: string;
  search?: string;
}

/**
 * Pagination options
 * Phase 2: Enhanced with explicit sort fields
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?:
    | 'memberCount'
    | 'createdAt'
    | 'updatedAt'
    | 'activityLevel'
    | 'name'
    | 'postedAt'
    | 'title'
    | 'jobType';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Pagination info from API response
 */
export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * Directory statistics
 */
export interface DirectoryStats {
  totalOrganizations: number;
  recruitingOrganizations: number;
  verifiedOrganizations: number;
  byFocus: Record<string, number>;
}

/**
 * Filter options available from API
 */
export interface FilterOptions {
  focusOptions: OrgPrimaryFocus[];
  activityLevelOptions: ActivityLevel[];
}

/**
 * Profile update input
 */
export interface ProfileUpdateInput {
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
}

/**
 * Build URL search params from directory filters and pagination options.
 * Extracted to reduce cognitive complexity.
 */
function buildDirectoryParams(
  filters?: DirectoryFilters,
  pagination?: PaginationOptions
): URLSearchParams {
  const params = new URLSearchParams();

  // Multi-select primary focus (Phase 2) takes priority
  if (filters?.primaryFocuses && filters.primaryFocuses.length > 0) {
    params.append('primaryFocuses', filters.primaryFocuses.join(','));
  } else if (filters?.primaryFocus) {
    params.append('primaryFocus', filters.primaryFocus);
  }
  // Multi-select activity levels (Phase 2) takes priority
  if (filters?.activityLevels && filters.activityLevels.length > 0) {
    params.append('activityLevels', filters.activityLevels.join(','));
  } else if (filters?.activityLevel) {
    params.append('activityLevel', filters.activityLevel);
  }
  if (filters?.isRecruiting !== undefined) {
    params.append('isRecruiting', String(filters.isRecruiting));
  }
  if (filters?.isVerified !== undefined) {
    params.append('isVerified', String(filters.isVerified));
  }
  if (filters?.minMemberCount !== undefined) {
    params.append('minMemberCount', String(filters.minMemberCount));
  }
  if (filters?.maxMemberCount !== undefined) {
    params.append('maxMemberCount', String(filters.maxMemberCount));
  }
  if (filters?.languages && filters.languages.length > 0) {
    params.append('languages', filters.languages.join(','));
  }
  if (filters?.timezone) {
    params.append('timezone', filters.timezone);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }

  appendPaginationParams(params, pagination);
  return params;
}

/**
 * Append pagination params to URLSearchParams.
 */
function appendPaginationParams(params: URLSearchParams, pagination?: PaginationOptions): void {
  if (pagination?.page) {
    params.append('page', String(pagination.page));
  }
  if (pagination?.limit) {
    params.append('limit', String(pagination.limit));
  }
  if (pagination?.sortBy) {
    params.append('sortBy', pagination.sortBy);
  }
  if (pagination?.sortOrder) {
    params.append('sortOrder', pagination.sortOrder);
  }
}

/**
 * Public Directory Service
 *
 * Provides methods for browsing the public organization directory
 * and managing organization public profiles.
 * Phase 2: Enhanced with multi-select filters and advanced search
 */
export const publicDirectoryService = {
  /**
   * Get public organization directory with filtering
   * Phase 2: Supports multi-select filters
   * No authentication required
   */
  async getDirectory(
    filters?: DirectoryFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicOrgListItem>> {
    const params = buildDirectoryParams(filters, pagination);

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    // Use v2 public directory endpoint (unauthenticated)
    const url = `${API_V2_BASE_URL}/directory/organizations${suffix}`;

    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.meta?.pagination ?? response.data.pagination,
    };
  },

  /**
   * Get a specific public organization profile
   * No authentication required
   */
  async getPublicProfile(organizationId: string): Promise<PublicOrgProfile | null> {
    try {
      // Use v2 public organization profile endpoint (unauthenticated)
      const response = await axiosClient.get(
        `${API_V2_BASE_URL}/directory/organizations/${organizationId}`
      );
      return response.data.data;
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get public federations that the organization belongs to
   * No authentication required
   */
  async getOrgFederations(organizationId: string): Promise<OrgFederationMembership[]> {
    try {
      const response = await axiosClient.get(
        `${API_V2_BASE_URL}/directory/organizations/${organizationId}/federations`
      );
      const data = response.data?.data;
      return Array.isArray(data) ? data : [];
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  /**
   * Get directory statistics
   * No authentication required
   */
  async getDirectoryStats(): Promise<DirectoryStats> {
    // Use v2 directory stats endpoint (unauthenticated)
    const response = await axiosClient.get(`${API_V2_BASE_URL}/directory/organizations/stats`);
    return response.data.data;
  },

  /**
   * Get available filter options
   * No authentication required
   */
  async getFilterOptions(): Promise<FilterOptions> {
    // v2 does not expose filter options endpoint; return static options client-side
    const focusOptions: OrgPrimaryFocus[] = [
      'combat',
      'mining',
      'trading',
      'exploration',
      'bounty_hunting',
      'medical',
      'transport',
      'salvage',
      'security',
      'social',
      'piracy',
      'racing',
      'mixed',
    ];
    const activityLevelOptions: ActivityLevel[] = [
      'inactive',
      'low',
      'moderate',
      'high',
      'very_high',
    ];
    return { focusOptions, activityLevelOptions };
  },

  /**
   * Get own organization's public profile (for editing)
   * Requires authentication
   */
  async getOwnProfile(organizationId: string): Promise<PublicOrgProfile> {
    const response = await axiosClient.get(`/api/organizations/${organizationId}/public-profile`);
    return response.data.data;
  },

  /**
   * Update organization's public profile
   * Requires authentication
   */
  async updateProfile(organizationId: string, data: ProfileUpdateInput): Promise<PublicOrgProfile> {
    const response = await axiosClient.patch(
      `/api/organizations/${organizationId}/public-profile`,
      data
    );
    return response.data.data;
  },

  /**
   * Enable/disable public visibility
   * Requires authentication
   */
  async setPublicVisibility(organizationId: string, isPublic: boolean): Promise<PublicOrgProfile> {
    return this.updateProfile(organizationId, { isPublic });
  },

  /**
   * Sync profile from RSI organization page
   * Pulls logo, banner, description, focus, and social links from RSI
   */
  async syncFromRsi(organizationId: string, rsiSid: string): Promise<PublicOrgProfile> {
    const response = await axiosClient.post(
      `/api/organizations/${organizationId}/public-profile/sync-rsi`,
      { rsiSid }
    );
    return response.data.data;
  },

  /**
   * Set recruiting status
   * Requires authentication
   */
  async setRecruitingStatus(
    organizationId: string,
    isRecruiting: boolean
  ): Promise<PublicOrgProfile> {
    return this.updateProfile(organizationId, { isRecruiting });
  },

  /**
   * Alias for getDirectory for backward compatibility
   * @deprecated Use getDirectory instead
   */
  async listOrganizations(
    filters?: DirectoryFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicOrgListItem>> {
    return this.getDirectory(filters, pagination);
  },

  /**
   * Create or update organization profile (alias for updateProfile)
   * @deprecated Use updateProfile instead
   */
  async createOrUpdateProfile(
    data: ProfileUpdateInput & { organizationId: string; organizationName: string }
  ): Promise<PublicOrgProfile> {
    const { organizationId, organizationName: _organizationName, ...profileData } = data;
    return this.updateProfile(organizationId, profileData);
  },
};

/**
 * Helper function to get activity level display label
 */
export function getActivityLevelLabel(level: ActivityLevel): string {
  const labels: Record<ActivityLevel, string> = {
    inactive: 'Inactive',
    low: 'Low Activity',
    moderate: 'Moderate Activity',
    high: 'High Activity',
    very_high: 'Very High Activity',
  };
  return labels[level] || level;
}

/**
 * Helper function to get focus display label
 */
export function getFocusLabel(focus: OrgPrimaryFocus): string {
  const labels: Record<OrgPrimaryFocus, string> = {
    combat: 'Combat',
    mining: 'Mining',
    trading: 'Trading',
    exploration: 'Exploration',
    bounty_hunting: 'Bounty Hunting',
    medical: 'Medical',
    transport: 'Transport',
    salvage: 'Salvage',
    security: 'Security',
    social: 'Social',
    piracy: 'Piracy',
    racing: 'Racing',
    mixed: 'Mixed Focus',
  };
  return labels[focus] || focus;
}

export { getFederationRoleIcon, getFocusIcon } from '@/utils/publicDirectoryIcons';

// ==================== ORG FEDERATION MEMBERSHIP ====================

/**
 * Lightweight federation item shown on org profile pages.
 */
export interface OrgFederationMembership {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  role: string;
  tags: string[];
  logoUrl?: string | null;
}

// ==================== FEDERATION TYPES AND SERVICE ====================

/**
 * Federation role type
 */
export type FederationRole = 'founder' | 'leader' | 'council' | 'member' | 'observer';

/**
 * Public federation list item
 */
export interface PublicFederationListItem {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  memberOrganizations: Array<{
    organizationId: string;
    organizationName: string;
    role: FederationRole;
    isPublic?: boolean;
  }>;
  tags: string[];
  createdAt: string;
  sharedResourceTypes: string[];
  treatyCount: number;
  logoUrl?: string;
  bannerUrl?: string;
  discordUrl?: string;
  websiteUrl?: string;
  rsiUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  isVerified?: boolean;
}

/**
 * Federation filter options
 */
export interface FederationFilters {
  name?: string;
  tags?: string[];
  minMembers?: number;
  maxMembers?: number;
}

/**
 * Federation statistics
 */
export interface FederationStats {
  totalFederations: number;
  totalMemberOrganizations: number;
  averageMembersPerFederation: number;
  byTag: Record<string, number>;
}

/**
 * Public Federation Directory Service
 */
export const publicFederationService = {
  /**
   * Get public federations directory with filtering
   * No authentication required
   */
  async getFederations(
    filters?: FederationFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicFederationListItem>> {
    const params = new URLSearchParams();

    if (filters?.name) {
      params.append('name', filters.name);
    }
    if (filters?.tags && filters.tags.length > 0) {
      params.append('tags', filters.tags.join(','));
    }
    if (filters?.minMembers !== undefined) {
      params.append('minMembers', String(filters.minMembers));
    }
    if (filters?.maxMembers !== undefined) {
      params.append('maxMembers', String(filters.maxMembers));
    }

    appendPaginationParams(params, pagination);

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    // Use v2 public federations endpoint (unauthenticated)
    const url = `${API_V2_BASE_URL}/directory/federations${suffix}`;

    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.meta?.pagination ?? response.data.pagination,
    };
  },

  /**
   * Get a specific public federation
   * No authentication required
   */
  async getFederation(federationId: string): Promise<PublicFederationListItem | null> {
    try {
      // Use v2 public federation endpoint (unauthenticated)
      const response = await axiosClient.get(
        `${API_V2_BASE_URL}/directory/federations/${federationId}`
      );
      return response.data.data;
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get federation statistics
   * No authentication required
   */
  async getFederationStats(): Promise<FederationStats> {
    // Use v2 federation stats endpoint (unauthenticated)
    const response = await axiosClient.get(`${API_V2_BASE_URL}/directory/federations/stats`);
    return response.data.data;
  },

  /**
   * Create a new federation/alliance
   * Requires authentication
   */
  async createFederation(data: {
    name: string;
    description: string;
    isPublic?: boolean;
    tags?: string[];
    logoUrl?: string;
    bannerUrl?: string;
    discordUrl?: string;
    websiteUrl?: string;
  }): Promise<{ id: string; name: string }> {
    const response = await axiosClient.post(`/api/v2/federations`, data);
    // Handle both raw response and envelope: { data: {...} } or just {...}
    const body = response.data;
    return (body?.data ?? body) as { id: string; name: string };
  },
};

/**
 * Helper function to get federation role display label
 */
export function getFederationRoleLabel(role: FederationRole): string {
  const labels: Record<FederationRole, string> = {
    founder: 'Founder',
    leader: 'Leader',
    council: 'Council',
    member: 'Member',
    observer: 'Observer',
  };
  return labels[role] || role;
}

// ==================== JOB LISTING TYPES AND SERVICE ====================

/**
 * Job types for public listings
 */
export type JobType =
  | 'crew'
  | 'pilot'
  | 'gunner'
  | 'engineer'
  | 'medic'
  | 'miner'
  | 'hauler'
  | 'scout'
  | 'security'
  | 'leadership'
  | 'support'
  | 'other';

/**
 * Pay types for job compensation
 */
export type PayType = 'fixed' | 'hourly' | 'percentage' | 'negotiable' | 'volunteer';

/**
 * Listing owner types - supports both organizations and alliances
 */
export type ListingOwnerType = 'organization' | 'alliance' | 'user';

/**
 * Listing category - distinguishes job postings from service offerings
 *
 * - 'job': The poster is looking to hire/recruit (e.g., "Looking for Crew")
 * - 'service': The poster is offering their services (e.g., "Ship Engineer for Hire")
 */
export type ListingCategory = 'job' | 'service';

/**
 * Public job listing item
 */
/**
 * Per-ship crew role slot
 */
export interface ShipCrewRole {
  role: string;
  total: number;
  filled: number;
  /** User ID of the person assigned to this role (null if open) */
  assignedUserId?: string | null;
  /** Display name of the assigned user (null if open) */
  assignedUserName?: string | null;
}

/**
 * Passenger slot for vehicles that transport non-crew personnel (e.g., marines in an APC).
 * Passengers are NOT counted toward crew totals.
 */
export interface PassengerSlot {
  role: string;
  capacity: number;
  filled: number;
  assignedUserNames?: string[];
}

/**
 * Per-ship crew breakdown entry.
 * Supports nested transport: ships/vehicles carried inside a parent ship.
 */
export interface ShipCrewBreakdownEntry {
  shipName: string;
  crewCapacity: number;
  roles: ShipCrewRole[];
  /** Whether this ship is a loaner (contributed but not crewed by the contributor) */
  isLoaner?: boolean;
  /** User ID of the person who contributed/provided this ship */
  contributedByUserId?: string | null;
  /** Display name of the ship contributor */
  contributedByUserName?: string | null;
  /** Index of the parent ship in the breakdown array (undefined = top-level ship) */
  parentShipIndex?: number;
  /** Whether this entry is a transported vehicle/ship nested inside a parent */
  isTransported?: boolean;
  /** Transport type: 'hangar' (ship in hangar) or 'cargo' (vehicle in cargo bay) */
  transportType?: 'hangar' | 'cargo';
  /** Non-crew passengers (e.g., marines in an APC) — NOT counted toward crew totals */
  passengers?: PassengerSlot[];
  /** Cargo capacity in SCU (enriched from ship catalog) */
  cargo?: number;
  /** Quantum fuel capacity (enriched from ship catalog) */
  quantumFuelCapacity?: number;
}

export interface PublicJobListItem {
  id: string;
  organizationId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  allianceId?: string;
  allianceName?: string;
  ownerType: ListingOwnerType;
  listingCategory: ListingCategory;
  title: string;
  description?: string;
  jobType: JobType;
  focus: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  payDisplay: string;
  experienceLevel: number;
  isActive: boolean;
  postedAt: string;
  expiresAt?: string;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
  crewSpotsTotal?: number;
  crewSpotsFilled?: number;
  requiredShips?: string[];
  shipRequirementType?: 'none' | 'required' | 'preferred';
  shipCrewBreakdown?: ShipCrewBreakdownEntry[];
  approvedVehicles?: ApprovedVehicleEntry[];
  createdBy?: string;
  /** Total SCU across all ships in the breakdown */
  totalScu?: number;
  /** Average quantum fuel capacity across all ships */
  averageQuantumFuel?: number;
}

/**
 * Vehicle approved for a job listing
 */
export interface ApprovedVehicleEntry {
  vehicleName: string;
  applicantUserId: string;
  applicantDisplayName: string;
  applicationId: string;
  approvedAt: string;
}

/**
 * Job listing filter options
 */
export interface JobListingFilters {
  organizationId?: string;
  allianceId?: string;
  ownerType?: ListingOwnerType;
  listingCategory?: ListingCategory;
  jobTypes?: JobType[];
  focuses?: OrgPrimaryFocus[];
  payTypes?: PayType[];
  minPay?: number;
  maxPay?: number;
  maxExperienceLevel?: number;
  search?: string;
  isActive?: boolean;
  includeExpired?: boolean;
}

/**
 * Job listing statistics
 */
export interface JobListingStats {
  totalListings: number;
  activeListings: number;
  organizationListings: number;
  allianceListings: number;
  userListings: number;
  jobListings: number;
  serviceListings: number;
  byJobType: Record<string, number>;
  byFocus: Record<string, number>;
}

/**
 * Job filter options from API
 */
export interface JobFilterOptions {
  jobTypeOptions: JobType[];
  payTypeOptions: PayType[];
  focusOptions: OrgPrimaryFocus[];
  ownerTypeOptions: ListingOwnerType[];
}

/**
 * Input for creating a job listing
 */
export interface CreateJobListingInput {
  listingCategory?: ListingCategory;
  title: string;
  description?: string;
  jobType: JobType;
  focus: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  experienceLevel?: number;
  expiresAt?: string;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
  // Ship & crew fields
  shipRequirementType?: 'none' | 'required' | 'preferred';
  requiredShips?: Array<{
    requirementType: 'specific' | 'role';
    shipName?: string;
    shipId?: string;
    role?: string;
    count: number;
    crewPerShip?: number;
    avgCrewPerShip?: number;
  }>;
  crewSpotsTotal?: number;
}

/**
 * Input for updating a job listing
 */
export interface UpdateJobListingInput {
  listingCategory?: ListingCategory;
  title?: string;
  description?: string;
  jobType?: JobType;
  focus?: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  experienceLevel?: number;
  isActive?: boolean;
  expiresAt?: string;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
}

/**
 * Build URL search params from job listing filters and pagination options.
 * Extracted to reduce cognitive complexity.
 */
function appendJobFilters(params: URLSearchParams, filters: JobListingFilters): void {
  const stringFields: (keyof JobListingFilters)[] = [
    'organizationId',
    'allianceId',
    'ownerType',
    'listingCategory',
    'search',
  ];
  for (const key of stringFields) {
    const val = filters[key];
    if (val) params.append(key, val as string);
  }
  const arrayFields: (keyof Pick<JobListingFilters, 'jobTypes' | 'focuses' | 'payTypes'>)[] = [
    'jobTypes',
    'focuses',
    'payTypes',
  ];
  for (const key of arrayFields) {
    const arr = filters[key];
    if (arr && arr.length > 0) params.append(key, arr.join(','));
  }
  const numericFields: (keyof Pick<
    JobListingFilters,
    'minPay' | 'maxPay' | 'maxExperienceLevel'
  >)[] = ['minPay', 'maxPay', 'maxExperienceLevel'];
  for (const key of numericFields) {
    if (filters[key] !== undefined) params.append(key, String(filters[key]));
  }
  const boolFields: (keyof Pick<JobListingFilters, 'isActive' | 'includeExpired'>)[] = [
    'isActive',
    'includeExpired',
  ];
  for (const key of boolFields) {
    if (filters[key] !== undefined) params.append(key, String(filters[key]));
  }
}

function buildJobListingParams(
  filters?: JobListingFilters,
  pagination?: PaginationOptions
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters) appendJobFilters(params, filters);
  appendPaginationParams(params, pagination);
  return params;
}

/**
 * Public Job Listing Service
 * Phase 3: Public Job Listings feature
 */
export const publicJobListingService = {
  /**
   * Get public job listings with filtering
   * No authentication required
   */
  async getJobListings(
    filters?: JobListingFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicJobListItem>> {
    const params = buildJobListingParams(filters, pagination);

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const url = `${API_V2_BASE_URL}/directory/jobs${suffix}`;

    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.meta?.pagination ?? response.data.pagination,
    };
  },

  /**
   * Get a specific job listing
   * No authentication required
   */
  async getJobListing(jobId: string): Promise<PublicJobListItem | null> {
    try {
      const response = await axiosClient.get(`${API_V2_BASE_URL}/directory/jobs/${jobId}`);
      return response.data.data;
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get job listing statistics
   * No authentication required
   */
  async getJobListingStats(): Promise<JobListingStats> {
    const response = await axiosClient.get(`${API_V2_BASE_URL}/directory/jobs/stats`);
    return response.data.data;
  },

  /**
   * Get job filter options
   * No authentication required
   */
  async getJobFilterOptions(): Promise<JobFilterOptions> {
    const response = await axiosClient.get(`${API_V2_BASE_URL}/directory/jobs/options`);
    return response.data.data;
  },

  /**
   * Get job count for an organization
   * No authentication required
   */
  async getOrganizationJobCount(organizationId: string): Promise<number> {
    const response = await axiosClient.get(
      `${API_V2_BASE_URL}/directory/${organizationId}/jobs/count`
    );
    return response.data.data.count;
  },

  /**
   * Get job count for an alliance
   * No authentication required
   */
  async getAllianceJobCount(allianceId: string): Promise<number> {
    const response = await axiosClient.get(
      `${API_V2_BASE_URL}/directory/federations/${allianceId}/jobs/count`
    );
    return response.data.data.count;
  },

  /**
   * Create a job listing for an individual user (no org required)
   * Requires authentication
   */
  async createUserJob(data: CreateJobListingInput): Promise<PublicJobListItem> {
    const response = await axiosClient.post(`${API_V2_BASE_URL}/jobs`, data);
    return response.data.data;
  },

  /**
   * Create a job listing for an organization
   * Requires authentication
   */
  async createOrganizationJob(
    organizationId: string,
    data: CreateJobListingInput
  ): Promise<PublicJobListItem> {
    const response = await axiosClient.post(
      `${API_V2_BASE_URL}/organizations/${organizationId}/jobs`,
      data
    );
    return response.data.data;
  },

  /**
   * Create a job listing for an alliance
   * Requires authentication
   */
  async createAllianceJob(
    allianceId: string,
    data: CreateJobListingInput
  ): Promise<PublicJobListItem> {
    const response = await axiosClient.post(
      `${API_V2_BASE_URL}/federations/${allianceId}/jobs`,
      data
    );
    return response.data.data;
  },

  /**
   * Update a job listing
   * Requires authentication
   */
  async updateJobListing(jobId: string, data: UpdateJobListingInput): Promise<PublicJobListItem> {
    const response = await axiosClient.patch(`${API_V2_BASE_URL}/jobs/${jobId}`, data);
    return response.data.data;
  },

  /**
   * Delete a job listing
   * Requires authentication
   */
  async deleteJobListing(jobId: string): Promise<void> {
    await axiosClient.delete(`${API_V2_BASE_URL}/jobs/${jobId}`);
  },

  /**
   * Cancel (deactivate) a job listing
   * Requires authentication
   */
  async cancelJobListing(jobId: string): Promise<void> {
    await axiosClient.post(`${API_V2_BASE_URL}/jobs/${jobId}/cancel`);
  },
};

// ── Job Application Types ───────────────────────────────────────

export type JobApplicationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'withdrawn';
export type JobApplicationType = 'crew' | 'passenger' | 'vehicle' | 'general';

export interface JobApplicationItem {
  id: string;
  jobListingId: string;
  applicantUserId: string;
  applicantDisplayName: string;
  applicationType: JobApplicationType;
  status: JobApplicationStatus;
  message?: string;
  shipIndex?: number;
  roleIndex?: number;
  roleName?: string;
  shipName?: string;
  passengerShipIndex?: number;
  passengerRole?: string;
  vehicleName?: string;
  formResponses?: Record<string, string>;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  waitlistPosition?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyToJobInput {
  applicationType: JobApplicationType;
  message?: string;
  shipIndex?: number;
  roleIndex?: number;
  passengerShipIndex?: number;
  passengerRole?: string;
  vehicleName?: string;
  formResponses?: Record<string, string>;
}

export interface ReviewApplicationInput {
  status: 'approved' | 'rejected' | 'waitlisted';
  reviewNote?: string;
}

// ── Job Application Service ─────────────────────────────────────

export const jobApplicationService = {
  /** Apply to a job listing (authenticated) */
  async applyToJob(jobId: string, data: ApplyToJobInput): Promise<JobApplicationItem> {
    const response = await authClient.post<JobApplicationItem>(`/api/v2/jobs/${jobId}/apply`, data);
    return response.data;
  },

  /** Get current user's application for a specific listing */
  async getMyApplication(jobId: string): Promise<JobApplicationItem | null> {
    try {
      const response = await authClient.get<JobApplicationItem>(
        `/api/v2/jobs/${jobId}/applications/my`
      );
      return response.data ?? null;
    } catch (error: unknown) {
      if (isApiClientError(error) && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  /** Get all of the current user's applications */
  async getMyApplications(): Promise<JobApplicationItem[]> {
    const response = await authClient.get<JobApplicationItem[]>('/api/v2/jobs/my-applications');
    return response.data;
  },

  /** Get all applications for a listing (owner/admin) */
  async getApplicationsForJob(
    jobId: string,
    status?: JobApplicationStatus
  ): Promise<JobApplicationItem[]> {
    const params = status ? `?status=${status}` : '';
    const response = await authClient.get<JobApplicationItem[]>(
      `/api/v2/jobs/${jobId}/applications${params}`
    );
    return response.data;
  },

  /** Review an application (approve/reject/waitlist) */
  async reviewApplication(
    jobId: string,
    applicationId: string,
    data: ReviewApplicationInput
  ): Promise<JobApplicationItem> {
    const response = await authClient.patch<JobApplicationItem>(
      `/api/v2/jobs/${jobId}/applications/${applicationId}/review`,
      data
    );
    return response.data;
  },

  /** Withdraw own application */
  async withdrawApplication(jobId: string, applicationId: string): Promise<JobApplicationItem> {
    const response = await authClient.post<JobApplicationItem>(
      `/api/v2/jobs/${jobId}/applications/${applicationId}/withdraw`
    );
    return response.data;
  },

  /** Get waitlist for a listing (owner/admin) */
  async getWaitlist(jobId: string): Promise<JobApplicationItem[]> {
    const response = await authClient.get<JobApplicationItem[]>(`/api/v2/jobs/${jobId}/waitlist`);
    return response.data;
  },
};

/**
 * Helper function to get job type display label
 */
export function getJobTypeLabel(type: JobType): string {
  const labels: Record<JobType, string> = {
    crew: 'Crew',
    pilot: 'Pilot',
    gunner: 'Gunner',
    engineer: 'Engineer',
    medic: 'Medic',
    miner: 'Miner',
    hauler: 'Hauler',
    scout: 'Scout',
    security: 'Security',
    leadership: 'Leadership',
    support: 'Support',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Helper function to get job type icon
 */
export function getJobTypeIcon(type: JobType): React.ReactNode {
  const icons: Record<JobType, React.ReactNode> = {
    crew: <Groups fontSize="small" />,
    pilot: <FlightTakeoff fontSize="small" />,
    gunner: <GpsFixed fontSize="small" />,
    engineer: <Build fontSize="small" />,
    medic: <LocalHospital fontSize="small" />,
    miner: <Construction fontSize="small" />,
    hauler: <LocalShipping fontSize="small" />,
    scout: <Explore fontSize="small" />,
    security: <Shield fontSize="small" />,
    leadership: <Star fontSize="small" />,
    support: <Handshake fontSize="small" />,
    other: <Assignment fontSize="small" />,
  };
  return icons[type] || <Assignment fontSize="small" />;
}

/**
 * Helper function to get pay type display label
 */
export function getPayTypeLabel(type: PayType): string {
  const labels: Record<PayType, string> = {
    fixed: 'Fixed Pay',
    hourly: 'Hourly Rate',
    percentage: 'Percentage Split',
    negotiable: 'Negotiable',
    volunteer: 'Volunteer',
  };
  return labels[type] || type;
}

/**
 * Helper function to get experience level label
 */
export function getExperienceLevelLabel(level: number): string {
  if (level === 0) return 'No Experience Required';
  if (level <= 2) return 'Beginner';
  if (level <= 4) return 'Intermediate';
  if (level <= 6) return 'Advanced';
  if (level <= 8) return 'Expert';
  return 'Elite';
}

/**
 * Helper function to get listing category display label
 */
export function getListingCategoryLabel(category: ListingCategory): string {
  const labels: Record<ListingCategory, string> = {
    job: 'Job',
    service: 'Offering Service',
  };
  return labels[category] || category;
}

/**
 * Helper function to get listing category icon
 */
export function getListingCategoryIcon(category: ListingCategory): React.ReactNode {
  const icons: Record<ListingCategory, React.ReactNode> = {
    job: <Work fontSize="small" />,
    service: <Build fontSize="small" />,
  };
  return icons[category] || <Assignment fontSize="small" />;
}

// ==================== CONTACT REQUEST TYPES AND SERVICE ====================

/**
 * Contact request status
 */
export type ContactRequestStatus = 'pending' | 'read' | 'replied' | 'archived' | 'spam';

/**
 * Contact target type - organization or alliance
 */
export type ContactTargetType = 'organization' | 'alliance';

/**
 * Contact type options
 */
export type ContactType =
  | 'general'
  | 'recruitment'
  | 'partnership'
  | 'question'
  | 'feedback'
  | 'other';

/**
 * Contact request list item
 */
export interface ContactRequestListItem {
  id: string;
  targetType: ContactTargetType;
  organizationId?: string;
  organizationName?: string;
  allianceId?: string;
  allianceName?: string;
  senderName: string;
  senderEmail?: string;
  senderUserId?: string;
  rsiHandle?: string;
  discordUsername?: string;
  subject: string;
  message: string;
  contactType: ContactType;
  status: ContactRequestStatus;
  internalNotes?: string;
  handledBy?: string;
  handledAt?: string;
  replyCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for submitting a contact request
 */
export interface SubmitContactRequestInput {
  targetType: ContactTargetType;
  organizationId?: string;
  allianceId?: string;
  senderName: string;
  senderEmail?: string;
  rsiHandle?: string;
  discordUsername?: string;
  subject: string;
  message: string;
  contactType?: ContactType;
  /** Role-based visibility for who in the org can see this message */
  visibility?: MessageVisibility;
  /** Custom role names (only when visibility = 'custom') */
  visibleToRoles?: string[];
}

/**
 * Message visibility levels for role-based access control
 */
export enum MessageVisibility {
  ALL = 'all',
  LEADERSHIP = 'leadership',
  HR = 'hr',
  DIPLOMACY = 'diplomacy',
  RECRUITMENT = 'recruitment',
  CUSTOM = 'custom',
}

/**
 * Contact request reply item
 */
export interface ContactRequestReplyItem {
  id: string;
  contactRequestId: string;
  senderUserId: string;
  senderUsername?: string;
  senderAvatar?: string;
  message: string;
  isOrgReply: boolean;
  createdAt: string;
}

/**
 * Inbox message detail (contact request with replies)
 */
export interface InboxMessageDetail extends ContactRequestListItem {
  replies: ContactRequestReplyItem[];
}

/**
 * Input for updating a contact request
 */
export interface UpdateContactRequestInput {
  status?: ContactRequestStatus;
  internalNotes?: string;
}

/**
 * Contact request statistics
 */
export interface ContactRequestStats {
  total: number;
  pending: number;
  read: number;
  replied: number;
  archived: number;
  spam: number;
  lastWeek: number;
}

/**
 * Contact form options from API
 */
export interface ContactFormOptions {
  contactTypes: ContactType[];
  targetTypes: ContactTargetType[];
}

/**
 * Contact request filter options
 */
export interface ContactRequestFilters {
  status?: ContactRequestStatus;
  statuses?: ContactRequestStatus[];
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Contact Request Service
 * Phase 4: Contact System for Organizations and Alliances
 */
export const contactRequestService = {
  /**
   * Submit a contact request (public - no auth required)
   */
  async submitContactRequest(
    data: SubmitContactRequestInput
  ): Promise<{ id: string; createdAt: string }> {
    const response = await axiosClient.post('/api/directory/contact', data);
    return response.data.data;
  },

  /**
   * Get contact form options (public - no auth required)
   */
  async getContactFormOptions(): Promise<ContactFormOptions> {
    const response = await axiosClient.get('/api/directory/contact/options');
    return response.data.data;
  },

  // ==================== USER INBOX ====================

  /**
   * Get user's sent messages (inbox)
   */
  async getSentMessages(
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    const params = new URLSearchParams();
    if (pagination?.page) params.append('page', String(pagination.page));
    if (pagination?.limit) params.append('limit', String(pagination.limit));
    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const url = `/api/inbox/sent${suffix}`;
    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get a specific inbox message with replies
   */
  async getInboxMessage(requestId: string): Promise<InboxMessageDetail> {
    const response = await axiosClient.get(`/api/inbox/${requestId}`);
    return response.data.data;
  },

  /**
   * Add a reply to an inbox message (sender replying)
   */
  async addInboxReply(requestId: string, message: string): Promise<ContactRequestReplyItem> {
    const response = await axiosClient.post(`/api/inbox/${requestId}/replies`, { message });
    return response.data.data;
  },

  /**
   * Get unread inbox count
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const response = await axiosClient.get('/api/inbox/unread-count');
    return response.data.data;
  },

  // ==================== ORGANIZATION CONTACT MANAGEMENT ====================
  async getOrganizationContactRequests(
    organizationId: string,
    filters?: ContactRequestFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    const params = new URLSearchParams();

    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters?.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      params.append('endDate', filters.endDate);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    if (pagination?.page) {
      params.append('page', String(pagination.page));
    }
    if (pagination?.limit) {
      params.append('limit', String(pagination.limit));
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const url = `/api/organizations/${organizationId}/contact-requests${suffix}`;

    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get organization contact request statistics (requires auth)
   */
  async getOrganizationContactStats(organizationId: string): Promise<ContactRequestStats> {
    const response = await axiosClient.get(
      `/api/organizations/${organizationId}/contact-requests/stats`
    );
    return response.data.data;
  },

  /**
   * Get a specific organization contact request (requires auth)
   */
  async getOrganizationContactRequest(
    organizationId: string,
    requestId: string
  ): Promise<ContactRequestListItem> {
    const response = await axiosClient.get(
      `/api/organizations/${organizationId}/contact-requests/${requestId}`
    );
    return response.data.data;
  },

  /**
   * Update an organization contact request (requires auth)
   */
  async updateOrganizationContactRequest(
    organizationId: string,
    requestId: string,
    data: UpdateContactRequestInput
  ): Promise<ContactRequestListItem> {
    const response = await axiosClient.patch(
      `/api/organizations/${organizationId}/contact-requests/${requestId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete an organization contact request (requires auth)
   */
  async deleteOrganizationContactRequest(organizationId: string, requestId: string): Promise<void> {
    await axiosClient.delete(`/api/organizations/${organizationId}/contact-requests/${requestId}`);
  },

  /**
   * Get replies for an org contact request
   */
  async getOrganizationContactReplies(
    organizationId: string,
    requestId: string
  ): Promise<ContactRequestReplyItem[]> {
    const response = await axiosClient.get(
      `/api/organizations/${organizationId}/contact-requests/${requestId}/replies`
    );
    return response.data.data;
  },

  /**
   * Add org admin reply to a contact request
   */
  async addOrganizationContactReply(
    organizationId: string,
    requestId: string,
    message: string
  ): Promise<ContactRequestReplyItem> {
    const response = await axiosClient.post(
      `/api/organizations/${organizationId}/contact-requests/${requestId}/replies`,
      { message }
    );
    return response.data.data;
  },

  /**
   * Get alliance contact requests (requires auth)
   */
  async getAllianceContactRequests(
    allianceId: string,
    filters?: ContactRequestFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    const params = new URLSearchParams();

    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters?.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      params.append('endDate', filters.endDate);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    if (pagination?.page) {
      params.append('page', String(pagination.page));
    }
    if (pagination?.limit) {
      params.append('limit', String(pagination.limit));
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const url = `/api/federations/${allianceId}/contact-requests${suffix}`;

    const response = await axiosClient.get(url);
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get alliance contact request statistics (requires auth)
   */
  async getAllianceContactStats(allianceId: string): Promise<ContactRequestStats> {
    const response = await axiosClient.get(`/api/federations/${allianceId}/contact-requests/stats`);
    return response.data.data;
  },

  /**
   * Get a specific alliance contact request (requires auth)
   */
  async getAllianceContactRequest(
    allianceId: string,
    requestId: string
  ): Promise<ContactRequestListItem> {
    const response = await axiosClient.get(
      `/api/federations/${allianceId}/contact-requests/${requestId}`
    );
    return response.data.data;
  },

  /**
   * Update an alliance contact request (requires auth)
   */
  async updateAllianceContactRequest(
    allianceId: string,
    requestId: string,
    data: UpdateContactRequestInput
  ): Promise<ContactRequestListItem> {
    const response = await axiosClient.patch(
      `/api/federations/${allianceId}/contact-requests/${requestId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete an alliance contact request (requires auth)
   */
  async deleteAllianceContactRequest(allianceId: string, requestId: string): Promise<void> {
    await axiosClient.delete(`/api/federations/${allianceId}/contact-requests/${requestId}`);
  },
};

/**
 * Helper function to get contact type display label
 */
export function getContactTypeLabel(type: ContactType): string {
  const labels: Record<ContactType, string> = {
    general: 'General Inquiry',
    recruitment: 'Join Request',
    partnership: 'Partnership',
    question: 'Question',
    feedback: 'Feedback',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Helper function to get contact type icon
 */
export function getContactTypeIcon(type: ContactType): React.ReactNode {
  const icons: Record<ContactType, React.ReactNode> = {
    general: <Chat fontSize="small" />,
    recruitment: <PersonAdd fontSize="small" />,
    partnership: <Handshake fontSize="small" />,
    question: <HelpOutline fontSize="small" />,
    feedback: <Feedback fontSize="small" />,
    other: <Assignment fontSize="small" />,
  };
  return icons[type] || <Assignment fontSize="small" />;
}

/**
 * Helper function to get contact request status label
 */
export function getContactStatusLabel(status: ContactRequestStatus): string {
  const labels: Record<ContactRequestStatus, string> = {
    pending: 'Pending',
    read: 'Read',
    replied: 'Replied',
    archived: 'Archived',
    spam: 'Spam',
  };
  return labels[status] || status;
}

/**
 * Helper function to get contact request status color
 */
export function getContactStatusColor(
  status: ContactRequestStatus
): 'neutral' | 'notice' | 'positive' | 'negative' | 'info' {
  const colors: Record<
    ContactRequestStatus,
    'neutral' | 'notice' | 'positive' | 'negative' | 'info'
  > = {
    pending: 'notice',
    read: 'info',
    replied: 'positive',
    archived: 'neutral',
    spam: 'negative',
  };
  return colors[status] || 'neutral';
}
