/**
 * Authentication Helper Functions
 *
 * Provides type-safe utilities for accessing authenticated user data from requests.
 */

import { Request } from 'express';

import { ApiError } from '../middleware/errorHandlerV2';
import { ApiErrorCode } from '../types/api';

/** Type for an Express request with authenticated user data */
type AuthenticatedRequest = Request & { user?: { id?: string; activeOrgId?: string } };

/** Type for an Express request with tenant context */
type TenantContextRequest = Request & { tenantContext?: { organizationId?: string } };

/**
 * Gets the authenticated user ID from the request.
 * Throws an ApiError if the user is not authenticated.
 *
 * @param req - Express request object
 * @returns The authenticated user's ID
 * @throws ApiError with UNAUTHORIZED code if user is not authenticated
 */
export function getAuthenticatedUserId(req: Request): string {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
        throw new ApiError(
            ApiErrorCode.UNAUTHORIZED,
            'User not authenticated',
            401
        );
    }
    return userId;
}

/**
 * Gets the authenticated user's active organization ID from the request.
 * Returns undefined if no active org is set.
 *
 * @param req - Express request object
 * @returns The active organization ID or undefined
 */
export function getActiveOrganizationId(req: Request): string | undefined {
    return (req as AuthenticatedRequest).user?.activeOrgId;
}

/**
 * Gets the organization ID from the tenant context.
 * 
 * Tenant context is set by the tenantContext middleware chain for organization-scoped routes.
 * This function should only be called on routes where requireTenantContext middleware has been applied.
 * 
 * @param req - Express request object
 * @returns The organization ID from tenant context
 * @throws ApiError with ORG_MEMBERSHIP_REQUIRED code if tenant context is missing
 */
export function getOrganizationIdFromContext(req: Request): string {
    const organizationId = (req as TenantContextRequest).tenantContext?.organizationId;
    if (!organizationId) {
        throw new ApiError(
            ApiErrorCode.ORG_MEMBERSHIP_REQUIRED,
            'Organization context required',
            400
        );
    }
    return organizationId;
}

/**
 * Checks if the request has an authenticated user.
 *
 * @param req - Express request object
 * @returns true if the request has a valid user, false otherwise
 */
export function isAuthenticated(req: Request): boolean {
    return !!(req as AuthenticatedRequest).user?.id;
}

