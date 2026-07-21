import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { logger } from '../../utils/logger';
import { handleCommandError } from '../utils/commandErrorHandler';

import { BotCommand } from './types';

export const ping: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and response time'),

  cooldown: 5, // 5 seconds cooldown
  category: 'utility',
  examples: ['/ping'],
  guildOnly: false,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const wsLatency = interaction.client.ws.ping;
      let status: string;
      if (wsLatency < 200) {
        status = 'Excellent';
      } else if (wsLatency < 500) {
        status = 'Good';
      } else {
        status = 'Slow';
      }

      await interaction.editReply(
        `🏓 **Pong!**\n` +
          `📡 **Bot Latency:** ${latency}ms\n` +
          `💓 **WebSocket Latency:** ${wsLatency}ms\n` +
          `✅ **Status:** ${status}`
      );
    } catch (error: unknown) {
      logger.error(
        'Error in PingCommand.execute',
        error instanceof Error ? error : new Error(String(error))
      );
      await handleCommandError(interaction, error, 'PingCommand.execute');
    }
  },
};
