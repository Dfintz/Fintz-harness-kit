import { Request } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Fleet } from '../../models/Fleet';
import { PermissionManagerService } from '../../services/security/permissions/PermissionManagerService';
import { ApiErrorCode } from '../../types/api';
import { getAuthenticatedUserId } from '../../utils/tenantHelpers';

// Singleton permission manager for fleet-org membership/permission checks
// (used when authorizing single-fleet routes that don't carry :orgId in the URL)
const fleetPermissionManager = new PermissionManagerService();

/**
 * Look up a fleet by id and authorize the caller against the fleet's actual
 * organization (rather than the user's currently-active org).
 *
 * Single-fleet routes (`/api/v2/fleets/:id`) don't carry the org in the URL,
 * so the user's `activeOrgId` was previously used to scope the lookup. That
 * caused 404s whenever the caller was viewing fleets for an org other than
 * their active one (the list route is org-scoped via `:orgId` and works
 * across all orgs the user belongs to).
 *
 * This helper:
 *  1. Loads the fleet by id only.
 *  2. Verifies the user has the required `fleet:<action>` permission within
 *     the fleet's organization (which inherently enforces membership).
 *  3. Returns 404 — not 403 — on permission failure to avoid leaking the
 *     existence of fleets in other orgs.
 */
export async function loadAuthorizedFleet(
  req: Request,
  fleetId: string,
  action: 'read' | 'edit' | 'delete'
): Promise<Fleet> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const fleetRepo = AppDataSource.getRepository(Fleet);
  const fleet = await fleetRepo.findOne({ where: { id: fleetId } });

  if (!fleet) {
    throw new ApiError(ApiErrorCode.FLEET_NOT_FOUND, 'Fleet not found', 404);
  }

  if (!fleet.organizationId) {
    throw new ApiError(ApiErrorCode.FLEET_NOT_FOUND, 'Fleet has no organization', 404);
  }

  const permission = await fleetPermissionManager.checkPermission(
    fleet.organizationId,
    userId,
    'fleet',
    action
  );

  if (!permission.allowed) {
    // Don't leak the existence of fleets in orgs the caller isn't a member of
    throw new ApiError(ApiErrorCode.FLEET_NOT_FOUND, 'Fleet not found', 404);
  }

  return fleet;
}
