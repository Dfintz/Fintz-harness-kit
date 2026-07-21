import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import { AppDataSource } from '../../data-source';
import type { UserShip } from '../../models/UserShip';
import { UserShipService } from '../../services/ship';
import type { ShipInsuranceStatus } from '../../services/ship/UserShipService';
import { UserService } from '../../services/user/UserService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { buildUserPublicHangarSnapshotEmbed, buildUserRootHubEmbed } from '../embeds/userEmbeds';
import { buildAppUrl } from '../utils/appUrls';
import {
  buildButton,
  buildPanelCustomId,
  buildRow,
  decorateSubpanel,
  parsePanelCustomId,
  stripLeadingPanelEmoji,
  updateEphemeralPanel,
  type EphemeralPanelContent,
} from '../utils/commandPanelBuilder';

import { BotCommand } from './types';

type UserPanelAction =
  | {
      kind: 'root';
      action: string;
    }
  | {
      kind: 'hangar';
      action: string;
    };

const USER_HANGAR_PANEL_PREFIX = 'user_hangar_panel_';
const HANGAR_SHIP_PREVIEW_LIMIT = 8;
const HANGAR_PUBLIC_SHARING_KEYS = ['public', 'PUBLIC'];
const HANGAR_ORG_SHARING_KEYS = ['organization', 'ORGANIZATION'];
const HANGAR_ALLIANCE_SHARING_KEYS = ['alliance', 'ALLIANCE'];
const HANGAR_PRIVATE_SHARING_KEYS = ['private', 'PRIVATE'];
const HANGAR_SHARED_USERS_KEYS = ['shared_users', 'SHARED_USERS'];

let _userService: UserService | null = null;
function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

let _userShipService: UserShipService | null = null;
function getUserShipService(): UserShipService {
  _userShipService ??= new UserShipService();
  return _userShipService;
}

interface HangarIdentityContext {
  userId: string;
  displayName: string;
  activeOrgId: string;
}

interface HangarPublicSnapshotContext extends HangarIdentityContext {
  summary: Awaited<ReturnType<UserShipService['getUserShipSummary']>>;
  topShips: UserShip[];
}

const USER_ROOT_ACTION_ALIASES: Record<string, string> = {
  verification: 'verify',
  notifications: 'notify',
  rsi: 'scstats',
  rsi_status: 'scstats',
  status: 'scstats',
};

function normalizeRootAction(action: string): string {
  return USER_ROOT_ACTION_ALIASES[action] ?? action;
}

function formatCountRecord(record: Record<string, number>, max = 4): string {
  const entries = Object.entries(record)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);

  if (entries.length === 0) {
    return 'None';
  }

  return entries.map(([key, count]) => `${key}: ${count}`).join(' • ');
}

function getCountForKeys(record: Record<string, number>, keys: readonly string[]): number {
  return keys.reduce((sum, key) => sum + (record[key] ?? 0), 0);
}

function formatShipName(ship: UserShip): string {
  if (ship.customName?.trim()) {
    return `${ship.customName.trim()} (${ship.shipName})`;
  }
  return ship.shipName;
}

function formatShipPreview(ships: readonly UserShip[]): string {
  if (ships.length === 0) {
    return 'No ships found in your active hangar.';
  }

  return ships
    .slice(0, HANGAR_SHIP_PREVIEW_LIMIT)
    .map((ship, index) => {
      const status = String(ship.status ?? 'unknown').toLowerCase();
      return `${index + 1}. ${formatShipName(ship)} • ${status}`;
    })
    .join('\n');
}

function formatInsurancePreview(ships: readonly ShipInsuranceStatus[]): string {
  if (ships.length === 0) {
    return 'No insurance renewals due in the next 30 days.';
  }

  return ships
    .slice(0, HANGAR_SHIP_PREVIEW_LIMIT)
    .map(entry => {
      const when =
        entry.daysUntilExpiration < 0
          ? `${Math.abs(entry.daysUntilExpiration)}d overdue`
          : `${entry.daysUntilExpiration}d left`;
      return `• ${formatShipName(entry.ship)} — ${when}`;
    })
    .join('\n');
}

function formatTopShips(ships: readonly UserShip[]): string {
  if (ships.length === 0) {
    return 'No ships available.';
  }

  return ships
    .slice(0, 3)
    .map((ship, index) => {
      const status = String(ship.status ?? 'unknown').toLowerCase();
      return `${index + 1}. ${formatShipName(ship)} • ${status}`;
    })
    .join('\n');
}

async function resolveHangarContext(
  interaction: ButtonInteraction
): Promise<HangarIdentityContext | null> {
  if (!AppDataSource.isInitialized) {
    await interaction.reply({
      content: '⚠️ Hangar data is temporarily unavailable. Please try again in a moment.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const discordId = interaction.user?.id;
  if (!discordId) {
    await interaction.reply({
      content: '❌ Could not resolve your Discord account. Run `/user` again.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    if (!user) {
      await interaction.reply({
        content:
          '🔗 Your Discord account is not linked yet. Sign in with Discord on the web app first, then try again.',
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    const activeOrgId = user.activeOrgId ?? '';
    if (!activeOrgId) {
      await interaction.reply({
        content:
          '❌ No active organization is configured for your account yet. Set your active org in the web app and try again.',
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    return {
      userId: user.id,
      displayName: user.displayName ?? user.username,
      activeOrgId,
    };
  } catch (error: unknown) {
    logger.warn('Failed to resolve Discord user hangar context', {
      errorMessage: getErrorMessage(error),
      discordId,
    });
    await interaction.reply({
      content: '❌ Failed to load hangar data. Please try again shortly.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
}

async function loadHangarSummary(
  context: HangarIdentityContext
): Promise<Awaited<ReturnType<UserShipService['getUserShipSummary']>>> {
  return getUserShipService().getUserShipSummary(context.activeOrgId, context.userId);
}

async function loadHangarTopShips(context: HangarIdentityContext, limit = 3): Promise<UserShip[]> {
  const page = await getUserShipService().getUserShips(context.userId, {
    page: 1,
    limit,
    sortBy: 'updatedAt',
    sortOrder: 'DESC',
  });

  return page.data;
}

function buildPublicHangarEmbed(
  context: HangarPublicSnapshotContext
): ReturnType<typeof buildUserPublicHangarSnapshotEmbed> {
  const publicCount = getCountForKeys(context.summary.bySharingLevel, HANGAR_PUBLIC_SHARING_KEYS);
  const orgCount = getCountForKeys(context.summary.bySharingLevel, HANGAR_ORG_SHARING_KEYS);
  const allianceCount = getCountForKeys(
    context.summary.bySharingLevel,
    HANGAR_ALLIANCE_SHARING_KEYS
  );
  const statusBreakdown = formatCountRecord(context.summary.byStatus, 3);
  const roleBreakdown = formatCountRecord(context.summary.byRole, 3);
  const topShips = formatTopShips(context.topShips);

  return buildUserPublicHangarSnapshotEmbed({
    displayName: context.displayName,
    totalShips: context.summary.totalShips,
    needsInsurance: context.summary.needsInsurance,
    totalValue: context.summary.totalValue,
    publicCount,
    orgCount,
    allianceCount,
    statusBreakdown,
    roleBreakdown,
    topShips,
    hangarUrl: buildAppUrl('/hangar'),
  });
}

function resolveUserPanelAction(customId: string): UserPanelAction | null {
  const rootSub = parsePanelCustomId(customId, 'user');
  if (rootSub) {
    return { kind: 'root', action: normalizeRootAction(rootSub) };
  }

  if (customId.startsWith(USER_HANGAR_PANEL_PREFIX)) {
    return {
      kind: 'hangar',
      action: customId.slice(USER_HANGAR_PANEL_PREFIX.length),
    };
  }

  const legacySub = customId.startsWith('user_') ? customId.slice('user_'.length) : null;
  if (!legacySub) {
    return null;
  }

  if (legacySub.startsWith('hangar_panel_')) {
    return {
      kind: 'hangar',
      action: legacySub.slice('hangar_panel_'.length),
    };
  }

  return {
    kind: 'root',
    action: normalizeRootAction(legacySub),
  };
}

/** Breadcrumb root label + the customId that re-renders the root panel in place. */
const USER_BREADCRUMB_ROOT = 'User Hub';
const USER_PANEL_BACK_ID = buildPanelCustomId('user', 'back');

/**
 * Decorate a `/user` category subpanel with a breadcrumb trail and a Back button
 * so the user sees their location (`🧭 User Hub › Hangar`) and can step back to
 * the root panel in place (CMD-06). Routes Back through `user_panel_back`.
 */
function decorateUserSubpanel(panel: EphemeralPanelContent): EphemeralPanelContent {
  return decorateSubpanel(panel, {
    breadcrumb: [USER_BREADCRUMB_ROOT, stripLeadingPanelEmoji(panel.title)],
    backCustomId: USER_PANEL_BACK_ID,
  });
}

/** Breadcrumb middle segment + the customId that re-renders the hangar category. */
const USER_HANGAR_BREADCRUMB_LABEL = 'Hangar';
const USER_HANGAR_BACK_ID = buildPanelCustomId('user', 'hangar');

/**
 * Decorate a nested hangar leaf panel with a 3-level breadcrumb
 * (`🧭 User Hub › Hangar › <Leaf>`) and a Back button that returns to the hangar
 * category panel in place (CMD-06 nested level). Routes Back through
 * `user_panel_hangar`, which re-renders the hangar category subpanel.
 */
function decorateHangarSubpanel(panel: EphemeralPanelContent): EphemeralPanelContent {
  return decorateSubpanel(panel, {
    breadcrumb: [
      USER_BREADCRUMB_ROOT,
      USER_HANGAR_BREADCRUMB_LABEL,
      stripLeadingPanelEmoji(panel.title),
    ],
    backCustomId: USER_HANGAR_BACK_ID,
  });
}

/**
 * Render a nested hangar leaf panel in place with breadcrumb + Back navigation.
 * The `interaction.update` counterpart of the hangar handlers' previous
 * `replyEphemeralPanel`, so drilling into a hangar view and stepping back edits
 * the same ephemeral message instead of stacking replies (CMD-06 nested level).
 */
async function updateHangarSubpanel(
  interaction: ButtonInteraction,
  panel: EphemeralPanelContent
): Promise<void> {
  await updateEphemeralPanel(interaction, decorateHangarSubpanel(panel));
}

/**
 * Build the ephemeral subpanel content for a `/user` root action (or `null`
 * when the action is unknown).
 */
function getUserRootPanelContent(action: string): EphemeralPanelContent | null {
  switch (action) {
    case 'hangar':
      return {
        title: '🚀 User Hangar',
        description:
          'Open live hangar summaries from Discord, then publish a public summary to this channel when needed.',
        rows: [
          buildRow(
            buildButton('user_hangar_panel_summary', 'Summary', '📦', ButtonStyle.Primary),
            buildButton('user_hangar_panel_my_ships', 'My Ships', '🚢'),
            buildButton('user_hangar_panel_insurance', 'Insurance Due', '🛡️'),
            buildButton('user_hangar_panel_loans', 'Loaned', '🤝'),
            buildButton('user_hangar_panel_sharing', 'Sharing', '🔗')
          ),
          buildRow(
            buildButton('user_hangar_panel_open_web', 'Open Web Hangar', '🌐', ButtonStyle.Success),
            buildButton('user_hangar_panel_post_public', 'Post Public', '📣', ButtonStyle.Primary),
            buildButton('user_hangar_panel_add_ship', 'Add Ship', '➕'),
            buildButton('user_hangar_panel_update_ship', 'Update Ship', '✏️'),
            buildButton('user_hangar_panel_delete_ship', 'Delete Ship', '🗑️', ButtonStyle.Danger)
          ),
        ],
      };
    case 'verify':
      return {
        title: '🔐 RSI Verification',
        description:
          'Link your RSI account, validate verification state, and manage your connection.',
        rows: [
          buildRow(
            buildButton('verify_panel_link', 'Link Account', '🔗', ButtonStyle.Success),
            buildButton('verify_panel_check', 'Check Verification', '✅', ButtonStyle.Primary),
            buildButton('verify_panel_user', 'My Verification', '👤'),
            buildButton('verify_panel_unlink', 'Unlink', '❌', ButtonStyle.Danger)
          ),
        ],
      };
    case 'notify':
      // Personal-scope only. /user is open to every member (no
      // setDefaultMemberPermissions), so it must NOT surface guild-mutating
      // notification controls (dm_toggle, lfg_toggle, lfg_config, lfg_mention)
      // or guild settings status views. Those live under `/notify` and `/org`,
      // which are Manage Server gated.
      return {
        title: '🔔 Notifications',
        description:
          'Manage your personal notification preferences. Server-wide notification controls are available under `/notify` (Manage Server only).',
        rows: [
          buildRow(
            buildButton('notify_panel_my_status', 'My Preferences', '👤', ButtonStyle.Primary),
            buildButton('notify_panel_my_toggle', 'Toggle Preferences', '⚙️')
          ),
        ],
      };
    case 'scstats':
      return {
        title: '📊 SCStats Summary',
        description: 'Open personal Star Citizen engagement and invite summary views.',
        rows: [
          buildRow(
            buildButton('stats_panel_me', 'My Stats', '👤', ButtonStyle.Primary),
            buildButton('stats_panel_invites', 'Invites', '📨'),
            buildButton('stats_panel_leaderboard_msg', 'Leaderboard (Msg)', '💬'),
            buildButton('stats_panel_leaderboard_voice', 'Leaderboard (Voice)', '🎤')
          ),
        ],
      };
    case 'profile':
      return {
        title: '👤 Profile Quick Actions',
        description: [
          `Open profile: ${buildAppUrl('/profile')}`,
          `Open account settings: ${buildAppUrl('/settings?tab=account')}`,
          `Open notification settings: ${buildAppUrl('/settings?tab=notifications')}`,
        ].join('\n'),
      };
    case 'security':
      return {
        title: '🛡️ Security Quick Actions',
        description: [
          `Open security settings: ${buildAppUrl('/settings?tab=security')}`,
          `Open API key management: ${buildAppUrl('/settings?tab=api-keys')}`,
          'Use the **RSI Verification** button on `/user` to link or verify your RSI account.',
        ].join('\n'),
      };
    case 'privacy':
      return {
        title: '🔒 Privacy Quick Actions',
        description: [
          `Open privacy & data settings: ${buildAppUrl('/settings?tab=privacy')}`,
          'Consent preferences and data export/delete tools live in the Privacy & Data tab.',
        ].join('\n'),
      };
    case 'account':
      return {
        title: '⚙️ Account Settings Quick Actions',
        description: [
          `Open account settings: ${buildAppUrl('/settings?tab=account')}`,
          `Open notification settings: ${buildAppUrl('/settings?tab=notifications')}`,
        ].join('\n'),
      };
    case 'api_keys':
      return {
        title: '🔑 API Keys Quick Actions',
        description: [
          `Open API keys: ${buildAppUrl('/settings?tab=api-keys')}`,
          'Create and revoke keys from the API Keys settings tab.',
        ].join('\n'),
      };
    case 'help':
      return {
        title: '❓ Help Center',
        description: 'Open help flows for wiki, FAQ, and setup guidance.',
        rows: [
          buildRow(
            buildButton('help_panel_wiki', 'Wiki Help', '📖', ButtonStyle.Primary),
            buildButton('help_panel_faq', 'FAQ', '❓'),
            buildButton('help_panel_server_setup', 'Server Setup', '🛠️'),
            buildButton('help_panel_more_features', 'More Features', '✨')
          ),
        ],
      };
    default:
      return null;
  }
}

/**
 * Build the ephemeral subpanel content for a `/user` hangar action (or `null`
 * when the action is unknown).
 */
async function showHangarSummary(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const summary = await loadHangarSummary(context);

  const publicCount = getCountForKeys(summary.bySharingLevel, HANGAR_PUBLIC_SHARING_KEYS);
  const orgCount = getCountForKeys(summary.bySharingLevel, HANGAR_ORG_SHARING_KEYS);
  const allianceCount = getCountForKeys(summary.bySharingLevel, HANGAR_ALLIANCE_SHARING_KEYS);
  const privateCount = getCountForKeys(summary.bySharingLevel, HANGAR_PRIVATE_SHARING_KEYS);

  await updateHangarSubpanel(interaction, {
    title: '📦 Hangar Summary',
    description: [
      `Total ships: **${summary.totalShips}**`,
      `Insurance due (30d): **${summary.needsInsurance}**`,
      `Estimated value: **${Math.round(summary.totalValue).toLocaleString()}**`,
      '',
      `Sharing → Public **${publicCount}** | Org **${orgCount}** | Alliance **${allianceCount}** | Private **${privateCount}**`,
      `Top roles: ${formatCountRecord(summary.byRole, 4)}`,
      `Top manufacturers: ${formatCountRecord(summary.byManufacturer, 4)}`,
      '',
      `Open full hangar: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

async function showHangarShips(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const page = await getUserShipService().getUserShips(context.userId, {
    page: 1,
    limit: 25,
    sortBy: 'shipName',
    sortOrder: 'ASC',
  });

  await updateHangarSubpanel(interaction, {
    title: '🚢 My Ships',
    description: [
      `Showing ${Math.min(page.data.length, HANGAR_SHIP_PREVIEW_LIMIT)} of ${page.pagination.total} ships:`,
      '',
      formatShipPreview(page.data),
      '',
      `Open full hangar: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

async function showHangarInsurance(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const insuranceDue = await getUserShipService().getShipsNeedingInsurance(context.userId, 30);
  await updateHangarSubpanel(interaction, {
    title: '🛡️ Insurance Due',
    description: [
      `Ships needing insurance soon: **${insuranceDue.length}**`,
      '',
      formatInsurancePreview(insuranceDue),
      '',
      `Open full hangar: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

async function showHangarLoans(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const page = await getUserShipService().getUserShips(context.userId, {
    page: 1,
    limit: 100,
    sortBy: 'updatedAt',
    sortOrder: 'DESC',
  });
  const loaned = page.data.filter(ship => String(ship.status).toLowerCase() === 'loaned');

  await updateHangarSubpanel(interaction, {
    title: '🤝 Loaned Ships',
    description: [
      `Active loans: **${loaned.length}**`,
      '',
      loaned.length > 0
        ? loaned
            .slice(0, HANGAR_SHIP_PREVIEW_LIMIT)
            .map(ship => `• ${formatShipName(ship)} → ${ship.loanedTo ?? 'unknown borrower'}`)
            .join('\n')
        : 'No currently loaned ships.',
      '',
      `Open full hangar: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

async function showHangarSharing(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const summary = await loadHangarSummary(context);

  const publicCount = getCountForKeys(summary.bySharingLevel, HANGAR_PUBLIC_SHARING_KEYS);
  const orgCount = getCountForKeys(summary.bySharingLevel, HANGAR_ORG_SHARING_KEYS);
  const allianceCount = getCountForKeys(summary.bySharingLevel, HANGAR_ALLIANCE_SHARING_KEYS);
  const privateCount = getCountForKeys(summary.bySharingLevel, HANGAR_PRIVATE_SHARING_KEYS);
  const sharedUsersCount = getCountForKeys(summary.bySharingLevel, HANGAR_SHARED_USERS_KEYS);

  await updateHangarSubpanel(interaction, {
    title: '🔗 Sharing Breakdown',
    description: [
      `Public: **${publicCount}**`,
      `Organization: **${orgCount}**`,
      `Alliance: **${allianceCount}**`,
      `Shared Users: **${sharedUsersCount}**`,
      `Private: **${privateCount}**`,
      '',
      `Open full hangar: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

async function showHangarWebLink(interaction: ButtonInteraction): Promise<void> {
  await updateHangarSubpanel(interaction, {
    title: '🌐 Open Web Hangar',
    description: `Open your hangar in the web app: ${buildAppUrl('/hangar')}`,
  });
}

async function postHangarPublicSnapshot(interaction: ButtonInteraction): Promise<void> {
  const context = await resolveHangarContext(interaction);
  if (!context) {
    return;
  }

  const [summary, topShips] = await Promise.all([
    loadHangarSummary(context),
    loadHangarTopShips(context, 3),
  ]);

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({
      content: '❌ Unable to post in this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await channel.send({ embeds: [buildPublicHangarEmbed({ ...context, summary, topShips })] });
  await interaction.reply({
    content: '✅ Posted your hangar summary publicly in this channel.',
    flags: MessageFlags.Ephemeral,
  });
}

async function showHangarPlaceholder(
  interaction: ButtonInteraction,
  title: string,
  verb: string
): Promise<void> {
  await updateHangarSubpanel(interaction, {
    title,
    description: [
      `Phase 2 ${verb} action is not enabled in Discord yet.`,
      `Use web hangar for now: ${buildAppUrl('/hangar')}`,
    ].join('\n'),
  });
}

const HANGAR_ACTION_HANDLERS: Record<string, (interaction: ButtonInteraction) => Promise<void>> = {
  summary: showHangarSummary,
  my_ships: showHangarShips,
  insurance: showHangarInsurance,
  loans: showHangarLoans,
  sharing: showHangarSharing,
  open_web: showHangarWebLink,
  post_public: postHangarPublicSnapshot,
  add_ship: interaction => showHangarPlaceholder(interaction, '➕ Add Ship', 'add ship'),
  update_ship: interaction => showHangarPlaceholder(interaction, '✏️ Update Ship', 'update ship'),
  delete_ship: interaction => showHangarPlaceholder(interaction, '🗑️ Delete Ship', 'delete ship'),
};

async function handleHangarAction(
  interaction: ButtonInteraction,
  action: string
): Promise<boolean> {
  const handler = HANGAR_ACTION_HANDLERS[action];
  if (!handler) {
    return false;
  }

  await handler(interaction);
  return true;
}

/**
 * Build the `/user` root panel (embed + category button rows). Extracted so both
 * the `/user` slash entry and the in-place `user_panel_back` button re-render the
 * identical root panel (CMD-06).
 */
function buildUserRootPanel(): {
  embed: ReturnType<typeof buildUserRootHubEmbed>;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = buildUserRootHubEmbed();

  const row1 = buildRow(
    buildButton('user_panel_hangar', 'Hangar', '🚀', ButtonStyle.Primary),
    buildButton('user_panel_verify', 'RSI Verification', '🔐', ButtonStyle.Primary),
    buildButton('user_panel_notify', 'Notifications', '🔔', ButtonStyle.Success),
    buildButton('user_panel_scstats', 'SCStats', '📊'),
    buildButton('user_panel_profile', 'Profile', '👤')
  );

  const row2 = buildRow(
    buildButton('user_panel_security', 'Security', '🛡️'),
    buildButton('user_panel_privacy', 'Privacy', '🔒'),
    buildButton('user_panel_account', 'Account Settings', '⚙️'),
    buildButton('user_panel_help', 'Help', '❓')
  );

  return { embed, components: [row1, row2] };
}

export const user: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Personal hub: hangar, RSI verification, notifications, SCStats, and settings'),
  category: 'social',
  guildOnly: true,
  examples: ['/user'],
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { embed, components } = buildUserRootPanel();
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const resolvedAction = resolveUserPanelAction(interaction.customId);
    if (!resolvedAction) {
      await interaction.reply({
        content: '❌ This panel action is no longer valid. Run `/user` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (resolvedAction.kind === 'hangar') {
      const handled = await handleHangarAction(interaction, resolvedAction.action);
      if (handled) {
        return;
      }

      await interaction.reply({
        content: '❌ Unknown action. Run `/user` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Back: re-render the root panel in place (CMD-06 in-place navigation).
    if (resolvedAction.action === 'back') {
      const { embed, components } = buildUserRootPanel();
      await interaction.update({ embeds: [embed], components });
      return;
    }

    const panel = getUserRootPanelContent(resolvedAction.action);
    if (!panel) {
      await interaction.reply({
        content: '❌ Unknown action. Run `/user` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Open the category subpanel in place, with breadcrumb + Back navigation.
    await updateEphemeralPanel(interaction, decorateUserSubpanel(panel));
  },
};
