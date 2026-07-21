import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

export function buildCommunityHubEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🎉 Community Tools')
    .setDescription(
      [
        'Manage engagement tools for your server.',
        '',
        '🎁 **Giveaways** — Create and manage prize giveaways',
        '🗳️ **Polls** — Run polls and view results',
        '📢 **Announcements** — Draft, schedule, and send announcements',
        '📝 **Custom Embeds** — Create and send rich embed messages',
        '🎭 **Reaction Roles** — Button-based self-assignment role panels',
      ].join('\n')
    )
    .setFooter({ text: 'Click a button below to open that tool' })
    .setTimestamp();
}

export function buildCommunityGiveawaysEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🎁 Giveaways')
    .setDescription('Create and manage giveaways.');
}

export function buildCommunityPollsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🗳️ Polls')
    .setDescription('Create and manage organization polls.');
}

export function buildCommunityAnnouncementsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('📢 Announcements')
    .setDescription('Create, manage, and send announcements.');
}

export function buildCommunityCustomEmbedsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('📝 Custom Embeds')
    .setDescription('Create and send custom embed messages.');
}

export function buildCommunityReactionRolesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🎭 Reaction Roles')
    .setDescription('Create button-based role self-assignment panels.');
}
