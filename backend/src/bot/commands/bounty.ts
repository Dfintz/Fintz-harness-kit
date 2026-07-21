import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} from 'discord.js';

import {
  Bounty,
  BountyDifficulty,
  BountyRewardType,
  BountyStatus,
  BountyTargetType,
  BountyType,
} from '../../models/Bounty';
import { BountyClaim, BountyClaimStatus } from '../../models/BountyClaim';
import { bountySchemas } from '../../schemas/bountySchemas';
import { BountyClaimService, BountyService, HunterProfileService } from '../../services/bounty';
import { buildAppUrl } from '../utils/appUrls';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { buildCustomId, customIdScope, parseCustomId } from '../utils/customId';
import { replyWithError } from '../utils/errorReply';
import { resolveGuildContext } from '../utils/guildContext';
import { buildPaginationRow, paginate } from '../utils/paginationControls';
import { buildBountyTypeSelect } from '../utils/sharedChoices';

import { BotCommand } from './types';

let _services: {
  bountyService: BountyService;
  claimService: BountyClaimService;
  hunterProfileService: HunterProfileService;
} | null = null;

function getServices() {
  _services ??= {
    bountyService: new BountyService(),
    claimService: new BountyClaimService(),
    hunterProfileService: new HunterProfileService(),
  };
  return _services;
}

// ── Pre-modal state: stores bounty type chosen via select menu ──
interface PendingBountyCreate {
  bountyType: BountyType;
  timestamp: number;
}

const pendingBountyCreates = new Map<string, PendingBountyCreate>();
const PENDING_CREATE_TTL_MS = 10 * 60 * 1000;

function cleanPendingBountyCreates(): void {
  const now = Date.now();
  for (const [key, val] of pendingBountyCreates) {
    if (now - val.timestamp > PENDING_CREATE_TTL_MS) {
      pendingBountyCreates.delete(key);
    }
  }
}

/**
 * Get emoji for bounty type
 */
function getBountyTypeEmoji(type: BountyType): string {
  switch (type) {
    case BountyType.KILL:
      return '💀';
    case BountyType.CAPTURE:
      return '🔗';
    case BountyType.INTEL:
      return '🔍';
    case BountyType.TRANSPORT:
      return '📦';
    case BountyType.RESCUE:
      return '🆘';
    case BountyType.CUSTOM:
      return '⭐';
    default:
      return '🎯';
  }
}

/**
 * Get emoji for bounty status
 */
function getStatusEmoji(status: BountyStatus): string {
  switch (status) {
    case BountyStatus.ACTIVE:
      return '🟢';
    case BountyStatus.CLAIMED:
      return '🟡';
    case BountyStatus.IN_PROGRESS:
      return '🔵';
    case BountyStatus.COMPLETED:
      return '✅';
    case BountyStatus.VERIFIED:
      return '✔️';
    case BountyStatus.PAID:
      return '💰';
    case BountyStatus.CANCELLED:
      return '❌';
    case BountyStatus.EXPIRED:
      return '⏰';
    default:
      return '❓';
  }
}

/**
 * Get color for bounty status
 */
function getStatusColor(status: BountyStatus): number {
  switch (status) {
    case BountyStatus.ACTIVE:
      return 0x00ff00; // Green
    case BountyStatus.CLAIMED:
    case BountyStatus.IN_PROGRESS:
      return 0xffff00; // Yellow
    case BountyStatus.COMPLETED:
    case BountyStatus.VERIFIED:
      return 0x0099ff; // Blue
    case BountyStatus.PAID:
      return 0x00ffff; // Cyan
    case BountyStatus.CANCELLED:
    case BountyStatus.EXPIRED:
      return 0xff0000; // Red
    default:
      return 0x808080; // Gray
  }
}

/**
 * Get difficulty emoji
 */
function _getDifficultyEmoji(difficulty?: BountyDifficulty): string {
  switch (difficulty) {
    case BountyDifficulty.EASY:
      return '🟢';
    case BountyDifficulty.MEDIUM:
      return '🟡';
    case BountyDifficulty.HARD:
      return '🟠';
    case BountyDifficulty.EXPERT:
      return '🔴';
    default:
      return '⚪';
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

// ==================== HANDLER CONTEXT TYPE ====================

interface BountyCommandContext {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  userId: string;
  userName: string;
  bountyService: BountyService;
  claimService: BountyClaimService;
  hunterProfileService: HunterProfileService;
}

async function handleBountyStats(ctx: BountyCommandContext): Promise<void> {
  const { interaction, guildId, bountyService } = ctx;
  const stats = await bountyService.getStatistics(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('📊 Bounty Statistics')
    .addFields(
      { name: 'Total Bounties', value: stats.totalBounties.toString(), inline: true },
      { name: 'Active Bounties', value: stats.activeBounties.toString(), inline: true },
      { name: 'Completed', value: stats.completedBounties.toString(), inline: true },
      { name: 'Currently Claimed', value: stats.claimedBounties.toString(), inline: true },
      {
        name: 'Total Rewards Posted',
        value: `${stats.totalRewardsPosted.toLocaleString()} aUEC`,
        inline: true,
      },
      {
        name: 'Total Rewards Paid',
        value: `${stats.totalRewardsPaid.toLocaleString()} aUEC`,
        inline: true,
      }
    )
    .setTimestamp();

  const typeBreakdown = Object.entries(stats.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${getBountyTypeEmoji(type as BountyType)} ${type}: ${count}`)
    .join('\n');
  if (typeBreakdown) {
    embed.addFields({ name: 'By Type', value: typeBreakdown, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleBountyMyClaims(ctx: BountyCommandContext): Promise<void> {
  const { interaction, userId, claimService } = ctx;
  const claims = await claimService.getActiveClaimsByHunter(userId);

  if (claims.length === 0) {
    await interaction.editReply({
      content:
        '📋 You have no active bounty claims. Use `/bounty claim id:<bounty_id>` to claim a bounty!',
    });
    return;
  }

  await interaction.editReply(_buildClaimsView(claims, 0));
}

/**
 * Bounty interaction customId convention, parsed via the shared customId codec
 * (C9 / ARCH-09): `<prefix>_<action>_<...params>`. The pagination ids are
 * `bounty_<action>_<page>`; `page` is a single numeric segment containing no
 * `_`, so the codec round-trips it exactly.
 */
const BOUNTY_PANEL_PREFIX = 'bounty';
const BOUNTY_CLAIMS_PAGE_ACTION = 'claimspage';
const BOUNTY_LIST_PAGE_ACTION = 'listpage';
const BOUNTY_CLAIMS_PAGE_SCOPE = buildCustomId(BOUNTY_PANEL_PREFIX, BOUNTY_CLAIMS_PAGE_ACTION);
const BOUNTY_LIST_PAGE_SCOPE = buildCustomId(BOUNTY_PANEL_PREFIX, BOUNTY_LIST_PAGE_ACTION);

/**
 * Parse the 0-based target page from a `bounty_<action>_<page>` pagination
 * customId. Returns null when the id is not the expected action or the page is
 * not a non-negative integer — matching the previous `\d+` regex exactly, so a
 * disabled control's `bounty_<action>_-1` id is ignored.
 */
function parseBountyPageCustomId(customId: string, action: string): number | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== BOUNTY_PANEL_PREFIX || parsed.action !== action) {
    return null;
  }
  const [pageParam = ''] = parsed.params;
  const page = Number.parseInt(pageParam, 10);
  return Number.isNaN(page) || page < 0 ? null : page;
}

/** Page through the hunter's active bounty claims via the shared pagination row. */
async function handleBountyClaimsPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = parseBountyPageCustomId(interaction.customId, BOUNTY_CLAIMS_PAGE_ACTION);
  if (page === null) {
    return;
  }
  const { claimService } = getServices();
  const claims = await claimService.getActiveClaimsByHunter(interaction.user.id);

  if (claims.length === 0) {
    // Claims cleared since the list was opened — collapse the controls.
    await interaction.update({
      content:
        '📋 You have no active bounty claims. Use `/bounty claim id:<bounty_id>` to claim a bounty!',
      embeds: [],
      components: [],
    });
    return;
  }

  // Edit the existing ephemeral list message in place (no new reply).
  await interaction.update(_buildClaimsView(claims, page));
}

/**
 * Build the embed + pagination controls for one page of the hunter's active
 * bounty claims. Pure — caller decides `editReply` (initial) vs `update` (paging).
 */
function _buildClaimsView(
  claims: BountyClaim[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(claims, page, BOUNTY_CLAIMS_PAGE_SIZE);

  const pluralSuffix = total === 1 ? '' : 's';
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🎯 Your Active Bounty Claims')
    .setDescription(`You have ${total} active claim${pluralSuffix}`)
    .setTimestamp();

  for (const claim of pageItems) {
    const bounty = claim.bounty;
    const evidenceCount = claim.evidence?.length || 0;
    const evidenceSuffix = evidenceCount === 1 ? '' : 's';
    const statusEmoji = getClaimStatusEmoji(claim.status);

    embed.addFields({
      name: `${statusEmoji} ${bounty?.title || 'Unknown Bounty'}`,
      value: `ID: \`${claim.bountyId.substring(0, 8)}...\`\nStatus: ${claim.status}\nEvidence: ${evidenceCount} item${evidenceSuffix}\nClaimed: ${new Date(claim.claimedAt).toLocaleDateString()}`,
      inline: false,
    });
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} • ${total} claims` });
  }

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage =>
      buildCustomId(BOUNTY_PANEL_PREFIX, BOUNTY_CLAIMS_PAGE_ACTION, String(targetPage)),
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

/**
 * Fetch one server-paginated page of the org's active bounties, clamping a stale
 * out-of-range page (e.g. bounties removed since the list was opened) back to the
 * last valid page so navigation can never strand the user on an empty page.
 */
async function _fetchActiveBountiesPage(
  bountyService: BountyService,
  orgId: string,
  uiPage: number
): Promise<{ bounties: Bounty[]; page: number; totalPages: number; total: number }> {
  const requested = await bountyService.searchBounties(
    orgId,
    { status: BountyStatus.ACTIVE },
    uiPage + 1,
    BOUNTY_LIST_PAGE_SIZE
  );
  const totalPages = Math.max(1, requested.totalPages);

  if (requested.bounties.length === 0 && requested.total > 0 && uiPage > totalPages - 1) {
    const lastPage = totalPages - 1;
    const clamped = await bountyService.searchBounties(
      orgId,
      { status: BountyStatus.ACTIVE },
      lastPage + 1,
      BOUNTY_LIST_PAGE_SIZE
    );
    return {
      bounties: clamped.bounties,
      page: lastPage,
      totalPages: Math.max(1, clamped.totalPages),
      total: clamped.total,
    };
  }

  return { bounties: requested.bounties, page: uiPage, totalPages, total: requested.total };
}

/**
 * Build the embed + pagination controls for one page of the org's active bounties.
 * Server-paginated (unlike the in-memory claims list): each page is a fresh
 * BountyService query and the nav row is derived from the server's total page
 * count. Caller decides `editReply` (initial) vs `update` (paging).
 */
async function _buildActiveBountiesView(
  bountyService: BountyService,
  orgId: string,
  uiPage: number
): Promise<{
  content?: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const { bounties, page, totalPages, total } = await _fetchActiveBountiesPage(
    bountyService,
    orgId,
    uiPage
  );

  if (total === 0) {
    return { content: '📋 No active bounties found.', embeds: [], components: [] };
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🎯 Active Bounties')
    .setDescription(`${total} active ${total === 1 ? 'bounty' : 'bounties'}`)
    .setTimestamp();

  for (const b of bounties) {
    const rewardText = b.rewardAmount
      ? `💰 ${b.rewardAmount.toLocaleString()} aUEC`
      : b.rewardDescription || 'Negotiable';
    embed.addFields({
      name: `${getBountyTypeEmoji(b.bountyType)} ${b.title}`,
      value: `ID: \`${b.id}\` | ${rewardText}`,
    });
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${page + 1} of ${totalPages} • ${total} bounties` });
  }

  const navRow = buildPaginationRow({
    page,
    totalPages,
    makeCustomId: targetPage =>
      buildCustomId(BOUNTY_PANEL_PREFIX, BOUNTY_LIST_PAGE_ACTION, String(targetPage)),
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

/** Page through the org's active bounties via the shared pagination row. */
async function handleBountyListPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = parseBountyPageCustomId(interaction.customId, BOUNTY_LIST_PAGE_ACTION);
  if (page === null) {
    return;
  }
  const ctx = await resolveGuildContext(interaction);
  if (!ctx) {
    // resolveGuildContext already replied with guidance for unlinked guilds.
    return;
  }
  const { bountyService } = getServices();
  // Edit the existing ephemeral list message in place (no new reply).
  await interaction.update(await _buildActiveBountiesView(bountyService, ctx.organizationId, page));
}

async function handleBountyPending(ctx: BountyCommandContext): Promise<void> {
  const { interaction, guildId, userId, claimService } = ctx;
  const pendingClaims = await claimService.getPendingApprovalsForCreator(guildId, userId);

  if (pendingClaims.length === 0) {
    await interaction.editReply({
      content: '📋 You have no bounty claims pending approval.',
    });
    return;
  }

  const pluralSuffix = pendingClaims.length === 1 ? '' : 's';
  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle('📋 Pending Bounty Approvals')
    .setDescription(`You have ${pendingClaims.length} claim${pluralSuffix} awaiting your review.`)
    .setTimestamp();

  for (const claim of pendingClaims.slice(0, 10)) {
    const bounty = claim.bounty;
    const evidenceCount = claim.evidence?.length || 0;
    const evidenceSuffix = evidenceCount === 1 ? '' : 's';
    embed.addFields({
      name: `📤 ${bounty?.title || 'Unknown Bounty'}`,
      value: `ID: \`${claim.bountyId.substring(0, 8)}...\`\nHunter: ${claim.hunterName || 'Unknown'}\nEvidence: ${evidenceCount} item${evidenceSuffix}\nSubmitted: ${claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString() : 'N/A'}`,
      inline: false,
    });
  }

  const footer =
    pendingClaims.length > 10
      ? `Showing 10 of ${pendingClaims.length} pending claims`
      : 'Use /bounty approve id:<bounty_id> or /bounty reject id:<bounty_id> reason:<reason>';
  embed.setFooter({ text: footer });
  await interaction.editReply({ embeds: [embed] });
}

async function handleBountyHistory(ctx: BountyCommandContext): Promise<void> {
  const { interaction, guildId, userId, hunterProfileService } = ctx;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetUserId = targetUser.id;
  const targetUserName = targetUser.username;
  const page = interaction.options.getInteger('page') || 1;

  const result = await hunterProfileService.getHunterHistory(guildId, targetUserId, page, 10);

  if (result.history.length === 0) {
    const noHistoryMsg =
      targetUserId === userId
        ? "📋 You haven't completed any bounties yet. Use `/bounty claim id:<bounty_id>` to claim a bounty!"
        : `📋 ${targetUserName} hasn't completed any bounties yet.`;
    await interaction.editReply({ content: noHistoryMsg });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`📜 Bounty History: ${targetUserName}`)
    .setDescription(`Page ${result.page} of ${result.totalPages} (${result.total} total bounties)`)
    .setTimestamp();

  for (const entry of result.history) {
    const statusEmoji = getClaimStatusEmoji(entry.status);
    const typeEmoji = getBountyTypeEmoji(entry.bountyType);
    const rewardText = entry.rewardAmount
      ? `💰 ${entry.rewardAmount.toLocaleString()} aUEC`
      : 'Negotiable';
    const completedText = entry.completedAt
      ? `\nCompleted: ${new Date(entry.completedAt).toLocaleDateString()}`
      : '';
    embed.addFields({
      name: `${typeEmoji} ${entry.bountyTitle}`,
      value: `Status: ${statusEmoji} ${entry.status}\nReward: ${rewardText}\nClaimed: ${new Date(entry.claimedAt).toLocaleDateString()}${completedText}`,
      inline: false,
    });
  }

  if (result.totalPages > 1) {
    embed.setFooter({ text: `Use /bounty history page:${page + 1} to see more` });
  }
  await interaction.editReply({ embeds: [embed] });
}

export const bounty: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('bounty')
    .setDescription('Bounty board — create, claim, and track bounties'),

  category: 'social',
  cooldown: 3,
  guildOnly: true,

  async handleButton(interaction: ButtonInteraction) {
    await handleBountyButton(interaction);
  },

  async handleSelectMenu(interaction: StringSelectMenuInteraction) {
    await handleBountySelectMenu(interaction);
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    await handleBountyModal(interaction);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await replyWithCommandPanel(interaction, BOUNTY_PANEL_CONFIG);
  },
};

// ========== Panel Configuration ==========

/** "My Claims" list page size. */
const BOUNTY_CLAIMS_PAGE_SIZE = 10;

/** Active-bounties list page size (server-paginated via BountyService.searchBounties). */
const BOUNTY_LIST_PAGE_SIZE = 10;

const BOUNTY_PANEL_CONFIG: CommandPanelConfig = {
  prefix: BOUNTY_PANEL_PREFIX,
  title: '\ud83c\udfaf Bounty Board',
  description: 'Manage bounties, claims, and your hunter profile.',
  buttons: [
    {
      subcommand: 'list',
      label: 'Browse Bounties',
      emoji: '\ud83d\udccb',
      style: ButtonStyle.Primary,
    },
    { subcommand: 'myclaims', label: 'My Claims', emoji: '\ud83d\udccc' },
    { subcommand: 'pending', label: 'Pending Review', emoji: '\u23f3' },
    { subcommand: 'stats', label: 'Stats', emoji: '\ud83d\udcca' },
    { subcommand: 'history', label: 'History', emoji: '\ud83d\udcdc' },
    { subcommand: 'view', label: 'View Bounty', emoji: '\ud83d\udd0d' },
    { subcommand: 'claim', label: 'Claim Bounty', emoji: '\ud83c\udfaf' },
    {
      subcommand: 'create',
      label: 'Create Bounty',
      emoji: '\u270f\ufe0f',
      style: ButtonStyle.Success,
    },
    { subcommand: 'hunter', label: 'Hunter Profile', emoji: '\ud83e\uddd1\u200d\ud83d\ude80' },
  ],
};

async function handleBountyButton(interaction: ButtonInteraction): Promise<void> {
  const scope = customIdScope(interaction.customId);

  // Paginated "My Claims" navigation: bounty_claimspage_<page>
  if (scope === BOUNTY_CLAIMS_PAGE_SCOPE) {
    await handleBountyClaimsPageButton(interaction);
    return;
  }

  // Paginated active-bounty list navigation: bounty_listpage_<page>
  if (scope === BOUNTY_LIST_PAGE_SCOPE) {
    await handleBountyListPageButton(interaction);
    return;
  }

  const sub = parsePanelCustomId(interaction.customId, BOUNTY_PANEL_PREFIX);
  if (!sub) {
    return;
  }

  const services = getServices();
  const ctx0 = await resolveGuildContext(interaction);
  if (!ctx0) {
    return;
  }
  const guildId = ctx0.organizationId; // Tenant key for BountyService is organizationId
  const userId = interaction.user.id;
  const userName = interaction.user.username;

  // Hunter sub-panel — open the hunter command's panel
  if (sub === 'hunter') {
    const { buildCommandPanel } = await import('../utils/commandPanelBuilder');
    const { embed, components } = buildCommandPanel({
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
    });
    await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    return;
  }

  // Param-free actions — execute directly
  switch (sub) {
    case 'list':
    case 'myclaims':
    case 'pending':
    case 'stats':
    case 'history': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // Safe cast: param-free button handlers (stats, myclaims, history) do not access
      // interaction.options — only deferReply/editReply which exist on both types
      const ctx: BountyCommandContext = {
        interaction: interaction as unknown as ChatInputCommandInteraction,
        guildId,
        userId,
        userName,
        ...services,
      };
      try {
        switch (sub) {
          case 'list': {
            await interaction.editReply(
              await _buildActiveBountiesView(services.bountyService, guildId, 0)
            );
            break;
          }
          case 'myclaims':
            await handleBountyMyClaims(ctx);
            break;
          case 'pending':
            await handleBountyPending(ctx);
            break;
          case 'stats':
            await handleBountyStats(ctx);
            break;
          case 'history':
            await handleBountyHistory(ctx);
            break;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `❌ Error: ${msg}` });
      }
      break;
    }
    // Param-requiring actions — populate from active bounties or fall back to modal
    case 'view':
    case 'claim': {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await services.bountyService.searchBounties(
          guildId,
          { status: BountyStatus.ACTIVE },
          1,
          25
        );
        if (result.bounties.length > 0) {
          const options = result.bounties.map(b => ({
            label: (b.title || 'Untitled Bounty').substring(0, 100),
            value: b.id,
            description: b.rewardAmount
              ? `${b.bountyType} \u2022 ${b.rewardAmount.toLocaleString()} aUEC`.substring(0, 100)
              : `${b.bountyType}`.substring(0, 100),
            emoji: getBountyTypeEmoji(b.bountyType),
          }));
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${BOUNTY_PANEL_PREFIX}_select_${sub}`)
              .setPlaceholder(`Select a bounty to ${sub}...`)
              .addOptions(options)
          );
          await interaction.editReply({
            content: `Select a bounty to ${sub}:`,
            components: [row],
          });
          return;
        }
        await interaction.editReply('No active bounties found.');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: `\u274c Error: ${msg}` });
        } else {
          await showBountyIdModal(
            interaction,
            sub,
            sub === 'view' ? 'View Bounty' : 'Claim Bounty'
          );
        }
      }
      break;
    }
    case 'create': {
      // Step 1: Show bounty type select before the creation modal
      const row = buildBountyTypeSelect(`${BOUNTY_PANEL_PREFIX}_select_create_type`);
      await interaction.reply({
        content: '🎯 **Create Bounty** — What type of bounty is this?',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}

async function handleBountySelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId } = interaction;
  const services = getServices();
  const ctx0 = await resolveGuildContext(interaction);
  if (!ctx0) {
    return;
  }
  const guildId = ctx0.organizationId;
  const userId = interaction.user.id;
  const userName = interaction.user.username;

  // ── Pre-modal type select for bounty creation ──
  if (customId === `${BOUNTY_PANEL_PREFIX}_select_create_type`) {
    cleanPendingBountyCreates();
    const selectedType = interaction.values[0] as BountyType;
    if (!Object.values(BountyType).includes(selectedType)) {
      await interaction.reply({
        content: '❌ Invalid bounty type selected.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    pendingBountyCreates.set(interaction.user.id, {
      bountyType: selectedType,
      timestamp: Date.now(),
    });

    const modal = new ModalBuilder()
      .setCustomId(`${BOUNTY_PANEL_PREFIX}_modal_create`)
      .setTitle(
        `Create ${getBountyTypeEmoji(selectedType)} ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Bounty`
      );

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setPlaceholder('Enter a title for the bounty')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setPlaceholder('Describe the bounty objective...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const rewardInput = new TextInputBuilder()
      .setCustomId('reward')
      .setPlaceholder('e.g. 50000')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(20);

    modal.addLabelComponents(
      new LabelBuilder().setLabel('Bounty Title').setTextInputComponent(titleInput),
      new LabelBuilder().setLabel('Description').setTextInputComponent(descInput),
      new LabelBuilder().setLabel('Reward Amount (aUEC)').setTextInputComponent(rewardInput)
    );
    await interaction.showModal(modal);
    return;
  }

  if (customId === `${BOUNTY_PANEL_PREFIX}_select_view`) {
    const bountyId = interaction.values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const bounty = await services.bountyService.getBountyById(bountyId, guildId);
      if (!bounty) {
        await interaction.editReply({ content: `\u274c Bounty not found.` });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(getStatusColor(bounty.status))
        .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} ${bounty.title}`)
        .setURL(buildAppUrl('/bounties'))
        .setDescription(bounty.description || 'No description')
        .addFields(
          { name: 'ID', value: `\`${bounty.id}\``, inline: true },
          {
            name: 'Status',
            value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
            inline: true,
          },
          { name: 'Type', value: bounty.bountyType, inline: true }
        )
        .setTimestamp();
      if (bounty.rewardAmount) {
        embed.addFields({
          name: 'Reward',
          value: `\ud83d\udcb0 ${bounty.rewardAmount.toLocaleString()} aUEC`,
          inline: true,
        });
      }
      await interaction.editReply({ embeds: [embed] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      await interaction.editReply({ content: `\u274c Error: ${msg}` });
    }
  } else if (customId === `${BOUNTY_PANEL_PREFIX}_select_claim`) {
    const bountyId = interaction.values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await services.bountyService.claimBounty(guildId, bountyId, userId, userName);
      await interaction.editReply({
        content: `\u2705 You have claimed this bounty. Good hunting!`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      await interaction.editReply({ content: `\u274c Error: ${msg}` });
    }
  }
}

async function showBountyIdModal(
  interaction: ButtonInteraction,
  action: string,
  title: string
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${BOUNTY_PANEL_PREFIX}_modal_${action}`)
    .setTitle(title);

  const idInput = new TextInputBuilder()
    .setCustomId('bounty_id')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter the bounty ID')
    .setRequired(true)
    .setMaxLength(100);

  modal.addLabelComponents(new LabelBuilder().setLabel('Bounty ID').setTextInputComponent(idInput));
  await interaction.showModal(modal);
}

async function handleBountyModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;
  const services = getServices();
  const ctx0 = await resolveGuildContext(interaction);
  if (!ctx0) {
    return;
  }
  const guildId = ctx0.organizationId; // Tenant key for BountyService is organizationId
  const userId = interaction.user.id;
  const userName = interaction.user.username;

  if (customId === `${BOUNTY_PANEL_PREFIX}_modal_view`) {
    const bountyId = interaction.fields.getTextInputValue('bounty_id').trim();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const bounty = await services.bountyService.getBountyById(bountyId, guildId);
      if (!bounty) {
        await interaction.editReply({ content: `❌ Bounty \`${bountyId}\` not found.` });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(getStatusColor(bounty.status))
        .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} ${bounty.title}`)
        .setURL(buildAppUrl('/bounties'))
        .setDescription(bounty.description || 'No description')
        .addFields(
          { name: 'ID', value: `\`${bounty.id}\``, inline: true },
          {
            name: 'Status',
            value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
            inline: true,
          },
          { name: 'Type', value: bounty.bountyType, inline: true }
        )
        .setTimestamp();
      if (bounty.rewardAmount) {
        embed.addFields({
          name: 'Reward',
          value: `💰 ${bounty.rewardAmount.toLocaleString()} aUEC`,
          inline: true,
        });
      }
      await interaction.editReply({ embeds: [embed] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      await interaction.editReply({ content: `❌ Error: ${msg}` });
    }
  } else if (customId === `${BOUNTY_PANEL_PREFIX}_modal_claim`) {
    const bountyId = interaction.fields.getTextInputValue('bounty_id').trim();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await services.bountyService.claimBounty(guildId, bountyId, userId, userName);
      await interaction.editReply({
        content: `✅ You have claimed bounty \`${bountyId}\`. Good hunting!`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      await interaction.editReply({ content: `❌ Error: ${msg}` });
    }
  } else if (customId === `${BOUNTY_PANEL_PREFIX}_modal_create`) {
    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const rewardStr = interaction.fields.getTextInputValue('reward')?.trim();
    const rewardAmount = rewardStr ? parseInt(rewardStr, 10) : undefined;

    // Retrieve the bounty type selected in the pre-modal step (default: CUSTOM)
    const pending = pendingBountyCreates.get(interaction.user.id);
    const bountyType = pending?.bountyType ?? BountyType.CUSTOM;
    pendingBountyCreates.delete(interaction.user.id);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { error: validationError, value: validated } = bountySchemas.create.validate(
        {
          title,
          description: description || undefined,
          bountyType,
          targetType: BountyTargetType.OTHER,
          rewardType: rewardAmount ? BountyRewardType.CREDITS : BountyRewardType.OTHER,
          rewardAmount: rewardAmount && !isNaN(rewardAmount) ? rewardAmount : undefined,
        },
        { abortEarly: false, stripUnknown: true }
      );
      if (validationError) {
        await replyWithError(interaction, validationError, { context: 'bounty.create.modal' });
        return;
      }

      const bounty = await services.bountyService.createBounty(
        guildId,
        userId,
        userName,
        validated as Parameters<typeof services.bountyService.createBounty>[3]
      );

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} Bounty Created`)
        .setDescription(`**${bounty.title}**`)
        .addFields(
          { name: 'ID', value: `\`${bounty.id}\``, inline: true },
          {
            name: 'Status',
            value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
            inline: true,
          }
        )
        .setTimestamp();

      if (bounty.rewardAmount) {
        embed.addFields({
          name: 'Reward',
          value: `💰 ${bounty.rewardAmount.toLocaleString()} aUEC`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error: unknown) {
      await replyWithError(interaction, error, { context: 'bounty.create.modal' });
    }
  }
}
