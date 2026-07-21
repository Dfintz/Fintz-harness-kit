import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { buildBotAnalyticsSummaryEmbed } from '../embeds/analyticsEmbeds';
import { CommandAnalytics } from '../utils/commandAnalytics';

import { BotCommand } from './types';

const commandAnalytics = CommandAnalytics.getInstance();

export const analytics: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View bot command usage summary (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 10,
  category: 'admin',
  permissions: ['ManageGuild'],
  guildOnly: true,
  // Defer-first (C3): the shared executor acknowledges ephemerally before this
  // handler runs, so the reply stays within Discord's interaction-token window.
  defer: 'ephemeral',

  async execute(interaction: ChatInputCommandInteraction) {
    const stats = commandAnalytics.getSystemStats();

    const successRate =
      stats.totalCommands > 0
        ? ((stats.totalSuccessful / stats.totalCommands) * 100).toFixed(1)
        : '0.0';

    const topList =
      stats.topCommands.length > 0
        ? stats.topCommands
            .slice(0, 5)
            .map((cmd, i) => `${i + 1}. \`/${cmd.command}\` — ${cmd.count.toLocaleString()}`)
            .join('\n')
        : 'No data yet';

    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    const embed = buildBotAnalyticsSummaryEmbed({
      totalCommands: stats.totalCommands,
      successRate,
      averageExecutionTime: stats.averageExecutionTime,
      uptimeHours,
      uptimeMinutes,
      uniqueUsers: stats.uniqueUsers,
      wsPing: interaction.client.ws.ping,
      uniqueGuilds: stats.uniqueGuilds,
      topList,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
