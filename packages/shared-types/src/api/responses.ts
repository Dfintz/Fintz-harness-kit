/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiResponseMeta;
}

/**
 * API response metadata
 */
export interface ApiResponseMeta {
  requestId?: string;
  timestamp: string;
  version?: string;
}

/**
 * Pagination metadata
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    isOperational?: boolean;
  };
  meta?: ApiResponseMeta;
}

/**
 * API error detail (validation errors, etc.)
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Domain-specific errors
  FLEET_NOT_FOUND: 'FLEET_NOT_FOUND',
  FLEET_CAPACITY_EXCEEDED: 'FLEET_CAPACITY_EXCEEDED',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  SHIP_NOT_FOUND: 'SHIP_NOT_FOUND',
  ACTIVITY_NOT_FOUND: 'ACTIVITY_NOT_FOUND',
  ACTIVITY_FULL: 'ACTIVITY_FULL',
  ALREADY_PARTICIPANT: 'ALREADY_PARTICIPANT',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
