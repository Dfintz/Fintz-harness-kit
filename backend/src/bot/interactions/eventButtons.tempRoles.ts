import type { ButtonInteraction } from 'discord.js';

import { EventTempRoleService } from '../../services/activity/EventTempRoleService';
import { logger } from '../../utils/logger';

import { getActivityService } from './eventButtons.services';

const TEMP_ROLE_ASSIGN_ACTIONS = new Set(['join']);
const TEMP_ROLE_REMOVE_ACTIONS = new Set(['decline', 'leave']);

/**
 * After an RSVP action, assign or remove the event's temporary Discord role.
 * Runs fire-and-forget so it never blocks the embed refresh.
 */
export function handleTempRoleUpdate(
  interaction: ButtonInteraction,
  activityId: string,
  userId: string,
  action: string
): void {
  if (!interaction.guild) {
    return;
  }
  if (!TEMP_ROLE_ASSIGN_ACTIONS.has(action) && !TEMP_ROLE_REMOVE_ACTIONS.has(action)) {
    return;
  }

  const guild = interaction.guild;
  const tempRoleService = EventTempRoleService.getInstance();

  getActivityService()
    .getActivityById(activityId)
    .then(activity => {
      const tempRoleId = activity?.metadata?.tempRoleId;
      if (!tempRoleId) {
        return;
      }

      if (TEMP_ROLE_ASSIGN_ACTIONS.has(action)) {
        return tempRoleService.assignTempRole(guild, userId, tempRoleId, activityId);
      } else {
        return tempRoleService.removeTempRole(guild, userId, tempRoleId, activityId);
      }
    })
    .catch(err => {
      logger.warn('Temp role update failed (non-critical)', {
        activityId,
        userId,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
