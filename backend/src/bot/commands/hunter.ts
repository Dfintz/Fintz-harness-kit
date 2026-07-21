import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';

import { BountyClaimStatus } from '../../models/BountyClaim';
import { HunterRank } from '../../models/HunterProfile';
import { BountyClaimService, HunterProfileService } from '../../services/bounty';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { resolveGuildContext } from '../utils/guildContext';

import { BotCommand } from './types';

let _services: {
  claimService: BountyClaimService;
  hunterProfileService: HunterProfileService;
} | null = null;

function getServices() {
  _services ??= {
    claimService: new BountyClaimService(),
    hunterProfileService: new HunterProfileService(),
  };
  return _services;
}

/**
 * Get rank emoji
 */
function getRankEmoji(rank: HunterRank): string {
  switch (rank) {
    case HunterRank.LEGENDARY:
      return '👑';
    case HunterRank.ELITE:
      return '💎';
    case HunterRank.VETERAN:
      return '⭐';
    case HunterRank.HUNTER:
      return '🎯';
    case HunterRank.APPRENTICE:
      return '🔰';
    case HunterRank.ROOKIE:
    default:
      return '🆕';
  }
}

/**
 * Get claim status emoji
 */
function getClaimStatusEmoji(status: BountyClaimStatus): string {
  switch (status) {
    case BountyClaimStatus.COMPLETED:
      return '✅';
    case BountyClaimStatus.SUBMITTED:
      return '📤';
    case BountyClaimStatus.ACTIVE:
      return '🟡';
    case BountyClaimStatus.ABANDONED:
      return '🚫';
    case BountyClaimStatus.REJECTED:
      return '❌';
    default:
      return '❓';
  }
}

export const hunter: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('hunter')
    .setDescription('Manage hunter profile and view stats'),

  category: 'social',

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'hunter');
    if (!sub) {
      return;
    }

    const { claimService, hunterProfileService } = getServices();
    const ctx0 = await resolveGuildContext(interaction);
    if (!ctx0) {
      return;
    }
    const guildId = ctx0.organizationId; // Tenant key for bounty/hunter services is organizationId
    const userId = interaction.user.id;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      switch (sub) {
        case 'profile': {
          const profile = await hunterProfileService.getOrCreateProfile(
            guildId,
            userId,
            interaction.user.username
          );
          const rankEmoji = getRankEmoji(profile.rank);
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`${rankEmoji} Hunter Profile`)
            .addFields(
              { name: 'Rank', value: `${rankEmoji} ${profile.rank}`, inline: true },
              { name: 'Reputation', value: `${profile.reputationScore}`, inline: true },
              { name: 'Completed', value: `${profile.totalBountiesCompleted}`, inline: true }
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'myclaims': {
          const claims = await claimService.getClaimsByHunter(userId);
          if (claims.length === 0) {
            await interaction.editReply('\ud83d\udced No bounty claims found.');
            return;
          }
          const lines = claims
            .slice(0, 10)
            .map(
              c =>
                `${getClaimStatusEmoji(c.status)} **${c.bounty?.title || c.bountyId}** \u2014 ${c.status}`
            );
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83d\udccc My Bounty Claims')
            .setDescription(lines.join('\n'))
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'stats': {
          const profile = await hunterProfileService.getOrCreateProfile(
            guildId,
            userId,
            interaction.user.username
          );
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83d\udcca Hunter Statistics')
            .addFields(
              {
                name: 'Bounties Completed',
                value: `${profile.totalBountiesCompleted}`,
                inline: true,
              },
              { name: 'Success Rate', value: `${profile.successRate ?? 0}%`, inline: true },
              { name: 'Reputation', value: `${profile.reputationScore}`, inline: true }
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'board': {
          const lb = await hunterProfileService.getLeaderboard(guildId, 'reputation', 10);
          if (lb.length === 0) {
            await interaction.editReply('\ud83d\udced No hunter data yet.');
            return;
          }
          const lines = lb.map(
            (h, i) =>
              `**${i + 1}.** ${getRankEmoji(h.rank)} ${h.userName ?? 'Unknown'} \u2014 Rep: ${h.reputationScore}`
          );
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83c\udfc6 Hunter Leaderboard')
            .setDescription(lines.join('\n'))
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        default:
          break;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      await interaction.editReply({ content: `\u274c ${msg}` });
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'hunter',
      title: '\ud83c\udfaf Hunter Profile',
      description: 'View your bounty hunter profile, claims, and stats.',
      buttons: [
        {
          subcommand: 'profile',
          label: 'My Profile',
          emoji: '\ud83d\udc64',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'myclaims', label: 'My Claims', emoji: '\ud83d\udccc' },
        { subcommand: 'stats', label: 'Statistics', emoji: '\ud83d\udcca' },
        { subcommand: 'board', label: 'Leaderboard', emoji: '\ud83c\udfc6' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};
