import { logger } from '../../utils/logger';
import { broadcastEvent, emitToUser, emitToOrganization } from '../websocketServer';

/**
 * Feature Flag WebSocket Controller
 * 
 * Handles real-time feature flag updates:
 * - Flag status changes
 * - Flag creation/deletion
 * - User-specific flag updates
 * - Organization-specific flag updates
 */

export interface FeatureFlagUpdate {
  flagId: string;
  action: 'created' | 'updated' | 'deleted';
  status?: string;
  scope?: string;
  percentage?: number;
  targetOrganizations?: string[];
  targetUsers?: string[];
  timestamp: number;
}

export interface FeatureFlagEvent {
  type: 'feature-flag:updated' | 'feature-flag:created' | 'feature-flag:deleted';
  update: FeatureFlagUpdate;
  userId?: string;
  organizationId?: string;
}

/**
 * Broadcast feature flag update to all connected clients
 */
export const broadcastFeatureFlagUpdate = (update: Omit<FeatureFlagUpdate, 'timestamp'>): void => {
  const fullUpdate: FeatureFlagUpdate = {
    ...update,
    timestamp: Date.now()
  };

  const event: FeatureFlagEvent = {
    type: `feature-flag:${update.action}`,
    update: fullUpdate
  };

  broadcastEvent('feature-flag:updated', event);
  logger.info('Broadcasted feature flag update', { flagId: update.flagId, action: update.action });
};

/**
 * Send feature flag update to specific user
 */
export const sendFeatureFlagUpdateToUser = (
  userId: string,
  update: Omit<FeatureFlagUpdate, 'timestamp'>
): void => {
  const fullUpdate: FeatureFlagUpdate = {
    ...update,
    timestamp: Date.now()
  };

  const event: FeatureFlagEvent = {
    type: `feature-flag:${update.action}`,
    update: fullUpdate,
    userId
  };

  emitToUser(userId, 'feature-flag:updated', event);
  logger.debug('Sent feature flag update to user', { userId, flagId: update.flagId });
};

/**
 * Send feature flag update to specific organization
 */
export const sendFeatureFlagUpdateToOrganization = (
  organizationId: string,
  update: Omit<FeatureFlagUpdate, 'timestamp'>
): void => {
  const fullUpdate: FeatureFlagUpdate = {
    ...update,
    timestamp: Date.now()
  };

  const event: FeatureFlagEvent = {
    type: `feature-flag:${update.action}`,
    update: fullUpdate,
    organizationId
  };

  emitToOrganization(organizationId, 'feature-flag:updated', event);
  logger.debug('Sent feature flag update to organization', { organizationId, flagId: update.flagId });
};

/**
 * Handle feature flag change and notify relevant clients
 */
export const notifyFeatureFlagChange = async (
  flagId: string,
  action: 'created' | 'updated' | 'deleted',
  scope: string,
  status?: string,
  percentage?: number,
  targetOrganizations?: string[],
  targetUsers?: string[]
): Promise<void> => {
  const update: Omit<FeatureFlagUpdate, 'timestamp'> = {
    flagId,
    action,
    status,
    scope,
    percentage,
    targetOrganizations,
    targetUsers
  };

  // If scope is global or the flag affects all users, broadcast to everyone
  if (scope === 'global' || scope === 'beta_users') {
    broadcastFeatureFlagUpdate(update);
  }
  // If scope is organization-specific, notify those organizations
  else if (scope === 'organization' && targetOrganizations) {
    for (const orgId of targetOrganizations) {
      sendFeatureFlagUpdateToOrganization(orgId, update);
    }
  }
  // If scope is user-specific, notify those users
  else if (scope === 'user' && targetUsers) {
    for (const userId of targetUsers) {
      sendFeatureFlagUpdateToUser(userId, update);
    }
  }
};
