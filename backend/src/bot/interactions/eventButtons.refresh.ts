import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { MessageFlags } from 'discord.js';

import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { buildEventComponentRows, buildEventEmbed } from '../embeds/eventEmbed';
import {
  buildMirroredEventComponents,
  buildMirroredEventEmbed,
} from '../embeds/mirroredEventMessage';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';

import {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from './eventButtons.embedData';
import { getActivityService, getParticipantService } from './eventButtons.services';

const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
const MIRROR_ID_MARKER = 'Mirror ID:';

function hasActivityFooter(footer: string | undefined, activityId: string): boolean {
  return Boolean(footer?.includes(`ID: ${activityId}`));
}

function extractMirrorId(footer: string | undefined): string | undefined {
  if (!footer) {
    return undefined;
  }

  const match = /Mirror ID:\s*([^•\s]+)/.exec(footer);
  return match?.[1];
}

export async function refreshEventEmbed(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  const updated = await getActivityService().getActivityById(activityId);
  if (!updated) {
    await interaction.followUp({
      content: MSG_ACTIVITY_NOT_FOUND,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const participants = await getParticipantService().getParticipants(activityId);
  const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(updated, participants));
  const embedData = buildEmbedDataFromActivity(updated, participants, discordIdMap);
  const embed = buildEventEmbed(embedData);

  const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
  const components = buildEventComponentRows(activityId, { includeManage: isActive });

  await interaction.editReply({
    embeds: [embed],
    components,
  });

  publishMirrorRefresh(activityId);
}

export async function refreshEventEmbedFromChannel(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction | ButtonInteraction,
  activityId: string
): Promise<void> {
  try {
    if (!interaction.channel || !('messages' in interaction.channel)) {
      return;
    }

    const currentMessage =
      'message' in interaction && interaction.message?.embeds?.length
        ? interaction.message
        : undefined;

    const eventMessage = hasActivityFooter(currentMessage?.embeds[0]?.footer?.text, activityId)
      ? currentMessage
      : (await interaction.channel.messages.fetch({ limit: 20 })).find(m =>
          hasActivityFooter(m.embeds[0]?.footer?.text, activityId)
        );

    if (!eventMessage) {
      return;
    }

    const updated = await getActivityService().getActivityById(activityId);
    if (!updated) {
      return;
    }

    const footerText = eventMessage.embeds[0]?.footer?.text;
    const isMirrorMessage = footerText?.includes(MIRROR_ID_MARKER) ?? false;

    if (isMirrorMessage) {
      const mirrorId = extractMirrorId(footerText);
      const embed = await buildMirroredEventEmbed(updated, mirrorId);
      const components = buildMirroredEventComponents(activityId);

      await eventMessage.edit({
        embeds: [embed],
        components,
      });
    } else {
      const participants = await getParticipantService().getParticipants(activityId);
      const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(updated, participants));
      const embedData = buildEmbedDataFromActivity(updated, participants, discordIdMap);
      const embed = buildEventEmbed(embedData);
      const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
      const components = buildEventComponentRows(activityId, { includeManage: isActive });

      await eventMessage.edit({
        embeds: [embed],
        components,
      });
    }

    publishMirrorRefresh(activityId);
  } catch (err: unknown) {
    logger.warn('Failed to refresh event embed from channel', {
      activityId,
      error: getErrorMessage(err),
    });
  }
}
