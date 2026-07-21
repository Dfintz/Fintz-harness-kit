import type { ButtonInteraction } from 'discord.js';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';

import { getEphemeralLeaveConfirmation } from './eventButtons.directActions';
import { triggerMirrorSync } from './eventButtons.mirrorSync';
import { refreshEventEmbed, refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { handleTempRoleUpdate } from './eventButtons.tempRoles';

export interface RunPostActionEffectsParams {
  interaction: ButtonInteraction;
  action: string;
  activityId: string;
  userId: string;
  userName: string;
  isDiscordGuest: boolean;
  isEphemeralSource: boolean;
}

export async function runPostActionEffects({
  interaction,
  action,
  activityId,
  userId,
  userName,
  isDiscordGuest,
  isEphemeralSource,
}: RunPostActionEffectsParams): Promise<void> {
  if (!isDiscordGuest) {
    handleTempRoleUpdate(interaction, activityId, userId, action);
  }

  if (isEphemeralSource) {
    await refreshEventEmbedFromChannel(interaction, activityId);
    await interaction.editReply({
      content: getEphemeralLeaveConfirmation(action),
      components: [],
    });
  } else {
    await refreshEventEmbed(interaction, activityId);
  }

  triggerMirrorSync(activityId, userId, userName, action);

  logAuditEvent({
    eventType: AuditEventType.ACTIVITY_ACTION,
    userId,
    username: userName,
    resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
    action: `EVENT_${action.toUpperCase()}`,
    message: `User ${action} event via button: ${activityId}`,
    metadata: { activityId, action, isDiscordGuest },
  });
}
