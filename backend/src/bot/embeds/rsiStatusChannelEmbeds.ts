import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

export function buildRsiStatusChannelMenuEmbed(
  applicationLine: string,
  serverLine: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🏷️ RSI Status Channels')
    .setDescription(
      [
        'Show RSI status as a channel name with a status emoji that auto-updates every 5 minutes.',
        '',
        '• 🟢 Operational · 🟡 Degraded · 🔧 Maintenance · 🔴 Outage · ⚪ Unknown',
        '',
        '**Create channels** — the bot makes two locked voice channels for you.',
        '**Use existing** — search and pick a channel below; the bot keeps its name in sync.',
        '',
        applicationLine,
        serverLine,
      ].join('\n')
    )
    .setFooter({ text: 'Requires the Manage Channels permission.' });
}
