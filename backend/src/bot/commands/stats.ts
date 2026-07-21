import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import { InviteTrackingService } from '../../services/discord/InviteTrackingService';
import { MemberEngagementService } from '../../services/discord/MemberEngagementService';
import {
  buildEngagementLeaderboardEmbed,
  buildInviteLeaderboardEmbed,
  buildUserStatsEmbed,
} from '../embeds/statsEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { deferInteraction } from '../utils/deferInteraction';

import { BotCommand } from './types';

export const stats: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Server engagement statistics and configuration'),

  category: 'utility',

  handleButton: async (interaction: ButtonInteraction) => {
    await handleStatsButton(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    await replyWithCommandPanel(interaction, STATS_PANEL_CONFIG);
  },
};

// ========== Panel Configuration ==========

const STATS_PANEL_PREFIX = 'stats';

const STATS_PANEL_CONFIG: CommandPanelConfig = {
  prefix: STATS_PANEL_PREFIX,
  title: '📊 Server Stats',
  description: 'View engagement statistics, invite tracking, and leaderboards.',
  buttons: [
    { subcommand: 'me', label: 'My Stats', emoji: '👤', style: ButtonStyle.Primary },
    { subcommand: 'invites', label: 'Invites', emoji: '📨' },
    { subcommand: 'leaderboard_msg', label: 'Leaderboard (Messages)', emoji: '💬' },
    { subcommand: 'leaderboard_voice', label: 'Leaderboard (Voice)', emoji: '🎤' },
  ],
};

async function handleStatsButton(interaction: ButtonInteraction): Promise<void> {
  const sub = parsePanelCustomId(interaction.customId, STATS_PANEL_PREFIX);
  if (!sub) {
    return;
  }

  switch (sub) {
    case 'me':
      await handleStatMeFromButton(interaction);
      break;
    case 'invites':
      await handleInvitesFromButton(interaction);
      break;
    case 'leaderboard_msg':
      await handleLeaderboardFromButton(interaction, 'messageCount');
      break;
    case 'leaderboard_voice':
      await handleLeaderboardFromButton(interaction, 'voiceMinutes');
      break;
    default:
      break;
  }
}

async function handleStatMeFromButton(interaction: ButtonInteraction): Promise<void> {
  await deferInteraction(interaction, 'ephemeral');
  try {
    const service = MemberEngagementService.getInstance();
    const stats = await service.getUserStats(interaction.guildId!, interaction.user.id, 30);

    const embed = buildUserStatsEmbed(stats);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `❌ Error: ${msg}` });
  }
}

async function handleInvitesFromButton(interaction: ButtonInteraction): Promise<void> {
  await deferInteraction(interaction, 'ephemeral');
  try {
    const service = InviteTrackingService.getInstance();
    const topInviters = await service.getTopInviters(interaction.guildId!, 10);

    if (topInviters.length === 0) {
      await interaction.editReply({ content: '📭 No invite data yet.' });
      return;
    }

    const embed = buildInviteLeaderboardEmbed(topInviters);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `❌ Error: ${msg}` });
  }
}

async function handleLeaderboardFromButton(
  interaction: ButtonInteraction,
  metric: 'messageCount' | 'voiceMinutes'
): Promise<void> {
  await deferInteraction(interaction, 'ephemeral');
  try {
    const service = MemberEngagementService.getInstance();
    const lb = await service.getLeaderboard(interaction.guildId!, metric, 30, 10);

    if (lb.length === 0) {
      await interaction.editReply({ content: '📭 No engagement data yet.' });
      return;
    }

    const embed = buildEngagementLeaderboardEmbed(lb, metric);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.editReply({ content: `❌ Error: ${msg}` });
  }
}
