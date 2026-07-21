import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

/**
 * Build the personal engagement-stats embed (messages + voice over the last 30 days).
 */
export function buildUserStatsEmbed(stats: {
  messageCount: number;
  voiceMinutes: number;
}): EmbedBuilder {
  const voiceHours = Math.floor(stats.voiceMinutes / 60);
  const voiceMins = stats.voiceMinutes % 60;

  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle('\u{1F4CA} Your Engagement Stats (30 days)')
    .addFields(
      { name: '\u{1F4AC} Messages', value: `${stats.messageCount}`, inline: true },
      { name: '\u{1F3A4} Voice', value: `${voiceHours}h ${voiceMins}m`, inline: true }
    )
    .setTimestamp();
}

/**
 * Build the invite-leaderboard embed from the top inviters.
 */
export function buildInviteLeaderboardEmbed(
  topInviters: { inviterUserId: string; count: number }[]
): EmbedBuilder {
  const lines = topInviters.map(
    (e, i) =>
      `**${i + 1}.** <@${e.inviterUserId}> \u2014 ${e.count} invite${e.count !== 1 ? 's' : ''}`
  );

  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle('\u{1F4E8} Invite Leaderboard')
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

/**
 * Build the engagement-leaderboard embed for a given metric (messages or voice).
 */
export function buildEngagementLeaderboardEmbed(
  entries: { userId: string; total: number }[],
  metric: 'messageCount' | 'voiceMinutes'
): EmbedBuilder {
  const metricLabel = metric === 'messageCount' ? '\u{1F4AC} Messages' : '\u{1F3A4} Voice';
  const lines = entries.map((entry, i) => {
    const value =
      metric === 'voiceMinutes'
        ? `${Math.floor(entry.total / 60)}h ${entry.total % 60}m`
        : `${entry.total}`;
    return `**${i + 1}.** <@${entry.userId}> \u2014 ${value}`;
  });

  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle(`\u{1F4CA} ${metricLabel} Leaderboard (30 days)`)
    .setDescription(lines.join('\n'))
    .setTimestamp();
}
