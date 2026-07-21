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
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputStyle,
} from 'discord.js';

import type { Fleet } from '../../models/Fleet';
import { FleetService } from '../../services/fleet/FleetService';
import { logger } from '../../utils/logger';
import { buildOrgPublicFleetSnapshotEmbed, buildOrgRootHubEmbed } from '../embeds/orgEmbeds';
import { buildPanelModal } from '../embeds/panelEmbed';
import { buildAppUrl } from '../utils/appUrls';
import { botApiClient, discordHeaders } from '../utils/botApiClient';
import { formatBotApiError } from '../utils/botErrorFormat';
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
import { resolveGuildContext } from '../utils/guildContext';
import { buildPaginationRow, paginate } from '../utils/paginationControls';

import { BotCommand } from './types';

const ORG_PANEL_ACTION_ALIASES: Record<string, string> = {
  events: 'activities',
  voice_channels: 'voice',
  fleet_web: 'fleet',
};

const ORG_FLEET_PANEL_PREFIX = 'org_fleet_panel_';
const ORG_INVITE_CODE_MODAL_ACCEPT = 'org_invite_code_modal_accept';
const ORG_INVITE_CODE_MODAL_DECLINE = 'org_invite_code_modal_decline';
/** customId prefix for paginating the fleet list: `org_fleet_listpage_<page>`. */
const ORG_FLEET_LIST_PAGE_PREFIX = 'org_fleet_listpage_';
const ORG_FLEET_LIST_PAGE_SIZE = 8;
const ORG_PUBLIC_FLEET_TOP_LIMIT = 3;

type OrgPanelAction =
  | {
      kind: 'root';
      action: string;
    }
  | {
      kind: 'fleet';
      action: string;
    };

interface InviteCodePanelItem {
  organizationName?: string;
  inviteCode?: string;
  status: string;
}

interface BotApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

let _fleetService: FleetService | null = null;
function getFleetService(): FleetService {
  _fleetService ??= new FleetService();
  return _fleetService;
}

function resolveOrgPanelAction(customId: string): OrgPanelAction | null {
  if (customId.startsWith(ORG_FLEET_PANEL_PREFIX)) {
    return {
      kind: 'fleet',
      action: customId.slice(ORG_FLEET_PANEL_PREFIX.length),
    };
  }

  const sub = parsePanelCustomId(customId, 'org');
  if (!sub) {
    return null;
  }

  return {
    kind: 'root',
    action: ORG_PANEL_ACTION_ALIASES[sub] ?? sub,
  };
}

function formatInviteCodeStatus(status: string): string {
  switch (status) {
    case 'approved':
      return 'ready to use';
    case 'pending':
      return 'pending approval';
    case 'declined':
      return 'declined';
    case 'rejected':
      return 'rejected';
    case 'accepted':
      return 'accepted';
    default:
      return status;
  }
}

async function buildInvitationPanel(
  interaction: ButtonInteraction
): Promise<EphemeralPanelContent> {
  const rows = [
    buildRow(
      buildButton('org_panel_invite_accept_code', 'Accept by Code', '✅', ButtonStyle.Success),
      buildButton('org_panel_invite_decline_code', 'Decline by Code', '❌', ButtonStyle.Danger)
    ),
  ];

  const baseLines = [
    'Accept or decline an organization invite by code from a Discord DM, chat message, or your active invitation list.',
  ];

  try {
    const response = await botApiClient.get<BotApiEnvelope<InviteCodePanelItem[]>>(
      '/v2/users/me/invitations',
      { headers: discordHeaders(interaction) }
    );

    const invitations = Array.isArray(response.data?.data) ? response.data.data : [];
    const visibleCodes = invitations.filter(
      invitation => typeof invitation.inviteCode === 'string' && invitation.inviteCode.length > 0
    );

    if (visibleCodes.length === 0) {
      return {
        title: '✉️ Invitations',
        description: [
          ...baseLines,
          '',
          'No active invite codes were found for your linked account.',
          'Invite codes appear here automatically when you receive an invitation.',
        ].join('\n'),
        rows,
      };
    }

    const codeLines = visibleCodes.slice(0, 3).map(invitation => {
      const organizationLabel = invitation.organizationName?.trim() || 'Organization';
      return `• **${organizationLabel}** — \`${invitation.inviteCode}\` (${formatInviteCodeStatus(invitation.status)})`;
    });

    return {
      title: '✉️ Invitations',
      description: [
        ...baseLines,
        '',
        'Your current invite codes:',
        ...codeLines,
        '',
        'Codes only work for the invited account. Pending invitations cannot be accepted until they are approved.',
      ].join('\n'),
      rows,
    };
  } catch (error: unknown) {
    logger.warn('Failed to load invitation codes for org panel', {
      error,
      discordUserId: interaction.user.id,
      guildId: interaction.guildId,
    });

    return {
      title: '✉️ Invitations',
      description: [
        ...baseLines,
        '',
        'I could not load your current invite codes right now.',
        'If you already have a code, you can still use the buttons below.',
      ].join('\n'),
      rows,
    };
  }
}

/** Breadcrumb root label + the customId that re-renders the root panel in place. */
const ORG_BREADCRUMB_ROOT = 'Org Hub';
const ORG_PANEL_BACK_ID = buildPanelCustomId('org', 'back');

/**
 * Decorate an org category subpanel with a breadcrumb trail and a Back button so
 * the user sees their location (`🧭 Org Hub › Activities`) and can step back to
 * the root panel in place (CMD-06). The Back button shares the panel's cooldown
 * scope and routes through `org_panel_back`.
 */
function decorateOrgSubpanel(panel: EphemeralPanelContent): EphemeralPanelContent {
  return decorateSubpanel(panel, {
    breadcrumb: [ORG_BREADCRUMB_ROOT, stripLeadingPanelEmoji(panel.title)],
    backCustomId: ORG_PANEL_BACK_ID,
  });
}

/** Breadcrumb middle segment + the customId that re-renders the fleet category. */
const ORG_FLEET_BREADCRUMB_LABEL = 'Fleet';
const ORG_FLEET_BACK_ID = buildPanelCustomId('org', 'fleet');

/**
 * Decorate a nested fleet-detail leaf panel with a 3-level breadcrumb
 * (`🧭 Org Hub › Fleet › <Leaf>`) and a Back button that returns to the fleet
 * category panel in place (CMD-06 nested level). Back routes through
 * `org_panel_fleet`, which re-renders the fleet category subpanel.
 */
function decorateOrgFleetSubpanel(panel: EphemeralPanelContent): EphemeralPanelContent {
  return decorateSubpanel(panel, {
    breadcrumb: [
      ORG_BREADCRUMB_ROOT,
      ORG_FLEET_BREADCRUMB_LABEL,
      stripLeadingPanelEmoji(panel.title),
    ],
    backCustomId: ORG_FLEET_BACK_ID,
  });
}

/**
 * Render a nested fleet-detail leaf panel in place with breadcrumb + Back
 * navigation. The `interaction.update` counterpart of the fleet handlers'
 * previous `replyEphemeralPanel`, so drilling into a fleet view and stepping
 * back edits the same ephemeral message instead of stacking replies.
 */
async function updateOrgFleetSubpanel(
  interaction: ButtonInteraction,
  panel: EphemeralPanelContent
): Promise<void> {
  await updateEphemeralPanel(interaction, decorateOrgFleetSubpanel(panel));
}

function formatStringBreakdown(values: string[], limit = 3): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => `${key}: ${count}`)
    .join(' • ');

  return top || 'None';
}

function buildPublicFleetEmbed(
  fleets: Fleet[],
  shipCounts: Map<string, number>,
  organizationLabel: string
): EmbedBuilder {
  const totalShips = fleets.reduce(
    (sum, fleet) => sum + (shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0),
    0
  );
  const publicFleetCount = fleets.filter(
    fleet => fleet.publicViewEnabled || fleet.visibility === 'public' || fleet.isPublic
  ).length;
  const activeFleetCount = fleets.filter(fleet => fleet.status === 'active').length;
  const statusBreakdown = formatStringBreakdown(
    fleets.map(fleet => String(fleet.status ?? 'unknown').toLowerCase()),
    ORG_PUBLIC_FLEET_TOP_LIMIT
  );
  const roleBreakdown = formatStringBreakdown(
    fleets.map(fleet => String(fleet.type ?? 'unknown').toLowerCase()),
    ORG_PUBLIC_FLEET_TOP_LIMIT
  );
  const topFleets = [...fleets]
    .sort((a, b) => {
      const aCount = shipCounts.get(a.id) ?? a.shipIds?.length ?? 0;
      const bCount = shipCounts.get(b.id) ?? b.shipIds?.length ?? 0;
      return bCount - aCount;
    })
    .slice(0, ORG_PUBLIC_FLEET_TOP_LIMIT)
    .map((fleet, index) => {
      const count = shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0;
      const status = String(fleet.status ?? 'unknown').toLowerCase();
      const type = String(fleet.type ?? 'unknown').toLowerCase();
      return `${index + 1}. ${fleet.name} • ${count} ships • ${status}/${type}`;
    })
    .join('\n');

  return buildOrgPublicFleetSnapshotEmbed({
    organizationLabel,
    totalFleets: fleets.length,
    totalShips,
    activeFleetCount,
    publicFleetCount,
    statusBreakdown,
    roleBreakdown,
    topFleets,
    fleetUrl: buildAppUrl('/fleet'),
  });
}

/**
 * Build one page of the org fleet-list panel description + pagination nav row.
 *
 * Pure — the caller decides how to render (the leaf and the page handler both
 * wrap it in `updateOrgFleetSubpanel` for in-place navigation). Fleets are
 * paginated client-side via the shared `paginate` helper (org fleet counts are
 * naturally bounded). Returns `navRow: null` when everything fits on one page.
 * Exported for unit testing.
 */
export function buildOrgFleetListPanel(
  fleets: Fleet[],
  shipCounts: Map<string, number>,
  page: number
): { description: string; navRow: ActionRowBuilder<ButtonBuilder> | null } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(fleets, page, ORG_FLEET_LIST_PAGE_SIZE);

  const lines = pageItems
    .map((fleet, index) => {
      const count = shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0;
      const status = String(fleet.status ?? 'unknown').toLowerCase();
      // Continuous global numbering across pages.
      return `${currentPage * ORG_FLEET_LIST_PAGE_SIZE + index + 1}. ${fleet.name} • ${count} ships • ${status}`;
    })
    .join('\n');

  const header =
    totalPages > 1
      ? `Page ${currentPage + 1} of ${totalPages} • ${total} fleets:`
      : `${total} fleet(s):`;

  const description = [
    header,
    '',
    lines || 'No fleets found yet.',
    '',
    `Open full fleet view: ${buildAppUrl('/fleet')}`,
  ].join('\n');

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage => `${ORG_FLEET_LIST_PAGE_PREFIX}${targetPage}`,
  });

  return { description, navRow };
}

/** Page through the org fleet list via the shared pagination row. */
async function handleOrgFleetListPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = Number.parseInt(interaction.customId.slice(ORG_FLEET_LIST_PAGE_PREFIX.length), 10);
  // Ignore a non-numeric/negative page (the disabled control emits `..._-1`).
  if (Number.isNaN(page) || page < 0) {
    return;
  }

  const context = await resolveGuildContext(interaction);
  if (!context) {
    return;
  }

  const { fleets, shipCounts } = await getFleetService().getFleetSnapshot(context.organizationId);
  const { description, navRow } = buildOrgFleetListPanel(fleets, shipCounts, page);

  // Edit the existing ephemeral list message in place, preserving the 3-level
  // breadcrumb + Back button so paging keeps the nested navigation affordances.
  await updateOrgFleetSubpanel(interaction, {
    title: '📋 Fleet List',
    description,
    rows: navRow ? [navRow] : [],
  });
}

async function handleFleetPanelAction(
  interaction: ButtonInteraction,
  action: string
): Promise<boolean> {
  if (action === 'open_web') {
    await updateOrgFleetSubpanel(interaction, {
      title: '🌐 Open Web Fleet',
      description: `Open your fleet management view in the web app: ${buildAppUrl('/fleet')}`,
    });
    return true;
  }

  const context = await resolveGuildContext(interaction);
  if (!context) {
    return true;
  }

  const { fleets, shipCounts } = await getFleetService().getFleetSnapshot(context.organizationId);

  if (action === 'summary') {
    const totalShips = fleets.reduce(
      (sum, fleet) => sum + (shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0),
      0
    );
    const publicFleetCount = fleets.filter(
      fleet => fleet.publicViewEnabled || fleet.visibility === 'public' || fleet.isPublic
    ).length;
    const activeFleetCount = fleets.filter(fleet => fleet.status === 'active').length;

    await updateOrgFleetSubpanel(interaction, {
      title: '📦 Fleet Summary',
      description: [
        `Fleets: **${fleets.length}**`,
        `Ships assigned: **${totalShips}**`,
        `Active fleets: **${activeFleetCount}**`,
        `Public-enabled fleets: **${publicFleetCount}**`,
        '',
        `Open full fleet view: ${buildAppUrl('/fleet')}`,
      ].join('\n'),
    });
    return true;
  }

  if (action === 'list') {
    const { description, navRow } = buildOrgFleetListPanel(fleets, shipCounts, 0);

    await updateOrgFleetSubpanel(interaction, {
      title: '📋 Fleet List',
      description,
      rows: navRow ? [navRow] : [],
    });
    return true;
  }

  if (action === 'post_public') {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      await interaction.reply({
        content: '❌ Unable to post in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const organizationLabel = interaction.guild?.name ?? 'Organization';
    await channel.send({ embeds: [buildPublicFleetEmbed(fleets, shipCounts, organizationLabel)] });
    await interaction.reply({
      content: '✅ Posted a public fleet snapshot in this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

function getOrgPanelContent(sub: string): EphemeralPanelContent | null {
  switch (sub) {
    case 'activities':
      return {
        title: '📅 Activities',
        description: 'Handoff to events, mirroring, and ready-check controls.',
        rows: [
          buildRow(
            buildButton('event_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('event_panel_create', 'Create', '➕', ButtonStyle.Success),
            buildButton('event_panel_my', 'My Events', '👤')
          ),
        ],
      };
    case 'missions':
      return {
        title: '🧭 Missions',
        description: 'Handoff to mission panel.',
        rows: [
          buildRow(
            buildButton('mission_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('mission_panel_active', 'Active', '🟢'),
            buildButton('mission_panel_view', 'View', '🔍'),
            buildButton('mission_panel_briefing', 'Briefing', '📝')
          ),
        ],
      };
    case 'bounties':
      return {
        title: '🎯 Bounties',
        description: 'Handoff to bounty panel.',
        rows: [
          buildRow(
            buildButton('bounty_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('bounty_panel_myclaims', 'My Claims', '📌'),
            buildButton('bounty_panel_claim', 'Claim', '🎯')
          ),
        ],
      };
    case 'lfg':
      return {
        title: '🎯 LFG',
        description: 'Handoff to LFG panel.',
        rows: [
          buildRow(
            buildButton('lfg_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('lfg_panel_create', 'Create', '➕', ButtonStyle.Success),
            buildButton('lfg_panel_match', 'Match', '🎯'),
            buildButton('lfg_panel_settings', 'Settings', '⚙️')
          ),
        ],
      };
    case 'attendance':
      return {
        title: '📋 Attendance',
        description: 'Handoff to attendance panel.',
        rows: [
          buildRow(
            buildButton('attend_panel_history', 'History', '📅', ButtonStyle.Primary),
            buildButton('attend_panel_leaderboard', 'Leaderboard', '🏆'),
            buildButton('attend_panel_confirm', 'Confirm', '✅', ButtonStyle.Success),
            buildButton('attend_panel_stats', 'Stats', '📊'),
            buildButton('attend_panel_report', 'Report', '🧾')
          ),
        ],
      };
    case 'announcements':
      return {
        title: '📢 Announcements',
        description: 'Handoff to announcement panel.',
        rows: [
          buildRow(
            buildButton('announce_panel_create', 'Create', '✏️', ButtonStyle.Success),
            buildButton('announce_panel_list', 'View All', '📋', ButtonStyle.Primary),
            buildButton('announce_panel_send', 'Send', '📤'),
            buildButton('announce_panel_schedule', 'Schedule', '📅'),
            buildButton('announce_panel_status', 'Status', '📊')
          ),
        ],
      };
    case 'polls':
      return {
        title: '🗳️ Polls',
        description: 'Handoff to poll panel.',
        rows: [
          buildRow(
            buildButton('poll_panel_create', 'Create', '➕', ButtonStyle.Success),
            buildButton('poll_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('poll_panel_post', 'Post', '📢'),
            buildButton('poll_panel_results', 'Results', '📊'),
            buildButton('poll_panel_close', 'Close', '🔒', ButtonStyle.Danger)
          ),
        ],
      };
    case 'recruitment':
      return {
        title: '📋 Recruitment',
        description: 'Handoff to recruitment panel.',
        rows: [
          buildRow(
            buildButton('recruitment_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('recruitment_panel_apply', 'Apply', '📝', ButtonStyle.Success),
            buildButton('recruitment_panel_my_apps', 'My Applications', '📄'),
            buildButton('recruitment_panel_panel', 'Post Panel', '📌'),
            buildButton('recruitment_panel_customize', 'Customize', '⚙️')
          ),
        ],
      };
    case 'tickets':
      return {
        title: '🎫 Tickets',
        description: 'Handoff to ticket panel.',
        rows: [
          buildRow(
            buildButton('ticket_panel_create', 'Create', '➕', ButtonStyle.Success),
            buildButton('ticket_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('ticket_panel_panel', 'Post Panel', '📌')
          ),
        ],
      };
    case 'invitations':
      return {
        title: '✉️ Invitations',
        description:
          'Accept or decline an organization invite by code from a Discord DM, chat message, or your active invitation list.',
        rows: [
          buildRow(
            buildButton(
              'org_panel_invite_accept_code',
              'Accept by Code',
              '✅',
              ButtonStyle.Success
            ),
            buildButton(
              'org_panel_invite_decline_code',
              'Decline by Code',
              '❌',
              ButtonStyle.Danger
            )
          ),
        ],
      };
    case 'voice':
      return {
        title: '🔊 Voice',
        description: 'Handoff to voice panel.',
        rows: [
          buildRow(
            buildButton('voice_panel_create', 'Create Channel', '🔊', ButtonStyle.Success),
            buildButton('voice_panel_templates', 'Templates', '📋', ButtonStyle.Primary),
            buildButton('voice_panel_setup', 'Hub Setup', '⚙️'),
            buildButton('voice_panel_mumble', 'Mumble', '🎧')
          ),
        ],
      };
    case 'rsi_status':
      return {
        title: '🛰️ RSI Status',
        description: 'Handoff to RSI status panel.',
        rows: [
          buildRow(
            buildButton('rsistatus_panel_check', 'Check Status', '📡', ButtonStyle.Primary),
            buildButton('rsistatus_panel_deploy', 'Deploy Live Panel', '📌', ButtonStyle.Success),
            buildButton('rsistatus_panel_channels', 'Status Channels', '🏷️'),
            buildButton('rsistatus_panel_remove', 'Remove Panel', '🗑️', ButtonStyle.Danger)
          ),
        ],
      };
    case 'guild':
      return {
        title: '🏛️ Guild Setup',
        description: 'Handoff to guild panel.',
        rows: [
          buildRow(
            buildButton('guild_panel_status', 'Status', '📊', ButtonStyle.Primary),
            buildButton('guild_panel_setup', 'Setup', '🔗', ButtonStyle.Success),
            buildButton('guild_panel_settings', 'Settings', '⚙️'),
            buildButton('guild_panel_help_settings', 'Help', '❓'),
            buildButton('guild_panel_unlink', 'Unlink', '❌', ButtonStyle.Danger)
          ),
        ],
      };
    case 'commlink':
      return {
        title: '🌉 Comm Links',
        description: 'Handoff to commlink panel.',
        rows: [
          buildRow(
            buildButton('commlink_panel_list', 'List', '📋', ButtonStyle.Primary),
            buildButton('commlink_panel_create', 'Create', '➕', ButtonStyle.Success),
            buildButton('commlink_panel_join', 'Join', '🔗'),
            buildButton('commlink_panel_link', 'Link Code', '🧷'),
            buildButton('commlink_panel_settings', 'Settings', '⚙️')
          ),
        ],
      };
    case 'moderation':
      return {
        title: '🛡️ Moderation',
        description: 'Handoff to moderation panel.',
        rows: [
          buildRow(
            buildButton('moderation_panel_stats', 'Stats', '📊', ButtonStyle.Primary),
            buildButton('moderation_panel_list', 'List Incidents', '📋'),
            buildButton('moderation_panel_alerts', 'Alerts', '🔔'),
            buildButton('moderation_panel_settings', 'Settings', '⚙️'),
            buildButton('moderation_panel_report', 'Report', '🧾')
          ),
        ],
      };
    case 'fleet':
      return {
        title: '🚀 Fleet Panel',
        description: 'Review fleet data, list fleets, or post a public fleet snapshot.',
        rows: [
          buildRow(
            buildButton('org_fleet_panel_summary', 'Summary', '📦', ButtonStyle.Primary),
            buildButton('org_fleet_panel_list', 'Fleet List', '📋'),
            buildButton('org_fleet_panel_post_public', 'Post Public', '📣', ButtonStyle.Success),
            buildButton('org_fleet_panel_open_web', 'Open Web Fleet', '🌐')
          ),
        ],
      };
    case 'logistics_web':
      return {
        title: '📦 Logistics Web',
        description: `Open logistics web app: ${buildAppUrl('/logistics')}`,
      };
    default:
      return null;
  }
}

/**
 * Build the org root panel (embed + category button rows). Extracted so both the
 * `/org` slash entry and the in-place `org_panel_back` button re-render the
 * identical root panel (CMD-06).
 */
function buildOrgRootPanel(): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = buildOrgRootHubEmbed();

  const row1 = buildRow(
    buildButton('org_panel_activities', 'Activities', '📅', ButtonStyle.Primary),
    buildButton('org_panel_missions', 'Missions', '🧭', ButtonStyle.Success),
    buildButton('org_panel_bounties', 'Bounties', '🎯'),
    buildButton('org_panel_lfg', 'LFG', '🎯'),
    buildButton('org_panel_attendance', 'Attendance', '📋')
  );

  const row2 = buildRow(
    buildButton('org_panel_announcements', 'Announcements', '📢'),
    buildButton('org_panel_polls', 'Polls', '🗳️'),
    buildButton('org_panel_recruitment', 'Recruitment', '📋'),
    buildButton('org_panel_tickets', 'Tickets', '🎫'),
    buildButton('org_panel_voice', 'Voice', '🔊')
  );

  const row3 = buildRow(
    buildButton('org_panel_guild', 'Guild Setup', '🏛️', ButtonStyle.Primary),
    buildButton('org_panel_moderation', 'Moderation', '🛡️'),
    buildButton('org_panel_commlink', 'Commlink', '🌉'),
    buildButton('org_panel_fleet', 'Fleet', '🚀', ButtonStyle.Success),
    buildButton('org_panel_logistics_web', 'Logistics Web', '📦', ButtonStyle.Success)
  );

  const row4 = buildRow(buildButton('org_panel_rsi_status', 'RSI Status', '🛰️'));

  const row5 = buildRow(buildButton('org_panel_invitations', 'Invitations', '✉️'));

  return { embed, components: [row1, row2, row3, row4, row5] };
}

function buildInviteCodeModal(mode: 'accept' | 'decline'): ModalBuilder {
  const title = mode === 'accept' ? 'Accept Invitation by Code' : 'Decline Invitation by Code';
  const customId = mode === 'accept' ? ORG_INVITE_CODE_MODAL_ACCEPT : ORG_INVITE_CODE_MODAL_DECLINE;

  return buildPanelModal(customId, title, [
    {
      customId: 'invite_code',
      label: 'Invite Code',
      placeholder: 'Example: ABCD1234',
      style: TextInputStyle.Short,
      required: true,
      minLength: 8,
      maxLength: 8,
    },
  ]);
}

async function submitInviteCodeAction(
  interaction: ModalSubmitInteraction,
  mode: 'accept' | 'decline',
  code: string
): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
    await interaction.editReply({
      content: '❌ Invalid invite code format. Invite codes must be 8 letters/numbers.',
    });
    return;
  }

  const endpoint =
    mode === 'accept'
      ? `/v2/invitations/code/${normalizedCode}/accept`
      : `/v2/invitations/code/${normalizedCode}/decline`;

  try {
    await botApiClient.post(endpoint, {}, { headers: discordHeaders(interaction) });
    const message =
      mode === 'accept'
        ? `✅ Invitation code **${normalizedCode}** accepted. You were added to the organization.`
        : `✅ Invitation code **${normalizedCode}** declined.`;
    await interaction.editReply({ content: message });
  } catch (error: unknown) {
    const msg = formatBotApiError(error, 'Failed to process invitation code', 'org-invite-code');
    await interaction.editReply({ content: `❌ ${msg}` });
  }
}

export const org: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('org')
    .setDescription('Organization command hub for operations, governance, and coordination')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: 'organization',
  guildOnly: true,
  examples: ['/org'],
  permissions: ['ManageGuild'],
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { embed, components } = buildOrgRootPanel();
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    // Fleet-list pagination (org_fleet_listpage_<n>) — edits the ephemeral list in place.
    if (interaction.customId.startsWith(ORG_FLEET_LIST_PAGE_PREFIX)) {
      await handleOrgFleetListPageButton(interaction);
      return;
    }

    const resolved = resolveOrgPanelAction(interaction.customId);
    if (!resolved) {
      await interaction.reply({
        content: '❌ This panel action is no longer valid. Run `/org` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (resolved.kind === 'fleet') {
      const handled = await handleFleetPanelAction(interaction, resolved.action);
      if (handled) {
        return;
      }

      await interaction.reply({
        content: '❌ Unknown action. Run `/org` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Back: re-render the root panel in place (CMD-06 in-place navigation).
    if (resolved.action === 'back') {
      const { embed, components } = buildOrgRootPanel();
      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (resolved.action === 'invite_accept_code') {
      await interaction.showModal(buildInviteCodeModal('accept'));
      return;
    }

    if (resolved.action === 'invite_decline_code') {
      await interaction.showModal(buildInviteCodeModal('decline'));
      return;
    }

    if (resolved.action === 'invitations') {
      await updateEphemeralPanel(
        interaction,
        decorateOrgSubpanel(await buildInvitationPanel(interaction))
      );
      return;
    }

    const panel = getOrgPanelContent(resolved.action);
    if (!panel) {
      await interaction.reply({
        content: '❌ Unknown action. Run `/org` again to refresh.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Open the category subpanel in place, with breadcrumb + Back navigation.
    await updateEphemeralPanel(interaction, decorateOrgSubpanel(panel));
  },

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (
      interaction.customId !== ORG_INVITE_CODE_MODAL_ACCEPT &&
      interaction.customId !== ORG_INVITE_CODE_MODAL_DECLINE
    ) {
      return;
    }

    const mode = interaction.customId === ORG_INVITE_CODE_MODAL_ACCEPT ? 'accept' : 'decline';
    const code = interaction.fields.getTextInputValue('invite_code');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await submitInviteCodeAction(interaction, mode, code);
  },
};
