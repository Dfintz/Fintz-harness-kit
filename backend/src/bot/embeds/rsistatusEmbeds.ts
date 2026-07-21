import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

export function buildRsiStatusRootMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🛰️ RSI Status Monitor')
    .setDescription(
      'Check the current RSI service status, deploy a live-updating panel, or mirror the ' +
        'status into channel names with an emoji.'
    );
}
