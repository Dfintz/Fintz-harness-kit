import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import { ActivityType } from '../../models/Activity';
import { OpportunitySearchService } from '../../services/search/OpportunitySearchService';
import { SocialGroupService } from '../../services/social';
import { LFGActivity } from '../../types';
import {
  buildActiveLfgGroupsEmbed,
  buildDiscoveredOpportunitiesEmbed,
  buildLfgStatsEmbed,
  buildNoGroupsFoundEmbed,
  buildNoOpportunitiesEmbed,
} from '../embeds/discoverEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { deferInteraction } from '../utils/deferInteraction';
import {
  getLfgActivityEmoji as getActivityEmoji,
  getLfgStatusEmoji as getStatusEmoji,
} from '../utils/emojiMaps';

import { BotCommand } from './types';

let _services: {
  lfgService: SocialGroupService;
  opportunityService: OpportunitySearchService;
} | null = null;

function getServices() {
  _services ??= {
    lfgService: SocialGroupService.getInstance(),
    opportunityService: new OpportunitySearchService(),
  };
  return _services;
}

export const discover: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('discover')
    .setDescription('Discover opportunities, groups, and activities'),

  cooldown: 5,
  category: 'social',
  examples: [
    '/discover opportunities',
    '/discover opportunities type:Jobs search:"cargo hauling"',
    '/discover opportunities activity_type:Mission open_slots:True',
    '/discover groups activity:Mining',
    '/discover stats',
    '/discover stats user:@SomeUser',
  ],
  guildOnly: true,

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'discover');
    if (!sub) {
      return;
    }

    try {
      if (sub === 'opportunities') {
        await handleOpportunities(interaction);
      } else if (sub === 'groups') {
        await handleGroups(interaction);
      } else if (sub === 'stats') {
        await handleStats(interaction);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'discover',
      title: '\ud83d\udd0d Discovery Hub',
      description: 'Find opportunities, groups, and activities across the platform.',
      buttons: [
        {
          subcommand: 'opportunities',
          label: 'Browse Opportunities',
          emoji: '\ud83d\udcbc',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'groups', label: 'Find Groups', emoji: '\ud83c\udfae' },
        { subcommand: 'stats', label: 'My Stats', emoji: '\ud83d\udcca' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

// ==================== SUBCOMMAND HANDLERS ====================

async function handleOpportunities(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  await deferInteraction(interaction, 'reply');

  const sourceType = interaction.isChatInputCommand()
    ? ((interaction.options.getString('type') as 'all' | 'job' | 'activity' | null) ?? 'all')
    : 'all';
  const searchTerm = interaction.isChatInputCommand()
    ? (interaction.options.getString('search') ?? undefined)
    : undefined;
  const activityType = interaction.isChatInputCommand()
    ? (interaction.options.getString('activity_type') as ActivityType | null)
    : null;
  const hasOpenSlots = interaction.isChatInputCommand()
    ? (interaction.options.getBoolean('open_slots') ?? undefined)
    : undefined;

  const result = await getServices().opportunityService.searchOpportunities(
    {
      sourceType,
      searchTerm,
      activityTypes: activityType ? [activityType] : undefined,
      hasOpenSlots: hasOpenSlots || undefined,
    },
    { page: 1, limit: 10 }
  );

  if (result.data.length === 0) {
    await interaction.editReply({
      embeds: [buildNoOpportunitiesEmbed()],
    });
    return;
  }

  const lines = result.data.map((item, i) => {
    const icon = item.sourceType === 'job' ? '💼' : '🎮';
    const status = item.isActive ? '🟢' : '🔴';
    let slots = '';
    if (item.sourceType === 'job') {
      if (item.crewSpotsTotal) {
        slots = `${item.crewSpotsFilled ?? 0}/${item.crewSpotsTotal} crew`;
      }
    } else if (item.maxParticipants) {
      slots = `${item.currentParticipants ?? 0}/${item.maxParticipants} players`;
    }

    const slotsDisplay = slots ? ` (${slots})` : '';
    const description = item.description?.slice(0, 80) || 'No description';
    const organizationSuffix = item.organizationName ? ` — *${item.organizationName}*` : '';

    return `**${i + 1}.** ${status} ${icon} **${item.title}**${slotsDisplay}\n> ${description}${organizationSuffix}`;
  });

  const embed = buildDiscoveredOpportunitiesEmbed(lines, {
    total: result.pagination.total,
    page: result.pagination.page,
    totalPages: result.pagination.totalPages,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleGroups(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  await deferInteraction(interaction, 'reply');

  const activity = interaction.isChatInputCommand()
    ? (interaction.options.getString('activity') as LFGActivity | null)
    : null;
  const allPosts = await getServices().lfgService.getAllActivePosts();

  let filtered = allPosts;
  if (activity) {
    filtered = allPosts.filter(post => post.activity === activity);
  }

  // Only show posts from this guild
  const guildId = interaction.guildId;
  if (guildId) {
    filtered = filtered.filter(post => post.guildId === guildId);
  }

  // Only show open posts
  filtered = filtered.filter(post => post.status === 'open');

  if (filtered.length === 0) {
    const desc = activity
      ? `No open LFG groups found for **${getActivityEmoji(activity)} ${activity}**. Try creating one with \`/lfg create\`!`
      : 'No open LFG groups found in this server. Try creating one with `/lfg create`!';

    await interaction.editReply({
      embeds: [buildNoGroupsFoundEmbed(desc)],
    });
    return;
  }

  // Sort by newest first, limit to 10
  const sortedPosts = [...filtered];
  sortedPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const sorted = sortedPosts.slice(0, 10);

  const lines = sorted.map((post, i) => {
    const emoji = getActivityEmoji(post.activity);
    const statusEmoji = getStatusEmoji(post.status);
    const timeLeft = Math.max(0, Math.round((post.expiresAt.getTime() - Date.now()) / 60000));
    return `**${i + 1}.** ${statusEmoji} ${emoji} **${post.activity}** — ${post.description.slice(0, 60)}\n> 👥 ${post.currentPlayers}/${post.maxPlayers} players • ⏱️ ${timeLeft}m left • ID: \`${post.id}\``;
  });

  const embed = buildActiveLfgGroupsEmbed(lines, filtered.length);

  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  await deferInteraction(interaction, 'reply');

  const targetUser = interaction.isChatInputCommand()
    ? (interaction.options.getUser('user') ?? interaction.user)
    : interaction.user;
  const stats = await getServices().lfgService.getUserStats(targetUser.id);

  const embed = buildLfgStatsEmbed(targetUser.displayName, targetUser.displayAvatarURL(), stats);

  await interaction.editReply({ embeds: [embed] });
}
