/**
 * Standardized API Errors
 *
 * This module provides a unified error handling system for the API.
 * It extends the ApiErrorCode enum with specific error classes
 * and factory functions for consistent error creation.
 *
 * @module utils/apiErrors
 * @see ROADMAP.md - Error Handling Standardization (Q1 2026)
 */

import { ApiErrorCode } from '../types/api';

/**
 * Base API Error class
 * All API-related errors should extend this class
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ApiErrorCode | string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON response format
   */
  toJSON(): {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

// ============================================
// Specialized Error Classes
// ============================================
// Note: These classes have simplified constructors that only require
// the parameters relevant to each error type. The code and statusCode
// are set automatically based on the error class type.

/**
 * Validation Error - for input validation failures
 * @param message - Error message describing the validation failure
 * @param details - Optional field-level error details
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ApiErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error - for missing resources
 * @param resource - The type of resource that was not found
 * @param id - Optional ID of the resource
 */
export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(ApiErrorCode.RESOURCE_NOT_FOUND, message, 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized Error - for authentication failures
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required', details?: Record<string, unknown>) {
    super(ApiErrorCode.UNAUTHORIZED, message, 401, details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error - for authorization failures
 */
export class ForbiddenError extends ApiError {
  public readonly permissionContext?: {
    resource: string;
    action: string;
    scope?: string;
    resourceId?: string;
  };

  constructor(
    message: string = 'Access denied',
    permissionContext?: {
      resource: string;
      action: string;
      scope?: string;
      resourceId?: string;
    }
  ) {
    const details: Record<string, unknown> = {};
    if (permissionContext) {
      details.permission = permissionContext;
      details.requiredPermission = `${permissionContext.resource}:${permissionContext.action}`;
    }
    super(ApiErrorCode.FORBIDDEN, message, 403, details);
    this.name = 'ForbiddenError';
    this.permissionContext = permissionContext;
  }
}

/**
 * Conflict Error - for resource conflicts (e.g., duplicate)
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ApiErrorCode.RESOURCE_CONFLICT, message, 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate Limit Error - for rate limiting
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests. Please try again later.',
      429,
      retryAfter ? { retryAfter } : undefined
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Database Error - for database-related failures
 */
export class DatabaseError extends ApiError {
  constructor(message: string = 'A database error occurred') {
    super(ApiErrorCode.DATABASE_ERROR, message, 500);
    this.name = 'DatabaseError';
  }
}

/**
 * Service Unavailable Error - for service outages
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(ApiErrorCode.SERVICE_UNAVAILABLE, message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Bad Request Error - for malformed requests
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ApiErrorCode.INVALID_INPUT, message, 400, details);
    this.name = 'BadRequestError';
  }
}

// ============================================
// Domain-specific Error Classes
// ============================================

/**
 * Organization Not Found Error
 */
export class OrganizationNotFoundError extends ApiError {
  constructor(orgId?: string) {
    const message = orgId ? `Organization with id '${orgId}' not found` : 'Organization not found';
    super(ApiErrorCode.ORG_NOT_FOUND, message, 404, { organizationId: orgId });
    this.name = 'OrganizationNotFoundError';
  }
}

/**
 * Organization Access Denied Error
 */
export class OrganizationAccessDeniedError extends ApiError {
  constructor(orgId?: string) {
    super(
      ApiErrorCode.ORG_ACCESS_DENIED,
      'You do not have access to this organization',
      403,
      orgId ? { organizationId: orgId } : undefined
    );
    this.name = 'OrganizationAccessDeniedError';
  }
}

/**
 * Fleet Not Found Error
 */
export class FleetNotFoundError extends ApiError {
  constructor(fleetId?: string) {
    const message = fleetId ? `Fleet with id '${fleetId}' not found` : 'Fleet not found';
    super(ApiErrorCode.FLEET_NOT_FOUND, message, 404, { fleetId });
    this.name = 'FleetNotFoundError';
  }
}

/**
 * Ship Not Found Error
 */
export class ShipNotFoundError extends ApiError {
  constructor(shipId?: string) {
    const message = shipId ? `Ship with id '${shipId}' not found` : 'Ship not found';
    super(ApiErrorCode.SHIP_NOT_FOUND, message, 404, { shipId });
    this.name = 'ShipNotFoundError';
  }
}

/**
 * Activity Not Found Error
 */
export class ActivityNotFoundError extends ApiError {
  constructor(activityId?: string) {
    const message = activityId
      ? `Activity with id '${activityId}' not found`
      : 'Activity not found';
    super(ApiErrorCode.ACTIVITY_NOT_FOUND, message, 404, { activityId });
    this.name = 'ActivityNotFoundError';
  }
}

/**
 * Activity Full Error
 */
export class ActivityFullError extends ApiError {
  constructor(activityId?: string, maxParticipants?: number) {
    super(ApiErrorCode.ACTIVITY_FULL, 'This activity has reached its maximum capacity', 400, {
      activityId,
      maxParticipants,
    });
    this.name = 'ActivityFullError';
  }
}

// ============================================
// Error Factory Functions
// ============================================

/**
 * Create a validation error from Joi validation result
 */
export function createValidationError(joiError: {
  details: Array<{ message: string; path: (string | number)[] }>;
}): ValidationError {
  const details: Record<string, string> = {};
  joiError.details.forEach(detail => {
    const field = detail.path.join('.');
    details[field] = detail.message;
  });

  const message =
    joiError.details.length === 1
      ? joiError.details[0].message
      : 'Validation failed for multiple fields';

  return new ValidationError(message, { fields: details });
}

/**
 * Create a not found error for any resource
 */
export function createNotFoundError(resource: string, id?: string): NotFoundError {
  return new NotFoundError(resource, id);
}

/**
 * Create an error from a database exception
 */
export function createDatabaseError(error: Error): DatabaseError {
  // Don't expose internal database error details in production
  const message =
    process.env.NODE_ENV === 'production' ? 'A database error occurred' : error.message;
  return new DatabaseError(message);
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  return isApiError(error) && error.isOperational;
}

/**
 * Get the HTTP status code for an error
 */
export function getErrorStatusCode(error: unknown): number {
  if (isApiError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Get the error code for an error
 */
export function getErrorCode(error: unknown): string {
  if (isApiError(error)) {
    return error.code;
  }
  return ApiErrorCode.INTERNAL_ERROR;
}
