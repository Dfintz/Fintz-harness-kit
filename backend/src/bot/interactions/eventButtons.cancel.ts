import { ButtonInteraction, MessageFlags } from 'discord.js';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildEventEmbed } from '../embeds/eventEmbed';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';

import {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from './eventButtons.embedData';
import { resolveInternalUserId } from './eventButtons.identity';
import { getUserFriendlyError } from './eventButtons.messages';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService, getParticipantService } from './eventButtons.services';

/** Repeated user-facing message — SonarQube S1192 */
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

/**
 * First click on the public "Cancel Event" button shows a uniform confirmation
 * prompt instead of cancelling immediately (C2 / confirm-by-default). The confirm
 * button re-enters the router as `event_confirmcancel_<id>` -> {@link handleCancelEvent};
 * the dismiss button re-enters as `event_canceldismiss_<id>` ->
 * {@link handleCancelEventDismiss}. Authorization and status checks stay in
 * {@link handleCancelEvent} so they remain single-sourced.
 */
export async function handleCancelEventPrompt(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.reply(
    buildConfirmationPrompt({
      confirmCustomId: `event_confirmcancel_${activityId}`,
      cancelCustomId: `event_canceldismiss_${activityId}`,
      message: 'cancel this event',
      confirmLabel: 'Cancel Event',
      cancelLabel: 'Keep Event',
      confirmEmoji: '🛑',
      cancelEmoji: '↩️',
    })
  );
}

/** Dismiss handler for the event-cancellation confirmation prompt. */
export async function handleCancelEventDismiss(
  interaction: ButtonInteraction,
  _activityId?: string
): Promise<void> {
  await respondConfirmationCancelled(interaction);
}

export async function handleCancelEvent(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const userName = interaction.user.username;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    const internalUserId = await resolveInternalUserId(userId);
    if (activity.creatorId !== internalUserId && activity.creatorId !== userId) {
      await interaction.editReply({
        content: '❌ Only the event creator can cancel this event.',
      });
      return;
    }

    const status = (activity.status ?? '').toLowerCase();
    if (status === 'cancelled') {
      await interaction.editReply({ content: '⚠️ This event is already cancelled.' });
      return;
    }
    if (status === 'completed') {
      await interaction.editReply({ content: '⚠️ Cannot cancel a completed event.' });
      return;
    }

    const eventService = new (
      await import('../../services/activity/ActivityEventService')
    ).ActivityEventService();
    await eventService.cancelActivity(
      activityId,
      internalUserId ?? userId,
      'Cancelled via Discord button',
      activity.organizationId ?? undefined
    );

    await interaction.editReply({
      content: '🛑 Event has been cancelled.',
    });

    try {
      const channel = interaction.channel;
      const updated = await getActivityService().getActivityById(activityId);
      if (updated && channel && 'messages' in channel) {
        const messages = await channel.messages.fetch({ limit: 20 });
        const eventMessage = messages.find(
          m => m.embeds.length > 0 && m.embeds[0].footer?.text?.includes(`ID: ${activityId}`)
        );
        if (eventMessage) {
          const participants = await getParticipantService().getParticipants(activityId);
          const discordIdMap = await resolveDiscordIdMap(
            collectUserIdsForEmbed(updated, participants)
          );
          const embedData = buildEmbedDataFromActivity(updated, participants, discordIdMap);
          const embed = buildEventEmbed(embedData);
          await eventMessage.edit({
            embeds: [embed],
            components: [],
          });
        }
      }
    } catch {
      // Best effort — cancel already succeeded
    }

    publishMirrorRefresh(activityId, userId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_CANCEL',
      message: `User cancelled event via button: ${activityId}`,
      metadata: { activityId, action: 'cancel' },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
    });
  }
}
