/**
 * API v2 Standard Types
 * Defines standard response formats and error structures
 * Implements RESTful API improvements per ROADMAP.md section 2.3
 */

import { ApiErrorCode } from '@sc-fleet-manager/shared-types';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
  links?: HateoasLinks;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

/**
 * Response meta with required pagination
 */
export interface PaginatedResponseMeta extends Omit<ResponseMeta, 'pagination'> {
  timestamp: string;
  requestId?: string;
  pagination: PaginationMeta;
}

/**
 * Pagination metadata supporting both page-based and offset-based pagination
 * - page/limit: Traditional page-based pagination
 * - offset/limit: Offset-based pagination for API v2
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  // Legacy fields for backward compatibility
  page?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * HATEOAS links for API discoverability
 */
export interface HateoasLinks {
  self: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginatedResponseMeta;
  links: HateoasLinks;
}

// Error codes enum exported from shared-types
export { ApiErrorCode } from '@sc-fleet-manager/shared-types';

/**
 * Standard query parameters for API v2
 * Supports:
 * - Offset-based pagination: ?limit=20&offset=40
 * - Sorting: ?sort=-createdAt (prefix - for desc)
 * - Filtering: ?filter[status]=active&filter[type]=mission
 * - Field selection: ?fields=id,name,createdAt
 * - Search: ?search=keyword
 */
export interface StandardQueryParams {
  // Pagination
  limit?: number;
  offset?: number;
  // Legacy page-based (deprecated but supported)
  page?: number;

  // Sorting: field name, prefix with - for descending
  sort?: string;

  // Filters: parsed from filter[field]=value
  filter?: Record<string, string | string[]>;

  // Field selection: comma-separated field names
  fields?: string[];

  // Search term
  search?: string;
}

/**
 * Parsed query parameters with defaults applied
 */
export interface ParsedQueryParams {
  limit: number;
  offset: number;
  sort: { field: string; order: 'ASC' | 'DESC' } | null;
  filters: Record<string, string | string[]>;
  fields: string[] | null;
  search: string | null;
}

/**
 * Default parsed query parameters - use this to ensure consistency
 */
export const DEFAULT_QUERY_PARAMS: ParsedQueryParams = {
  limit: 20,
  offset: 0,
  sort: null,
  filters: {},
  fields: null,
  search: null,
};

/**
 * Options for paginated list helpers
 */
export interface PaginatedListOptions {
  basePath: string;
  queryParams?: Record<string, string>;
}

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      /** Parsed v2 query parameters */
      queryParams?: ParsedQueryParams;
      /** API version detected by trackApiVersion middleware */
      apiVersion?: 'v1' | 'v2' | 'unknown';
    }

    interface Response {
      success<T>(data: T, meta?: Partial<ResponseMeta>): void;
      paginated<T>(data: T[], pagination: PaginationMeta, links?: HateoasLinks): void;
      error(
        code: ApiErrorCode,
        message: string,
        details?: Record<string, unknown>,
        statusCode?: number
      ): void;
    }
  }
}
