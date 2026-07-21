import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { LFGPost } from '../../types';
import { buildAppUrl } from '../utils/appUrls';
import { buildCustomId } from '../utils/customId';
import {
  createProgressBar,
  EmbedColors,
  formatDiscordTimestamp,
  getActivityAccentColor,
  SCFleetEmbed,
  TimestampFormat,
} from '../utils/embedBuilder';
import { getLfgActivityEmoji, getLfgStatusEmoji } from '../utils/emojiMaps';

/**
 * Builds a rich LFG post embed styled after the PublicJobCard component.
 *
 * Visual mapping (PublicJobCard → Discord embed):
 *   accent color bar  → embed side color (activity-type based)
 *   header + owner    → author field (creator name)
 *   title             → embed title with activity emoji
 *   type badge        → inline type field
 *   status badge      → inline status field
 *   description       → embed description (2 lines)
 *   open positions    → progress bar (LinearProgress equivalent)
 *   members           → participant grid
 *   expiry            → timestamp field
 *   posted date       → footer with ID + relative time
 */
/** Truncate text to a max length with an ellipsis. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildLfgEmbed(post: LFGPost): EmbedBuilder {
  const activityEmoji = getLfgActivityEmoji(post.activity);
  const statusEmoji = getLfgStatusEmoji(post.status);
  const isClosed = post.status === 'closed';
  const gameName = post.game ?? 'Star Citizen';

  // ── Accent colour: activity-based or status override ──
  const color = isClosed
    ? EmbedColors.CLOSED
    : post.status === 'full'
      ? EmbedColors.FULL
      : getActivityAccentColor(post.activity);

  // ── Build a compact description block ──
  const descLines: string[] = [
    truncate(decodeHtmlEntities(post.description), 300),
    '', // blank line separator
    `${activityEmoji} \`${post.activity}\`  ${statusEmoji} **${post.status.toUpperCase()}**  🎮 \`${decodeHtmlEntities(gameName)}\``,
  ];

  const builder = SCFleetEmbed.create()
    .setColor(color)
    .setTitle(`${activityEmoji}  LFG: ${decodeHtmlEntities(post.activity)}`)
    .setDescription(descLines.join('\n'))
    .setAuthor({ name: decodeHtmlEntities(post.creatorName) });

  /* ─── Capacity (compact row) ───────────────────────────────────── */
  const progressBar = createProgressBar(post.currentPlayers, post.maxPlayers, {
    width: 12,
    showPercentage: false,
  });
  builder.addFields({
    name: '👥 Open Positions',
    value: `${progressBar}  **${post.currentPlayers}** / **${post.maxPlayers}** players`,
    inline: false,
  });

  /* ─── Expiry + Voice (compact inline row) ──────────────────────── */
  builder.addFields({
    name: '⏰ Expires',
    value: `${formatDiscordTimestamp(post.expiresAt, TimestampFormat.LONG_DATETIME)}\n${formatDiscordTimestamp(post.expiresAt, TimestampFormat.RELATIVE)}`,
    inline: true,
  });

  if (post.voiceChannelId) {
    builder.addFields({
      name: '🎤 Voice Channel',
      value: `<#${post.voiceChannelId}>`,
      inline: true,
    });
  }

  /* ─── Member list (participant grid) ───────────────────────────── */
  if (post.members.length > 0) {
    const lines = post.members.slice(0, 12).map((memberId, i) => `${i + 1}. <@${memberId}>`);
    const overflow = post.members.length > 12 ? `\n*…and ${post.members.length - 12} more*` : '';

    builder.addFields({
      name: `👥 Members (${post.members.length})`,
      value: lines.join('\n') + overflow,
      inline: true,
    });
  }

  /* ─── Servers posted to ────────────────────────────────────────── */
  if (post.postedToServers && post.postedToServers.length > 0) {
    builder.addFields({
      name: '📡 Posted To',
      value: post.postedToServers.map(s => `\`${s}\``).join(' · '),
      inline: false,
    });
  }

  /* ─── Footer: ID + CTA ────────────────────────────────────────── */
  builder
    .setFooter({
      text: isClosed
        ? `ID: ${post.id}  •  This LFG post is closed`
        : `ID: ${post.id}  •  Click a button below to join or leave`,
    })
    .setTimestamp(post.createdAt);

  return builder.build().setURL(buildAppUrl('/lfg'));
}

/**
 * Builds the LFG action row with Join / Leave / Close buttons.
 * CustomId format: lfg_{action}_{postId}
 */
export function buildLfgButtons(postId: string, isClosed = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lfg_join_${postId}`)
      .setLabel('Join')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`lfg_leave_${postId}`)
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪')
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`lfg_close_${postId}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
      .setDisabled(isClosed)
  );
}

/**
 * Parses an LFG button customId.
 * e.g., 'lfg_join_lfg-abc123' → { action: 'join', postId: 'lfg-abc123' }
 */
export function parseLfgButtonId(customId: string): {
  action: 'join' | 'leave' | 'close';
  postId: string;
} | null {
  const match = customId.match(/^lfg_(join|leave|close)_(.+)$/);
  if (!match) {
    return null;
  }
  return {
    action: match[1] as 'join' | 'leave' | 'close',
    postId: match[2],
  };
}

// ─── Post-Game Reputation Rating ────────────────────────────────────────────

/** Star rating labels for display (legacy — kept for backward compat) */
const STAR_LABELS: Record<number, string> = {
  1: '⭐ Poor',
  2: '⭐⭐ Below Average',
  3: '⭐⭐⭐ Average',
  4: '⭐⭐⭐⭐ Good',
  5: '⭐⭐⭐⭐⭐ Excellent',
};

/** Thumb rating labels */
const THUMB_LABELS: Record<string, string> = {
  up: '👍 Positive',
  neutral: '😐 Neutral',
  down: '👎 Negative',
};

/** Map thumb type to numeric rating for ReputationService compatibility */
const THUMB_TO_RATING: Record<string, number> = {
  up: 5,
  neutral: 3,
  down: 1,
};

/**
 * Builds the DM-based post-game rating embed.
 * Sent to each participant's DM after an LFG session closes.
 */
export function buildLfgDmRatingEmbed(post: LFGPost, sessionId: string): EmbedBuilder {
  const activityEmoji = getLfgActivityEmoji(post.activity);

  return SCFleetEmbed.create()
    .setColor(EmbedColors.QUANTUM_GOLD)
    .setTitle(`${activityEmoji} Rate Your Session`)
    .setDescription(
      `**${decodeHtmlEntities(post.activity)}** session has ended!\n` +
        `*"${truncate(decodeHtmlEntities(post.description), 120)}"*\n\n` +
        'Rate each teammate below using the reaction buttons.\n' +
        '👍 Positive · 😐 Neutral · 👎 Negative'
    )
    .addFields({
      name: '👥 Participants',
      value: post.members
        .slice(0, 20)
        .map(m => `<@${m}>`)
        .join(', '),
      inline: false,
    })
    .setFooter({ text: `Session: ${sessionId} • Ratings are anonymous` })
    .setTimestamp()
    .build();
}

/**
 * Builds per-player rating button rows for DM-based rating.
 * Each player gets a row with: 👍 / 😐 / 👎 / 💬 Comment
 *
 * Discord limit: max 5 action rows per message, each with max 5 buttons.
 * Each player needs 1 row (4 buttons), so max 5 players per message.
 * Callers should batch for larger groups.
 *
 * @param sessionId - The LFG session UUID
 * @param targets - Array of { userId, displayName } for players to rate
 * @returns Array of action rows (one per player)
 */
export function buildLfgDmRatingRows(
  sessionId: string,
  targets: Array<{ userId: string; displayName: string }>
): ActionRowBuilder<ButtonBuilder>[] {
  return targets.slice(0, 5).map(target =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_up_${sessionId}_${target.userId}`)
        .setLabel(`👍 ${truncate(decodeHtmlEntities(target.displayName), 20)}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_neutral_${sessionId}_${target.userId}`)
        .setLabel('😐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_down_${sessionId}_${target.userId}`)
        .setLabel('👎')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`lfg_rate_comment_${sessionId}_${target.userId}`)
        .setLabel('💬')
        .setStyle(ButtonStyle.Secondary)
    )
  );
}

/**
 * Builds the "Done Rating" button row for DM-based rating.
 */
export function buildLfgDmDoneButton(sessionId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lfg_rate_done_${sessionId}`)
      .setLabel('Done Rating')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅')
  );
}

/**
 * Builds star rating buttons for a specific user.
 * customId format: lfg_rate_{stars}_{sessionId}_{targetUserId}
 */
export function buildLfgRatingStarButtons(
  sessionId: string,
  targetUserId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[1, 2, 3, 4, 5].map(stars =>
      new ButtonBuilder()
        .setCustomId(`lfg_rate_${stars}_${sessionId}_${targetUserId}`)
        .setLabel(`${'⭐'.repeat(stars)}`)
        .setStyle(
          stars >= 4
            ? ButtonStyle.Success
            : stars >= 3
              ? ButtonStyle.Primary
              : ButtonStyle.Secondary
        )
    )
  );
}

/**
 * Builds the "add details" button row after a quick star rating.
 * Opens a modal for category ratings and comments.
 */
export function buildLfgRatingDetailButton(
  sessionId: string,
  targetUserId: string,
  stars: number
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lfg_rate_detail_${sessionId}_${targetUserId}_${stars}`)
      .setLabel('Add Detailed Feedback')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId(`lfg_rate_done_${sessionId}`)
      .setLabel('Done Rating')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅')
  );
}

/**
 * Parse a rating button customId.
 * Formats:
 *   lfg_rate_thumb_{up|neutral|down}_{sessionId}_{targetUserId}  (DM thumbs)
 *   lfg_rate_comment_{sessionId}_{targetUserId}  (DM comment button)
 *   lfg_rate_{stars}_{sessionId}_{targetUserId}  (legacy star)
 *   lfg_rate_detail_{sessionId}_{targetUserId}_{stars}  (legacy detail)
 *   lfg_rate_done_{sessionId}
 *   lfg_rate_select_{sessionId}  (legacy select menu)
 *
 * sessionId = UUID (36 chars with hyphens)
 * targetUserId = Discord snowflake (numeric)
 */
export function parseLfgRatingId(customId: string): {
  type: 'star' | 'detail' | 'done' | 'select' | 'thumb' | 'comment';
  sessionId: string;
  targetUserId?: string;
  stars?: number;
  thumbType?: 'up' | 'neutral' | 'down';
} | null {
  // lfg_rate_thumb_{up|neutral|down}_{sessionId}_{targetUserId}
  const thumbRe = /^lfg_rate_thumb_(up|neutral|down)_([0-9a-f-]{36})_(\d+)$/;
  const thumbMatch = thumbRe.exec(customId);
  if (thumbMatch) {
    const thumbType = thumbMatch[1] as 'up' | 'neutral' | 'down';
    return {
      type: 'thumb',
      thumbType,
      sessionId: thumbMatch[2],
      targetUserId: thumbMatch[3],
      stars: THUMB_TO_RATING[thumbType],
    };
  }

  // lfg_rate_comment_{sessionId}_{targetUserId}
  const commentRe = /^lfg_rate_comment_([0-9a-f-]{36})_(\d+)$/;
  const commentMatch = commentRe.exec(customId);
  if (commentMatch) {
    return {
      type: 'comment',
      sessionId: commentMatch[1],
      targetUserId: commentMatch[2],
    };
  }

  // lfg_rate_done_{sessionId}
  const doneRe = /^lfg_rate_done_([0-9a-f-]{36})$/;
  const doneMatch = doneRe.exec(customId);
  if (doneMatch) {
    return { type: 'done', sessionId: doneMatch[1] };
  }

  // lfg_rate_detail_{sessionId}_{targetUserId}_{stars}
  const detailRe = /^lfg_rate_detail_([0-9a-f-]{36})_(\d+)_(\d)$/;
  const detailMatch = detailRe.exec(customId);
  if (detailMatch) {
    return {
      type: 'detail',
      sessionId: detailMatch[1],
      targetUserId: detailMatch[2],
      stars: Number.parseInt(detailMatch[3], 10),
    };
  }

  // lfg_rate_select_{sessionId}  (handled by select menu)
  const selectRe = /^lfg_rate_select_([0-9a-f-]{36})$/;
  const selectMatch = selectRe.exec(customId);
  if (selectMatch) {
    return { type: 'select', sessionId: selectMatch[1] };
  }

  // lfg_rate_{stars}_{sessionId}_{targetUserId}
  const starRe = /^lfg_rate_(\d)_([0-9a-f-]{36})_(\d+)$/;
  const starMatch = starRe.exec(customId);
  if (starMatch) {
    return {
      type: 'star',
      sessionId: starMatch[2],
      targetUserId: starMatch[3],
      stars: Number.parseInt(starMatch[1], 10),
    };
  }

  return null;
}

// ==================== TEAM SUGGESTION EMBEDS ====================

/**
 * Build an embed suggesting team creation for frequent positive co-players.
 */
export function buildTeamSuggestionEmbed(
  matchedUsers: Array<{ userId: string; sharedSessionCount: number }>
): EmbedBuilder {
  const playerList = matchedUsers
    .map(m => `• <@${m.userId}> — ${m.sharedSessionCount} sessions together`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle('🎯 Team Suggestion')
    .setDescription(
      `You've played well with these players across multiple sessions with mutual positive feedback!\n\n${playerList}\n\nWould you like to form a team/unit together?`
    )
    .setColor(0x00bcd4) // Teal
    .setFooter({ text: 'Teams help you organize recurring groups' })
    .setTimestamp();
}

/**
 * Build action row buttons for team suggestion (Create / Maybe Later / Don't Suggest).
 * @param guildId Discord guild (for org resolution)
 * @param matchedUserIds User IDs to include in the team (joined with -)
 */
export function buildTeamSuggestionButtons(
  guildId: string,
  matchedUserIds: string[]
): ActionRowBuilder<ButtonBuilder> {
  const idList = matchedUserIds.join('-');
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('lfg', 'team', 'create', guildId, idList))
      .setLabel('Create Team')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎯'),
    new ButtonBuilder()
      .setCustomId(buildCustomId('lfg', 'team', 'later', guildId))
      .setLabel('Maybe Later')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏰'),
    new ButtonBuilder()
      .setCustomId(buildCustomId('lfg', 'team', 'dismiss', guildId))
      .setLabel("Don't Suggest Again")
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔇')
  );
}

export { STAR_LABELS, THUMB_LABELS, THUMB_TO_RATING };
