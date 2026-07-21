import type { FederationAmbassadorPermission } from '@sc-fleet-manager/shared-types';

import { ForbiddenError } from '../../utils/apiErrors';

import { FederationAmbassadorService } from './FederationAmbassadorService';

/**
 * Shared federation permission check utilities.
 *
 * Extracted from individual federation services to eliminate duplication.
 * All federation services that need ambassador permission checks should
 * use these functions instead of implementing their own.
 */

/**
 * Require a specific ambassador permission, throwing ForbiddenError if missing.
 */
export async function requireFederationPermission(
  ambassadorService: FederationAmbassadorService,
  federationId: string,
  userId: string,
  permission: FederationAmbassadorPermission,
  errorMessage?: string
): Promise<void> {
  const hasAccess = await ambassadorService.hasPermission(federationId, userId, permission);
  if (!hasAccess) {
    throw new ForbiddenError(errorMessage ?? `Ambassador '${permission}' permission required`);
  }
}

/**
 * Require view access (any active ambassador).
 */
export async function requireFederationViewAccess(
  ambassadorService: FederationAmbassadorService,
  federationId: string,
  userId: string,
  resourceName?: string
): Promise<void> {
  return requireFederationPermission(
    ambassadorService,
    federationId,
    userId,
    'view',
    `You must be a federation ambassador to view ${resourceName ?? 'this resource'}`
  );
}

