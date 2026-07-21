import { ButtonInteraction, MessageFlags, ModalSubmitInteraction } from 'discord.js';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildEventComponentRows, buildEventEmbed } from '../embeds/eventEmbed';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';

import {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from './eventButtons.embedData';
import { resolveInternalUserId } from './eventButtons.identity';
import { getUserFriendlyError } from './eventButtons.messages';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService, getParticipantService } from './eventButtons.services';
import { launchEventEditWizard } from './eventEditWizard';

const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

async function handleEditEvent(interaction: ButtonInteraction, activityId: string): Promise<void> {
  const userId = interaction.user.id;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.reply({
        content: MSG_ACTIVITY_NOT_FOUND,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const internalUserId = await resolveInternalUserId(userId);
    if (activity.creatorId !== internalUserId && activity.creatorId !== userId) {
      await interaction.reply({
        content: '❌ Only the event creator can edit this event.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const status = (activity.status ?? '').toLowerCase();
    if (status === 'cancelled' || status === 'completed') {
      await interaction.reply({
        content: `⚠️ Cannot edit a ${status} event.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await launchEventEditWizard(interaction, activityId);
  } catch (error: unknown) {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export async function handleEditEventModal(
  interaction: ModalSubmitInteraction,
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
        content: '❌ Only the event creator can edit this event.',
      });
      return;
    }

    const payload = buildEditUpdates(interaction);
    if (payload.error) {
      await interaction.editReply({ content: payload.error });
      return;
    }
    const updates = payload.updates;

    await getActivityService().updateActivity(activityId, updates);

    await interaction.editReply({ content: '✅ Event updated successfully.' });

    await refreshEditedEventMessage(interaction, activityId);

    publishMirrorRefresh(activityId, userId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_EDIT',
      message: `User edited event via button: ${activityId}`,
      metadata: { activityId, action: 'edit', updates },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
    });
  }
}

function buildEditUpdates(interaction: ModalSubmitInteraction): {
  updates: Record<string, unknown>;
  error?: string;
} {
  const title = interaction.fields.getTextInputValue('edit_title').trim();
  if (!title) {
    return {
      updates: {},
      error: '❌ Title is required.',
    };
  }

  const updates: Record<string, unknown> = {
    title,
    description: interaction.fields.getTextInputValue('edit_description').trim() || null,
    location: interaction.fields.getTextInputValue('edit_location').trim() || null,
  };

  const maxParticipantsRaw = interaction.fields.getTextInputValue('edit_max_participants').trim();
  if (maxParticipantsRaw) {
    const max = Number.parseInt(maxParticipantsRaw, 10);
    if (Number.isNaN(max) || max < 1 || max > 100) {
      return {
        updates: {},
        error: '❌ Max participants must be between 1 and 100.',
      };
    }
    updates.maxParticipants = max;
  } else {
    updates.maxParticipants = null;
  }

  const startDateRaw = interaction.fields.getTextInputValue('edit_start_date').trim();
  if (startDateRaw) {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(startDateRaw)
      ? `${startDateRaw.replace(' ', 'T')}:00Z`
      : startDateRaw;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return {
        updates: {},
        error: '❌ Invalid date. Use format `YYYY-MM-DD HH:mm` in UTC.',
      };
    }
    updates.scheduledStartDate = parsed;
  }

  return { updates };
}

async function refreshEditedEventMessage(
  interaction: ModalSubmitInteraction,
  activityId: string
): Promise<void> {
  try {
    const updated = await getActivityService().getActivityById(activityId);
    if (!updated || !interaction.message) {
      return;
    }

    const participants = await getParticipantService().getParticipants(activityId);
    const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(updated, participants));
    const embedData = buildEmbedDataFromActivity(updated, participants, discordIdMap);
    const embed = buildEventEmbed(embedData);
    const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
    const components = buildEventComponentRows(activityId, { includeManage: isActive });

    await interaction.message.edit({ embeds: [embed], components });
  } catch {
    // Best effort - update already succeeded.
  }
}

export { handleEditEvent };
