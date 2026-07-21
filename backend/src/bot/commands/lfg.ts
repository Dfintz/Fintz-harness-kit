import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { VoiceChannelService } from '../../services/communication';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { buildRateLimitKey } from '../../services/shared/rateLimitPolicy';
import { redisRateLimiter } from '../../services/shared/RedisRateLimiter';
import { SocialGroupService } from '../../services/social';
import { ReputationService } from '../../services/social/ReputationService';
import { LFGActivity, LFGPost, VoiceChannelType } from '../../types';
import { logger } from '../../utils/logger';
import { buildLfgButtons, buildLfgEmbed, parseLfgRatingId } from '../embeds/lfgEmbed';
import {
  buildVoiceControlButtons,
  buildVoiceExtendedButtons,
  buildVoiceInterfaceEmbed,
  buildVoiceModerationButtons,
} from '../embeds/voiceInterfaceEmbed';
import {
  handleLfgButton,
  handleLfgCommentModal,
  handleLfgRatingButton,
  handleLfgRatingModal,
  handleLfgRatingSelect,
  handleTeamSuggestionButton,
} from '../interactions/lfgButtons';
import {
  buildCommandPanel,
  type CommandPanelConfig,
  parsePanelCustomId,
} from '../utils/commandPanelBuilder';
import { dmAwareEditReply } from '../utils/dmAwareReply';
import {
  getLfgActivityEmoji as getActivityEmoji,
  getLfgStatusEmoji as getStatusEmoji,
} from '../utils/emojiMaps';
import { buildPaginationRow, paginate } from '../utils/paginationControls';
import { buildLfgActivitySelect } from '../utils/sharedChoices';
import { LfgPresenceMonitor } from '../voice/lfgPresenceMonitor';

import { BotCommand } from './types';

let _lfgService: SocialGroupService | null = null;

function getLfgService(): SocialGroupService {
  _lfgService ??= SocialGroupService.getInstance();
  return _lfgService;
}

let _repService: ReputationService | null = null;

function getReputationService(): ReputationService {
  _repService ??= new ReputationService();
  return _repService;
}

// Anti-spam limits enforced via the shared distributed RedisRateLimiter so
// counters are consistent across bot shards and survive process restarts.
// Keys are namespaced as `lfg:post:{guildId}:{userId}` and
// `lfg:join:{guildId}:{userId}` for per-tenant scoping.
const POST_LIMIT_PER_HOUR = 3;
export const JOIN_LIMIT_PER_HOUR = 15;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

// ── Pre-modal state: stores LFG activity chosen via select menu ──
interface PendingLfgCreate {
  activity: LFGActivity;
  timestamp: number;
}

const pendingLfgCreates = new Map<string, PendingLfgCreate>();
const PENDING_LFG_TTL_MS = 10 * 60 * 1000;

function cleanPendingLfgCreates(): void {
  const now = Date.now();
  for (const [key, val] of pendingLfgCreates) {
    if (now - val.timestamp > PENDING_LFG_TTL_MS) {
      pendingLfgCreates.delete(key);
    }
  }
}

export function lfgPostRateLimitKey(guildId: string | null | undefined, userId: string): string {
  return buildRateLimitKey('lfg', 'post', guildId ?? 'DM', userId);
}

export function lfgJoinRateLimitKey(guildId: string | null | undefined, userId: string): string {
  return buildRateLimitKey('lfg', 'join', guildId ?? 'DM', userId);
}

async function resolveGuildScopedSettings(
  guildId: string
): Promise<Awaited<ReturnType<typeof discordSettingsService.getSettings>> | null> {
  try {
    const organizationId = await GuildOrganizationService.getInstance()
      .resolveOrganization(guildId)
      .catch(() => null);
    if (organizationId) {
      const orgScoped = await discordSettingsService.getSettings(organizationId, guildId);
      if (orgScoped) {
        return orgScoped;
      }
    }

    const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
    return allSettings?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function _resolveLfgMentionRoleIdForGuild(
  guildId: string
): Promise<string | undefined> {
  try {
    const guildSettings = await resolveGuildScopedSettings(guildId);
    return guildSettings?.lfgSettings?.lfgMentionRoleId ?? undefined;
  } catch (error: unknown) {
    logger.debug('LFG: failed to resolve mention role from guild settings', {
      guildId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

// ==================== PANEL BUTTON HANDLERS ====================

/** customId prefix for active-LFG-list page navigation: `lfg_listpage_<page>`. */
const LFG_LIST_PAGE_PREFIX = 'lfg_listpage_';
const LFG_LIST_PAGE_SIZE = 10;

/**
 * Build the embed + pagination controls for one page of the active-LFG list.
 * Pure — the caller decides whether to `dmAwareEditReply` (initial) or
 * `interaction.update` (paging). The list is fetched in full and paginated
 * client-side (active posts per guild are naturally bounded). Exported for unit
 * testing (lfg.ts has heavy service imports, so the pure view is tested directly).
 */
export function _buildLfgListView(
  posts: LFGPost[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(posts, page, LFG_LIST_PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('\ud83c\udfae Active LFG Posts')
    .setDescription(`Found ${total} active LFG post(s)`)
    .setTimestamp();

  for (const post of pageItems) {
    const statusIcon = getStatusEmoji(post.status);
    const activityIcon = getActivityEmoji(post.activity);

    embed.addFields({
      name: `${activityIcon} ${post.activity} - ${post.description}`,
      value:
        `**ID:** ${post.id}\n` +
        `**Creator:** ${post.creatorName}\n` +
        `**Players:** ${post.currentPlayers}/${post.maxPlayers} ${statusIcon}\n` +
        `**Expires:** <t:${Math.floor(post.expiresAt.getTime() / 1000)}:R>`,
      inline: false,
    });
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} posts` });
  }

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage => `${LFG_LIST_PAGE_PREFIX}${targetPage}`,
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

async function handlePanelList(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId || 'DM';
  const activePosts = await getLfgService().getActivePostsByGuild(guildId);

  if (activePosts.length === 0) {
    await interaction.editReply('\ud83d\udd0d No active LFG posts in this server at the moment.');
    return;
  }

  await dmAwareEditReply(interaction, _buildLfgListView(activePosts, 0));
}

/** Page through the active-LFG list via the shared pagination row. */
async function handleLfgListPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = Number.parseInt(interaction.customId.slice(LFG_LIST_PAGE_PREFIX.length), 10);
  // Ignore a non-numeric/negative page (the disabled control emits `..._-1`).
  if (Number.isNaN(page) || page < 0) {
    return;
  }

  const guildId = interaction.guildId || 'DM';
  const activePosts = await getLfgService().getActivePostsByGuild(guildId);

  if (activePosts.length === 0) {
    // The list emptied out since it was opened — collapse the controls.
    await interaction.update({
      content: '\ud83d\udd0d No active LFG posts in this server at the moment.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Edit the existing ephemeral list message in place (no new reply).
  await interaction.update(_buildLfgListView(activePosts, page));
}

async function handlePanelCreate(interaction: ButtonInteraction): Promise<void> {
  // Step 1: Show activity type select before the creation modal
  const row = buildLfgActivitySelect('lfg_select_create_activity');
  await interaction.reply({
    content: '🎮 **Create LFG Post** — What activity are you looking for?',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handlePanelMatch(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('\u274c This command can only be used in a server.');
    return;
  }

  const userId = interaction.user.id;
  const allPosts: LFGPost[] = await getLfgService().getActivePostsByGuild(interaction.guildId);

  let matchedPosts = allPosts.filter(
    (p: LFGPost) => p.status === 'open' && !p.members.includes(userId)
  );

  // Sort by available slots (most available first)
  matchedPosts.sort(
    (a: LFGPost, b: LFGPost) => b.maxPlayers - b.currentPlayers - (a.maxPlayers - a.currentPlayers)
  );
  matchedPosts = matchedPosts.slice(0, 5);

  if (matchedPosts.length === 0) {
    await interaction.editReply('\ud83d\udd0d No matching LFG posts found. Try creating one!');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('\ud83c\udfaf LFG Matches')
    .setDescription(`Found **${matchedPosts.length}** matching post(s):`)
    .setTimestamp();

  for (const post of matchedPosts) {
    const slotsLeft = post.maxPlayers - post.currentPlayers;
    embed.addFields({
      name: `${getActivityEmoji(post.activity)} ${post.activity} \u2014 ${slotsLeft} slot(s) left`,
      value: `${post.description}\n\ud83c\udd94 \`${post.id}\` \u00b7 ${getStatusEmoji(post.status)} ${post.status.toUpperCase()} \u00b7 \ud83d\udc65 ${post.currentPlayers}/${post.maxPlayers}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handlePanelReputation(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('\u274c This command can only be used in a server.');
    return;
  }

  const targetUser = interaction.user;

  try {
    // Resolve the org bound to this guild so trust scores can blend into the result.
    // Falls back to null when the guild isn't linked — getUnifiedReputation handles that.
    const organizationId = await GuildOrganizationService.getInstance()
      .resolveOrganization(interaction.guildId)
      .catch(() => null);

    const unified = await getReputationService().getUnifiedReputation(
      targetUser.id,
      organizationId ?? undefined
    );

    const tierLabel = unified.userReputation.tier; // e.g. "\ud83c\udfc6 Legendary"
    const totalSessions = unified.userReputation.totalSessions;
    const successRate = Math.round(unified.userReputation.successRate ?? 0);
    const avgRating = unified.userReputation.averageRating?.toFixed(1) ?? 'N/A';
    const score = unified.combinedScore;

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`LFG Reputation: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '\ud83c\udfc5 Tier', value: tierLabel, inline: true },
        { name: '\ud83d\udcca Combined Score', value: `${score}/100`, inline: true },
        { name: '\ud83c\udfae Sessions', value: `${totalSessions}`, inline: true },
        { name: '\u2705 Success Rate', value: `${successRate}%`, inline: true },
        { name: '\u2b50 Avg Rating', value: avgRating, inline: true }
      )
      .setFooter({ text: 'Reputation is based on your full LFG history' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    logger.error('ReputationService unavailable, falling back to active-post heuristic', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: targetUser.id,
      guildId: interaction.guildId,
    });
    // Fallback: use historical session count from DB for a more accurate tier
    let totalActivity = 0;
    try {
      const history = await getLfgService().getUserHistory(targetUser.id, 1000);
      totalActivity = history.length;
    } catch {
      // If DB is also unavailable, fall back to active posts only
      const activePosts: LFGPost[] = await getLfgService().getActivePostsByGuild(
        interaction.guildId
      );
      totalActivity =
        activePosts.filter((p: LFGPost) => p.creatorId === targetUser.id).length +
        activePosts.filter((p: LFGPost) => p.members.includes(targetUser.id)).length;
    }

    let tier: string;
    let tierEmoji: string;
    if (totalActivity >= 50) {
      tier = 'Legendary';
      tierEmoji = '\ud83c\udfc6';
    } else if (totalActivity >= 25) {
      tier = 'Veteran';
      tierEmoji = '\u2b50';
    } else if (totalActivity >= 10) {
      tier = 'Active';
      tierEmoji = '\ud83c\udf96\ufe0f';
    } else if (totalActivity >= 3) {
      tier = 'Regular';
      tierEmoji = '\ud83d\udd35';
    } else {
      tier = 'Newcomer';
      tierEmoji = '\ud83c\udd95';
    }

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`${tierEmoji} LFG Reputation: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '\ud83c\udfc5 Tier', value: `${tierEmoji} ${tier}`, inline: true },
        { name: '\ud83d\udcca Total Sessions', value: `${totalActivity}`, inline: true }
      )
      .setFooter({ text: 'Reputation based on session history (detailed stats unavailable)' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handlePanelSettings(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('\u274c This command can only be used in a server.');
    return;
  }

  const currentSettings = await resolveGuildScopedSettings(interaction.guildId);
  const current = currentSettings?.lfgSettings;
  const gameFiltersText = current?.gameFilters?.length
    ? current.gameFilters.map((g: string) => `\`${g}\``).join(', ')
    : '*(Star Citizen only)*';
  const otherGamesChannelText = current?.otherGamesChannelId
    ? `<#${current.otherGamesChannelId}>`
    : '*(not set)*';
  const publicLfgChannelText = current?.publicLfgChannelId
    ? `<#${current.publicLfgChannelId}>`
    : '*(not set)*';
  const publicOptInRoleText = current?.publicLfgOptInRoleId
    ? `<@&${current.publicLfgOptInRoleId}>`
    : '*(all members)*';
  const mentionRoleText = current?.lfgMentionRoleId
    ? `<@&${current.lfgMentionRoleId}>`
    : '*(none — no role pinged)*';

  const lines: string[] = [
    '**LFG Settings:**',
    `\u2022 Default Game: \`${current?.defaultGame ?? 'Star Citizen'}\``,
    `\u2022 Game Filters: ${gameFiltersText}`,
    `\u2022 Other Games Channel: ${otherGamesChannelText}`,
    `\u2022 Public LFG: ${current?.publicLfgEnabled ? '**Enabled**' : '**Disabled**'}`,
    `\u2022 Public Delivery: \`${current?.publicLfgDelivery ?? 'dm'}\``,
    `\u2022 Public LFG Channel: ${publicLfgChannelText}`,
    `\u2022 Public Opt-in Role: ${publicOptInRoleText}`,
    `\u2022 LFG Mention Role: ${mentionRoleText}`,
    '',
    '*Use admin-level slash commands for advanced settings changes.*',
  ];

  await interaction.editReply(lines.join('\n'));
}

// ==================== AUTO-LFG HANDLER ====================

async function handlePanelAutoLfg(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('\u274c This command can only be used in a server.');
    return;
  }

  const monitor = LfgPresenceMonitor.getInstance();
  const isOptedIn = monitor.isOptedIn(interaction.user.id, interaction.guildId);

  if (isOptedIn) {
    monitor.optOut(interaction.user.id, interaction.guildId);
    await interaction.editReply(
      '\u274c **Auto-LFG disabled.** You will no longer get automatic LFG posts when you start playing a game in voice chat.'
    );
  } else {
    monitor.optIn(interaction.user.id, interaction.guildId, { maxPlayers: 4 });
    await interaction.editReply(
      '\u2705 **Auto-LFG enabled!** When you start playing a game while in a voice channel, ' +
        'an LFG post will be created automatically so others can join you.\n\n' +
        '*Click Auto-LFG again to disable.*'
    );
  }
}

// ==================== SMART PING HANDLER ====================

async function handlePanelSmartPing(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('\u274c This command can only be used in a server.');
    return;
  }

  const settings = await resolveGuildScopedSettings(interaction.guildId);

  const ping = settings?.smartLfgPingSettings;
  const enabled = ping?.enabled ?? false;
  const optInRoleText = ping?.optInRoleId ? `<@&${ping.optInRoleId}>` : '*(all members)*';

  const lines: string[] = [
    `\ud83d\udd14 **Smart LFG Ping:** ${enabled ? '\u2705 Enabled' : '\u274c Disabled'}`,
    '',
    'When enabled, the bot will intelligently ping members who might be interested when a new LFG post matches their activity preferences.',
    '',
    `\u2022 Cooldown: **${ping?.cooldownHours ?? 8}h** between pings`,
    `\u2022 Max pings per post: **${ping?.maxPingsPerPost ?? 5}**`,
    `\u2022 Opt-in role: ${optInRoleText}`,
    '',
    'Use `/notify` → **LFG Toggle** to enable/disable, or **LFG Config** to change settings.',
  ];

  await interaction.editReply(lines.join('\n'));
}

// ==================== COMMAND DEFINITION ====================

export const lfg: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Looking For Group - Quick group formation'),

  cooldown: 5,
  category: 'social',
  examples: ['/lfg'],
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'lfg',
      title: '\ud83c\udfae Looking for Group',
      description:
        'Find or create groups for Star Citizen activities.\nClick a button below to get started.',
      buttons: [
        {
          subcommand: 'list',
          label: 'Browse Groups',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'create',
          label: 'Create Group',
          emoji: '\u2795',
          style: ButtonStyle.Success,
        },
        { subcommand: 'match', label: 'Find Match', emoji: '\ud83c\udfaf' },
        { subcommand: 'autolfg', label: 'Auto-LFG', emoji: '\ud83e\udd16' },
        { subcommand: 'smartping', label: 'Smart Ping', emoji: '\ud83d\udd14' },
        { subcommand: 'reputation', label: 'My Reputation', emoji: '\u2b50' },
        { subcommand: 'settings', label: 'LFG Settings', emoji: '\u2699\ufe0f' },
      ],
    };
    // Panel is visible to all — button responses are ephemeral
    const { embed, components } = buildCommandPanel(panelConfig);
    await interaction.reply({ embeds: [embed], components });

    // Auto-capture the panel's channel as the canonical LFG channel for this
    // guild so Auto-LFG (presence-triggered) knows where to post. Only set
    // when not already configured — admins can override via /lfg settings.
    if (interaction.guildId && interaction.channelId) {
      try {
        const organizationId = await GuildOrganizationService.getInstance()
          .resolveOrganization(interaction.guildId)
          .catch(() => null);
        if (organizationId) {
          const guildSettings = await resolveGuildScopedSettings(interaction.guildId);
          const current = guildSettings?.lfgNetworkSettings as
            { lfgChannelId?: string } | undefined;
          if (!current?.lfgChannelId) {
            await discordSettingsService.updateLfgSettings(
              organizationId,
              interaction.guildId,
              { lfgChannelId: interaction.channelId },
              interaction.user.id
            );
            logger.info(
              `LFG: captured panel channel ${interaction.channelId} as lfgChannelId for guild ${interaction.guildId}`
            );
          }
        }
      } catch (err) {
        logger.debug('LFG: failed to auto-capture panel channel as lfgChannelId', {
          error: err instanceof Error ? err.message : String(err),
          guildId: interaction.guildId,
        });
      }
    }
  },

  /**
   * Handles LFG button interactions (panel + join / leave / close / rating / team).
   * Dispatched by the interaction router when a button with prefix 'lfg' is clicked.
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    // 1. Panel buttons (lfg_panel_*)
    const panelSub = parsePanelCustomId(interaction.customId, 'lfg');
    if (panelSub) {
      try {
        if (panelSub === 'list') {
          await handlePanelList(interaction);
        } else if (panelSub === 'create') {
          await handlePanelCreate(interaction);
        } else if (panelSub === 'match') {
          await handlePanelMatch(interaction);
        } else if (panelSub === 'reputation') {
          await handlePanelReputation(interaction);
        } else if (panelSub === 'autolfg') {
          await handlePanelAutoLfg(interaction);
        } else if (panelSub === 'smartping') {
          await handlePanelSmartPing(interaction);
        } else if (panelSub === 'settings') {
          await handlePanelSettings(interaction);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    // 1b. Active-LFG-list pagination (lfg_listpage_<n>) — edits the ephemeral list in place.
    if (interaction.customId.startsWith(LFG_LIST_PAGE_PREFIX)) {
      await handleLfgListPageButton(interaction);
      return;
    }

    // 2. Team suggestion buttons (lfg_team_*)
    if (interaction.customId.startsWith('lfg_team_')) {
      await handleTeamSuggestionButton(interaction);
      return;
    }
    // 3. Rating buttons (lfg_rate_*)
    if (parseLfgRatingId(interaction.customId)) {
      await handleLfgRatingButton(interaction);
      return;
    }
    // 4. Standard LFG buttons (join/leave/close)
    await handleLfgButton(interaction);
  },

  /**
   * Handles LFG select menu interactions (player selection for rating).
   */
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    // ── Pre-modal activity select for LFG creation ──
    if (interaction.customId === 'lfg_select_create_activity') {
      cleanPendingLfgCreates();
      const selectedActivity = interaction.values[0] as LFGActivity;
      if (!Object.values(LFGActivity).includes(selectedActivity)) {
        await interaction.reply({
          content: '❌ Invalid activity type selected.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Store selected activity keyed by user id
      pendingLfgCreates.set(interaction.user.id, {
        activity: selectedActivity,
        timestamp: Date.now(),
      });

      // Show the creation modal (without the activity field)
      const modal = new ModalBuilder()
        .setCustomId('lfg_panel_create_modal')
        .setTitle(`Create ${selectedActivity} LFG Post`);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setPlaceholder('What are you looking to do?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(200);

      const maxPlayersInput = new TextInputBuilder()
        .setCustomId('maxplayers')
        .setPlaceholder('4')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(2);

      const descLabel = new LabelBuilder().setLabel('Description').setTextInputComponent(descInput);
      const maxPlayersLabel = new LabelBuilder()
        .setLabel('Max Players (1-50)')
        .setTextInputComponent(maxPlayersInput);

      modal.addLabelComponents(descLabel, maxPlayersLabel);
      await interaction.showModal(modal);
      return;
    }

    await handleLfgRatingSelect(interaction);
  },

  /**
   * Handles LFG modal submissions (rating feedback, comment feedback, or panel create).
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    // Panel create modal
    if (interaction.customId === 'lfg_panel_create_modal') {
      await handlePanelCreateModal(interaction);
      return;
    }

    if (interaction.customId.startsWith('lfg_rate_comment_modal_')) {
      await handleLfgCommentModal(interaction);
    } else {
      await handleLfgRatingModal(interaction);
    }
  },
};

// ==================== PANEL CREATE MODAL HANDLER ====================

async function handlePanelCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Retrieve activity type from the pre-modal select (default: Other)
  const pending = pendingLfgCreates.get(interaction.user.id);
  const activity = pending?.activity ?? LFGActivity.OTHER;
  pendingLfgCreates.delete(interaction.user.id);

  const description = interaction.fields.getTextInputValue('description').trim();
  const maxPlayersRaw = interaction.fields.getTextInputValue('maxplayers').trim();

  const maxPlayers = Number.parseInt(maxPlayersRaw, 10);
  if (Number.isNaN(maxPlayers) || maxPlayers < 1 || maxPlayers > 50) {
    await interaction.editReply('\u274c Max players must be a number between 1 and 50.');
    return;
  }

  // Rate limit check (distributed via Redis so all bot shards share the counter)
  const rateLimit = await redisRateLimiter.check(
    lfgPostRateLimitKey(interaction.guildId, interaction.user.id),
    POST_LIMIT_PER_HOUR,
    RATE_LIMIT_WINDOW_SECONDS
  );
  if (!rateLimit.allowed) {
    await interaction.editReply(
      '\u26d4 You have reached the hourly limit for creating LFG posts in this server.'
    );
    return;
  }

  // ── Resolve voice channel: use existing VC or create a temp one ──
  let voiceChannelId: string | undefined;
  let autoCreatedVoiceChannel = false;

  const guildId = interaction.guildId ?? 'DM';

  if (interaction.guild) {
    const member = interaction.member as GuildMember | null;
    const existingVc = member?.voice?.channel;

    if (existingVc) {
      // User is already in a voice channel — link it
      voiceChannelId = existingVc.id;
    } else {
      // Create a temporary LFG voice channel
      voiceChannelId = await createLfgVoiceChannel(interaction.guild, member, activity, maxPlayers);
      if (voiceChannelId) {
        autoCreatedVoiceChannel = true;
      }
    }
  }

  const lfgService = getLfgService();
  const post = lfgService.createPost(
    activity,
    description,
    interaction.user.id,
    interaction.user.username,
    maxPlayers,
    guildId,
    interaction.channelId ?? '',
    60, // default 60 min duration
    { voiceChannelId }
  );
  post.autoCreatedVoiceChannel = autoCreatedVoiceChannel;

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('\ud83c\udfae LFG Post Created!')
    .setDescription(`**${getActivityEmoji(activity)} ${activity}**\n${description}`)
    .addFields(
      { name: 'Post ID', value: post.id, inline: true },
      { name: 'Players', value: `${post.currentPlayers}/${post.maxPlayers}`, inline: true },
      {
        name: 'Status',
        value: `${getStatusEmoji(post.status)} ${post.status.toUpperCase()}`,
        inline: true,
      },
      { name: 'Creator', value: interaction.user.username, inline: true },
      {
        name: 'Expires',
        value: `<t:${Math.floor(post.expiresAt.getTime() / 1000)}:R>`,
        inline: true,
      }
    )
    .setFooter({ text: `Post ID: ${post.id}` })
    .setTimestamp();

  await dmAwareEditReply(interaction, { embeds: [embed] });

  // Post persistent LFG embed with buttons for all members
  if (interaction.channel && 'send' in interaction.channel) {
    const lfgEmbed = buildLfgEmbed(post);
    const lfgButtons = buildLfgButtons(post.id);

    // Mention the configured LFG role so members with it get notified.
    // NOTE: `allowedMentions.roles` is REQUIRED for the ping to actually fire
    // when the role is not marked "Mentionable" in Discord. The bot must have
    // the "Mention @everyone, here and All Roles" permission for non-mentionable
    // roles to ping via this override.
    let mentionContent: string | undefined;
    let mentionRoleId: string | undefined;
    if (interaction.guildId) {
      mentionRoleId = await _resolveLfgMentionRoleIdForGuild(interaction.guildId);
      if (mentionRoleId) {
        mentionContent = `<@&${mentionRoleId}>`;
      }
    }

    const sentMessage = await interaction.channel.send({
      content: mentionContent,
      embeds: [lfgEmbed],
      components: [lfgButtons],
      allowedMentions: mentionRoleId ? { roles: [mentionRoleId] } : { parse: [] },
    });
    getLfgService().setMessageId(post.id, sentMessage.id);
  }
}

// ==================== LFG VOICE CHANNEL CREATION ====================

/**
 * Creates a temporary voice channel for an LFG post.
 * Uses lfgVoiceCategoryId from guild settings, or the guild's voice settings parentCategoryId.
 * Returns the Discord channel ID or undefined if creation failed.
 */
async function createLfgVoiceChannel(
  guild: import('discord.js').Guild,
  member: GuildMember | null,
  activity: string,
  maxPlayers: number
): Promise<string | undefined> {
  try {
    // Check bot permissions
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      logger.debug('LFG VC: bot lacks ManageChannels permission', { guildId: guild.id });
      return undefined;
    }

    // Resolve category from guild settings
    let parentCategoryId: string | undefined;
    try {
      const settings = await resolveGuildScopedSettings(guild.id);
      parentCategoryId =
        settings?.lfgSettings?.lfgVoiceCategoryId ??
        settings?.voiceChannelSettings?.parentCategoryId;
    } catch {
      // Settings unavailable — create at root level
    }

    // Validate that the configured category still exists in the guild
    if (parentCategoryId) {
      try {
        const parentChannel = await guild.channels.fetch(parentCategoryId);
        if (parentChannel?.type !== ChannelType.GuildCategory) {
          logger.warn(
            'LFG VC: configured parent category not found or wrong type, falling back to root',
            {
              guildId: guild.id,
              parentCategoryId,
            }
          );
          parentCategoryId = undefined;
        }
      } catch {
        logger.warn('LFG VC: configured parent category not found, falling back to root', {
          guildId: guild.id,
          parentCategoryId,
        });
        parentCategoryId = undefined;
      }
    }

    const channelName = `🎮 LFG: ${activity}`;
    const vc = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentCategoryId,
      userLimit: maxPlayers,
      reason: 'Auto-created for LFG post',
      permissionOverwrites: member
        ? [
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
              ],
            },
          ]
        : [],
    });

    // Register in voice channel service for cleanup tracking
    const voiceChannelService = VoiceChannelService.getInstance();
    voiceChannelService.createChannel(
      channelName,
      guild.id,
      vc.id,
      member?.id ?? 'system',
      VoiceChannelType.TEMPORARY,
      { expiresAt: new Date(Date.now() + 65 * 60 * 1000), userLimit: maxPlayers }
    );

    // Move the creator into the new VC if possible
    if (member?.voice?.channelId === null) {
      // User is not in any VC, can't force-move — they'll join manually
    }

    logger.info(`🎤 Created LFG voice channel "${channelName}" in ${guild.name}`, {
      channelId: vc.id,
      guildId: guild.id,
    });

    // Post voice channel controls panel so the creator can manage the channel
    try {
      const creatorName = member?.displayName ?? 'Unknown';
      const embed = buildVoiceInterfaceEmbed(channelName, creatorName);
      const controlRow = buildVoiceControlButtons(vc.id);
      const modRow = buildVoiceModerationButtons(vc.id);
      const extRow = buildVoiceExtendedButtons(vc.id);
      await vc.send({ embeds: [embed], components: [controlRow, modRow, extRow] });
    } catch (panelErr) {
      logger.debug('LFG VC: failed to post voice control panel', {
        channelId: vc.id,
        error: panelErr instanceof Error ? panelErr.message : String(panelErr),
      });
    }

    return vc.id;
  } catch (error: unknown) {
    logger.warn('Failed to create LFG voice channel', {
      guildId: guild.id,
      activity,
      maxPlayers,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
