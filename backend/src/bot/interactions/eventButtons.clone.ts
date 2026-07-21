import { ButtonInteraction, MessageFlags } from 'discord.js';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildEventComponentRows, buildEventEmbed } from '../embeds/eventEmbed';

import { buildEmbedDataFromActivity } from './eventButtons.embedData';
import { resolveInternalUserId } from './eventButtons.identity';
import { getUserFriendlyError } from './eventButtons.messages';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService } from './eventButtons.services';

const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

/** Default schedule shift applied to a cloned event: one week forward. */
const CLONE_SCHEDULE_SHIFT_MS = 7 * 24 * 60 * 60 * 1000;

async function handleCloneEvent(interaction: ButtonInteraction, activityId: string): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const original = await getActivityService().getActivityById(activityId);
    if (!original) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (original.creatorId !== internalUserId && original.creatorId !== interaction.user.id) {
      await interaction.editReply({
        content: '❌ Only the event creator can clone this event.',
      });
      return;
    }

    const overrides: { scheduledStartDate?: Date; scheduledEndDate?: Date } = {};
    if (original.scheduledStartDate) {
      overrides.scheduledStartDate = new Date(
        new Date(original.scheduledStartDate).getTime() + CLONE_SCHEDULE_SHIFT_MS
      );
    }
    if (original.scheduledEndDate) {
      overrides.scheduledEndDate = new Date(
        new Date(original.scheduledEndDate).getTime() + CLONE_SCHEDULE_SHIFT_MS
      );
    }

    const cloned = await getActivityService().cloneActivity(activityId, overrides);

    const channel = interaction.channel;
    if (channel && channel.isTextBased() && 'send' in channel) {
      const embed = buildEventEmbed(
        buildEmbedDataFromActivity(cloned, [], new Map<string, string>())
      );
      const components = buildEventComponentRows(cloned.id, { includeManage: true });
      await channel.send({ embeds: [embed], components });
    }

    const whenLine = cloned.scheduledStartDate
      ? ` scheduled for <t:${Math.floor(new Date(cloned.scheduledStartDate).getTime() / 1000)}:F>`
      : ' with no date set yet';
    await interaction.editReply({
      content:
        `✅ Cloned **${original.title}** into a new draft${whenLine}.\n` +
        'Sign-ups start empty — use the **Edit Event** button on the new post to adjust details.',
    });

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: internalUserId ?? interaction.user.id,
      username: interaction.user.username,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_CLONE',
      message: `User cloned event ${activityId} → ${cloned.id}`,
      metadata: { sourceActivityId: activityId, clonedActivityId: cloned.id },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
    });
  }
}

export { CLONE_SCHEDULE_SHIFT_MS, handleCloneEvent };
