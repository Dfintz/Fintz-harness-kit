import { Request } from 'express';

import { ApiError } from '../middleware/errorHandlerV2';
import { ApiErrorCode } from '../types/api';

/** Authenticated request shape for extracting user and org context */
type AuthenticatedRequest = Request & {
  user?: { id?: string; currentOrganizationId?: string };
};

/**
 * Extract the current organization ID from the authenticated user or route params.
 * Checks `req.params.orgId` first (for organization-scoped endpoints),
 * then falls back to the user's `currentOrganizationId` from auth context.
 *
 * @param req Express request object
 * @returns Organization ID string
 * @throws ApiError (403) if no organization context is available
 */
export function getOrganizationId(req: Request): string {
  const orgId = req.params.orgId || (req as AuthenticatedRequest).user?.currentOrganizationId;

  if (!orgId) {
    throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Organization context is required', 403);
  }

  return orgId;
}

/**
 * Extract the authenticated user ID from request.
 *
 * @param req Express request object
 * @returns User ID string or undefined if not authenticated
 */
export function getAuthenticatedUserId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).user?.id;
}
