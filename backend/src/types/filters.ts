/**
 * Common Filter Types
 * 
 * Reusable filter types for database queries
 * Use these instead of 'any' for type-safe filtering
 */

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * Base entity filter
 */
export interface BaseFilter {
  id?: string;
  ids?: string[];
  createdAt?: DateRangeFilter;
  updatedAt?: DateRangeFilter;
}

/**
 * Organization-scoped filter (multi-tenancy)
 */
export interface OrganizationFilter extends BaseFilter {
  organizationId: string;
}

/**
 * User filter
 */
export interface UserFilter extends DateRangeFilter {
  organizationId?: string;
  role?: 'user' | 'admin' | 'superadmin';
  isActive?: boolean;
  isVerified?: boolean;
  searchTerm?: string;
}

/**
 * Activity filter
 */
export interface ActivityFilter extends OrganizationFilter {
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  type?: string;
  participantId?: string;
  startDate?: DateRangeFilter;
  endDate?: DateRangeFilter;
}

/**
 * Fleet filter
 */
export interface FleetFilter extends OrganizationFilter {
  isPublic?: boolean;
  memberId?: string;
  name?: string;
}

/**
 * Ship filter
 */
export interface ShipFilter extends OrganizationFilter {
  manufacturer?: string;
  role?: string;
  minCrew?: number;
  maxCrew?: number;
  availableOnly?: boolean;
}

/**
 * Generic text search filter
 */
export interface TextSearchFilter {
  searchTerm: string;
  fields: string[];
  caseSensitive?: boolean;
}

/**
 * Status filter (generic)
 */
export interface StatusFilter {
  status?: string | string[];
  excludeStatus?: string | string[];
}

/**
 * Ownership filter
 */
export interface OwnershipFilter {
  ownerId?: string;
  createdBy?: string;
  assignedTo?: string;
}
