/**
 * Enhanced Error Handler for API v2
 * Provides standardized error responses with proper codes and tracking
 */

import { NextFunction, Response } from 'express';

import { ApiErrorCode } from '../types/api';
// logger lives in utils/logger.ts (not config/logger) — fix import
import { logger } from '../utils/logger';

// Extend Request minimally to reference optional properties used here
interface ExtendedRequest {
  id?: string;
  user?: { id?: string };
  // tenantContext shape varies across middlewares
  tenantContext?: { organizationId?: string };
  // Inherit standard Request properties
  path: string;
  method: string;
  get(name: string): string | undefined;
}

interface ErrorMapping {
  code: ApiErrorCode | string;
  status: number;
}

// Map common error types to API error codes
const errorMappings: Record<string, ErrorMapping> = {
  EntityNotFoundError: { code: ApiErrorCode.RESOURCE_NOT_FOUND, status: 404 },
  QueryFailedError: { code: ApiErrorCode.DATABASE_ERROR, status: 500 },
  ValidationError: { code: ApiErrorCode.VALIDATION_ERROR, status: 400 },
  UnauthorizedError: { code: ApiErrorCode.UNAUTHORIZED, status: 401 },
  ForbiddenError: { code: ApiErrorCode.FORBIDDEN, status: 403 },
  ConflictError: { code: ApiErrorCode.RESOURCE_CONFLICT, status: 409 },
  NotFoundError: { code: ApiErrorCode.RESOURCE_NOT_FOUND, status: 404 },
  BadRequestError: { code: ApiErrorCode.INVALID_INPUT, status: 400 },
};

export const errorHandlerV2 = (
  error: Error & {
    code?: string;
    statusCode?: number;
    details?: unknown;
    errors?: Record<string, { message: string }>;
  },
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
) => {
  // Map error to standard format
  const errorName = error.constructor?.name || 'Error';
  const mapped = errorMappings[errorName] || {
    code: ApiErrorCode.INTERNAL_ERROR,
    status: 500,
  };

  // Handle specific error types
  let code = mapped.code;
  let message = error.message || 'An error occurred';
  let details = error.details;
  let status = mapped.status;

  // Handle validation errors with details
  if (error.name === 'ValidationError' && error.errors) {
    code = ApiErrorCode.VALIDATION_ERROR;
    message = 'Validation failed';
    details = Object.keys(error.errors).map(key => ({
      field: key,
      message: error.errors![key].message,
    }));
    status = 400;
  }

  // Detect "Organization context required" errors and add requiresOrgSelection flag
  // so the frontend can uniformly redirect to org selection
  let requiresOrgSelection: boolean | undefined;
  if (message === 'Organization context required') {
    requiresOrgSelection = true;
  }

  // Handle custom API errors
  if (error.code && Object.values(ApiErrorCode).includes(error.code as ApiErrorCode)) {
    code = error.code;
    status = error.statusCode || status;
  }

  // Don't expose internal error details in production
  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'An internal server error occurred';
    details = undefined;
  }

  // Log at a level proportional to severity: 4xx are routine client errors and must
  // not raise error alarms; only 5xx are logged at error level.
  const logContext = {
    requestId: req.id,
    path: req.path,
    method: req.method,
    error: error?.message,
    statusCode: status,
    userId: req.user?.id,
    organizationId: req.tenantContext?.organizationId,
    ...(status >= 500 ? { stack: error?.stack } : {}),
  };
  if (status >= 500) {
    logger.error('API v2 error', logContext);
  } else {
    logger.warn('API v2 client error', logContext);
  }

  // Send standardized error response
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
      ...(requiresOrgSelection ? { requiresOrgSelection: true } : {}),
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
  });
};

// Re-export the canonical ApiError from utils/apiErrors so controllers importing
// ApiError from this module share a single class identity with the typed error
// subclasses (NotFoundError, ValidationError, ConflictError, etc.). This lets the
// controller-level `if (error instanceof ApiError) throw error` guards recognize
// service-thrown typed errors and rethrow them — preserving their own status code —
// instead of re-wrapping them to a generic 500.
export { ApiError } from '../utils/apiErrors';
