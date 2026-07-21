import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';

import { Activity } from '../../models/Activity';
import { ActivityParticipantService } from '../../services/activity';
import {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from '../interactions/eventButtons';

import {
  buildEventActionsRow,
  buildEventButtons,
  buildEventComponentRows,
  buildEventEmbed,
} from './eventEmbed';

let _activityParticipantService: ActivityParticipantService | null = null;

function getActivityParticipantService(): ActivityParticipantService {
  _activityParticipantService ??= new ActivityParticipantService();
  return _activityParticipantService;
}

/**
 * Build the full mirrored event embed using the same data pipeline as normal events.
 * This keeps ships, crew, role requirements, and participant sections in sync.
 */
export async function buildMirroredEventEmbed(
  activity: Activity,
  mirrorId?: string
): Promise<EmbedBuilder> {
  const participants = await getActivityParticipantService().getParticipants(activity.id);
  const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(activity, participants));

  const embedData = buildEmbedDataFromActivity(activity, participants, discordIdMap);
  if (!embedData.title.startsWith('Mirrored:')) {
    embedData.title = `Mirrored: ${embedData.title}`;
  }

  const embed = buildEventEmbed(embedData);
  const footerNotes: string[] = [];

  if (mirrorId) {
    footerNotes.push(`Mirror ID: ${mirrorId}`);
  }
  footerNotes.push('RSVP syncs across servers');

  const existingFooter = embed.data.footer?.text?.trim();
  embed.setFooter({
    text: existingFooter
      ? `${existingFooter}  •  ${footerNotes.join('  •  ')}`
      : footerNotes.join('  •  '),
  });

  const inviteCode = activity.metadata?.mirrorInviteCode;
  if (typeof inviteCode === 'string' && inviteCode.trim().length > 0) {
    embed.addFields({
      name: '🎟️ Invite Code',
      value: `\`${inviteCode}\``,
      inline: true,
    });
  }

  return embed;
}

/** Build action rows for mirrored events (same interaction model as normal events). */
export function buildMirroredEventComponents(
  activityId: string
): [ActionRowBuilder<ButtonBuilder>, ActionRowBuilder<ButtonBuilder>] {
  return [buildEventButtons(activityId), buildEventActionsRow(activityId)];
}

/**
 * Build the source (non-mirrored) event embed + components for an activity.
 *
 * Used by the cross-shard mirror sync handler to refresh the SOURCE announcement
 * message whenever a mutation originates from a mirror (or anywhere else),
 * keeping origin and mirrors in lockstep.
 */
export async function buildSourceEventMessage(
  activity: Activity
): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const participants = await getActivityParticipantService().getParticipants(activity.id);
  const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(activity, participants));
  const embedData = buildEmbedDataFromActivity(activity, participants, discordIdMap);
  const embed = buildEventEmbed(embedData);

  const status = (activity.status ?? '').toLowerCase();
  const isActive = !['cancelled', 'completed'].includes(status);
  const components = buildEventComponentRows(activity.id, { includeManage: isActive });

  return { embed, components };
}
