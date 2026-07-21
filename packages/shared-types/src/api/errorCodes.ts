/**
 * API error codes — standard error codes used across the application
 */
export enum ApiErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Organization errors
  ORG_NOT_FOUND = 'ORG_NOT_FOUND',
  ORG_ACCESS_DENIED = 'ORG_ACCESS_DENIED',
  ORG_MEMBERSHIP_REQUIRED = 'ORG_MEMBERSHIP_REQUIRED',

  // Fleet errors
  FLEET_NOT_FOUND = 'FLEET_NOT_FOUND',
  SHIP_NOT_FOUND = 'SHIP_NOT_FOUND',

  // Activity errors
  ACTIVITY_NOT_FOUND = 'ACTIVITY_NOT_FOUND',
  ACTIVITY_FULL = 'ACTIVITY_FULL',

  // Generic not-found (used by teams, etc.)
  NOT_FOUND = 'NOT_FOUND',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * API error code type (string literal union)
 * Use this type for function parameters and return types
 */
export type ApiErrorCodeType = `${ApiErrorCode}`;
