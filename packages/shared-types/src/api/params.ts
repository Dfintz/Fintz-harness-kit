/**
 * Pagination query parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Sorting query parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search query parameters
 */
export interface SearchParams {
  search?: string;
  searchFields?: string[];
}

/**
 * Combined query parameters for list endpoints
 */
export interface ListQueryParams extends PaginationParams, SortParams, SearchParams {}

/**
 * Fleet list query parameters
 */
export interface FleetListParams extends ListQueryParams {
  organizationId?: string;
  isActive?: boolean;
}

/**
 * Activity list query parameters
 */
export interface ActivityListParams extends ListQueryParams {
  organizationId?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Ship list query parameters
 */
export interface ShipListParams extends ListQueryParams {
  organizationId?: string;
  fleetId?: string;
  ownerId?: string;
  role?: string;
  size?: string;
  status?: string;
}

/**
 * User list query parameters
 */
export interface UserListParams extends ListQueryParams {
  organizationId?: string;
  role?: string;
}
