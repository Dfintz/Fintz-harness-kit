"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.org = void 0;
exports.buildOrgFleetListPanel = buildOrgFleetListPanel;
const discord_js_1 = require("discord.js");
const FleetService_1 = require("../../services/fleet/FleetService");
const logger_1 = require("../../utils/logger");
const orgEmbeds_1 = require("../embeds/orgEmbeds");
const panelEmbed_1 = require("../embeds/panelEmbed");
const appUrls_1 = require("../utils/appUrls");
const botApiClient_1 = require("../utils/botApiClient");
const botErrorFormat_1 = require("../utils/botErrorFormat");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const guildContext_1 = require("../utils/guildContext");
const paginationControls_1 = require("../utils/paginationControls");
const ORG_PANEL_ACTION_ALIASES = {
    events: 'activities',
    voice_channels: 'voice',
    fleet_web: 'fleet',
};
const ORG_FLEET_PANEL_PREFIX = 'org_fleet_panel_';
const ORG_INVITE_CODE_MODAL_ACCEPT = 'org_invite_code_modal_accept';
const ORG_INVITE_CODE_MODAL_DECLINE = 'org_invite_code_modal_decline';
const ORG_FLEET_LIST_PAGE_PREFIX = 'org_fleet_listpage_';
const ORG_FLEET_LIST_PAGE_SIZE = 8;
const ORG_PUBLIC_FLEET_TOP_LIMIT = 3;
let _fleetService = null;
function getFleetService() {
    _fleetService ??= new FleetService_1.FleetService();
    return _fleetService;
}
function resolveOrgPanelAction(customId) {
    if (customId.startsWith(ORG_FLEET_PANEL_PREFIX)) {
        return {
            kind: 'fleet',
            action: customId.slice(ORG_FLEET_PANEL_PREFIX.length),
        };
    }
    const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(customId, 'org');
    if (!sub) {
        return null;
    }
    return {
        kind: 'root',
        action: ORG_PANEL_ACTION_ALIASES[sub] ?? sub,
    };
}
function formatInviteCodeStatus(status) {
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
async function buildInvitationPanel(interaction) {
    const rows = [
        (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_invite_accept_code', 'Accept by Code', '✅', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('org_panel_invite_decline_code', 'Decline by Code', '❌', discord_js_1.ButtonStyle.Danger)),
    ];
    const baseLines = [
        'Accept or decline an organization invite by code from a Discord DM, chat message, or your active invitation list.',
    ];
    try {
        const response = await botApiClient_1.botApiClient.get('/v2/users/me/invitations', { headers: (0, botApiClient_1.discordHeaders)(interaction) });
        const invitations = Array.isArray(response.data?.data) ? response.data.data : [];
        const visibleCodes = invitations.filter(invitation => typeof invitation.inviteCode === 'string' && invitation.inviteCode.length > 0);
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
    }
    catch (error) {
        logger_1.logger.warn('Failed to load invitation codes for org panel', {
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
const ORG_BREADCRUMB_ROOT = 'Org Hub';
const ORG_PANEL_BACK_ID = (0, commandPanelBuilder_1.buildPanelCustomId)('org', 'back');
function decorateOrgSubpanel(panel) {
    return (0, commandPanelBuilder_1.decorateSubpanel)(panel, {
        breadcrumb: [ORG_BREADCRUMB_ROOT, (0, commandPanelBuilder_1.stripLeadingPanelEmoji)(panel.title)],
        backCustomId: ORG_PANEL_BACK_ID,
    });
}
const ORG_FLEET_BREADCRUMB_LABEL = 'Fleet';
const ORG_FLEET_BACK_ID = (0, commandPanelBuilder_1.buildPanelCustomId)('org', 'fleet');
function decorateOrgFleetSubpanel(panel) {
    return (0, commandPanelBuilder_1.decorateSubpanel)(panel, {
        breadcrumb: [
            ORG_BREADCRUMB_ROOT,
            ORG_FLEET_BREADCRUMB_LABEL,
            (0, commandPanelBuilder_1.stripLeadingPanelEmoji)(panel.title),
        ],
        backCustomId: ORG_FLEET_BACK_ID,
    });
}
async function updateOrgFleetSubpanel(interaction, panel) {
    await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateOrgFleetSubpanel(panel));
}
function formatStringBreakdown(values, limit = 3) {
    const counts = new Map();
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
function buildPublicFleetEmbed(fleets, shipCounts, organizationLabel) {
    const totalShips = fleets.reduce((sum, fleet) => sum + (shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0), 0);
    const publicFleetCount = fleets.filter(fleet => fleet.publicViewEnabled || fleet.visibility === 'public' || fleet.isPublic).length;
    const activeFleetCount = fleets.filter(fleet => fleet.status === 'active').length;
    const statusBreakdown = formatStringBreakdown(fleets.map(fleet => String(fleet.status ?? 'unknown').toLowerCase()), ORG_PUBLIC_FLEET_TOP_LIMIT);
    const roleBreakdown = formatStringBreakdown(fleets.map(fleet => String(fleet.type ?? 'unknown').toLowerCase()), ORG_PUBLIC_FLEET_TOP_LIMIT);
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
    return (0, orgEmbeds_1.buildOrgPublicFleetSnapshotEmbed)({
        organizationLabel,
        totalFleets: fleets.length,
        totalShips,
        activeFleetCount,
        publicFleetCount,
        statusBreakdown,
        roleBreakdown,
        topFleets,
        fleetUrl: (0, appUrls_1.buildAppUrl)('/fleet'),
    });
}
function buildOrgFleetListPanel(fleets, shipCounts, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(fleets, page, ORG_FLEET_LIST_PAGE_SIZE);
    const lines = pageItems
        .map((fleet, index) => {
        const count = shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0;
        const status = String(fleet.status ?? 'unknown').toLowerCase();
        return `${currentPage * ORG_FLEET_LIST_PAGE_SIZE + index + 1}. ${fleet.name} • ${count} ships • ${status}`;
    })
        .join('\n');
    const header = totalPages > 1
        ? `Page ${currentPage + 1} of ${totalPages} • ${total} fleets:`
        : `${total} fleet(s):`;
    const description = [
        header,
        '',
        lines || 'No fleets found yet.',
        '',
        `Open full fleet view: ${(0, appUrls_1.buildAppUrl)('/fleet')}`,
    ].join('\n');
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => `${ORG_FLEET_LIST_PAGE_PREFIX}${targetPage}`,
    });
    return { description, navRow };
}
async function handleOrgFleetListPageButton(interaction) {
    const page = Number.parseInt(interaction.customId.slice(ORG_FLEET_LIST_PAGE_PREFIX.length), 10);
    if (Number.isNaN(page) || page < 0) {
        return;
    }
    const context = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!context) {
        return;
    }
    const { fleets, shipCounts } = await getFleetService().getFleetSnapshot(context.organizationId);
    const { description, navRow } = buildOrgFleetListPanel(fleets, shipCounts, page);
    await updateOrgFleetSubpanel(interaction, {
        title: '📋 Fleet List',
        description,
        rows: navRow ? [navRow] : [],
    });
}
async function handleFleetPanelAction(interaction, action) {
    if (action === 'open_web') {
        await updateOrgFleetSubpanel(interaction, {
            title: '🌐 Open Web Fleet',
            description: `Open your fleet management view in the web app: ${(0, appUrls_1.buildAppUrl)('/fleet')}`,
        });
        return true;
    }
    const context = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!context) {
        return true;
    }
    const { fleets, shipCounts } = await getFleetService().getFleetSnapshot(context.organizationId);
    if (action === 'summary') {
        const totalShips = fleets.reduce((sum, fleet) => sum + (shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0), 0);
        const publicFleetCount = fleets.filter(fleet => fleet.publicViewEnabled || fleet.visibility === 'public' || fleet.isPublic).length;
        const activeFleetCount = fleets.filter(fleet => fleet.status === 'active').length;
        await updateOrgFleetSubpanel(interaction, {
            title: '📦 Fleet Summary',
            description: [
                `Fleets: **${fleets.length}**`,
                `Ships assigned: **${totalShips}**`,
                `Active fleets: **${activeFleetCount}**`,
                `Public-enabled fleets: **${publicFleetCount}**`,
                '',
                `Open full fleet view: ${(0, appUrls_1.buildAppUrl)('/fleet')}`,
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
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return true;
        }
        const organizationLabel = interaction.guild?.name ?? 'Organization';
        await channel.send({ embeds: [buildPublicFleetEmbed(fleets, shipCounts, organizationLabel)] });
        await interaction.reply({
            content: '✅ Posted a public fleet snapshot in this channel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return true;
    }
    return false;
}
function getOrgPanelContent(sub) {
    switch (sub) {
        case 'activities':
            return {
                title: '📅 Activities',
                description: 'Handoff to events, mirroring, and ready-check controls.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('event_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('event_panel_create', 'Create', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('event_panel_my', 'My Events', '👤')),
                ],
            };
        case 'missions':
            return {
                title: '🧭 Missions',
                description: 'Handoff to mission panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('mission_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('mission_panel_active', 'Active', '🟢'), (0, commandPanelBuilder_1.buildButton)('mission_panel_view', 'View', '🔍'), (0, commandPanelBuilder_1.buildButton)('mission_panel_briefing', 'Briefing', '📝')),
                ],
            };
        case 'bounties':
            return {
                title: '🎯 Bounties',
                description: 'Handoff to bounty panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('bounty_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('bounty_panel_myclaims', 'My Claims', '📌'), (0, commandPanelBuilder_1.buildButton)('bounty_panel_claim', 'Claim', '🎯')),
                ],
            };
        case 'lfg':
            return {
                title: '🎯 LFG',
                description: 'Handoff to LFG panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('lfg_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('lfg_panel_create', 'Create', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('lfg_panel_match', 'Match', '🎯'), (0, commandPanelBuilder_1.buildButton)('lfg_panel_settings', 'Settings', '⚙️')),
                ],
            };
        case 'attendance':
            return {
                title: '📋 Attendance',
                description: 'Handoff to attendance panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('attend_panel_history', 'History', '📅', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('attend_panel_leaderboard', 'Leaderboard', '🏆'), (0, commandPanelBuilder_1.buildButton)('attend_panel_confirm', 'Confirm', '✅', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('attend_panel_stats', 'Stats', '📊'), (0, commandPanelBuilder_1.buildButton)('attend_panel_report', 'Report', '🧾')),
                ],
            };
        case 'announcements':
            return {
                title: '📢 Announcements',
                description: 'Handoff to announcement panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('announce_panel_create', 'Create', '✏️', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('announce_panel_list', 'View All', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('announce_panel_send', 'Send', '📤'), (0, commandPanelBuilder_1.buildButton)('announce_panel_schedule', 'Schedule', '📅'), (0, commandPanelBuilder_1.buildButton)('announce_panel_status', 'Status', '📊')),
                ],
            };
        case 'polls':
            return {
                title: '🗳️ Polls',
                description: 'Handoff to poll panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('poll_panel_create', 'Create', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('poll_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('poll_panel_post', 'Post', '📢'), (0, commandPanelBuilder_1.buildButton)('poll_panel_results', 'Results', '📊'), (0, commandPanelBuilder_1.buildButton)('poll_panel_close', 'Close', '🔒', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'recruitment':
            return {
                title: '📋 Recruitment',
                description: 'Handoff to recruitment panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('recruitment_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_apply', 'Apply', '📝', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_my_apps', 'My Applications', '📄'), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_panel', 'Post Panel', '📌'), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_customize', 'Customize', '⚙️')),
                ],
            };
        case 'tickets':
            return {
                title: '🎫 Tickets',
                description: 'Handoff to ticket panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('ticket_panel_create', 'Create', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('ticket_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('ticket_panel_panel', 'Post Panel', '📌')),
                ],
            };
        case 'invitations':
            return {
                title: '✉️ Invitations',
                description: 'Accept or decline an organization invite by code from a Discord DM, chat message, or your active invitation list.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_invite_accept_code', 'Accept by Code', '✅', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('org_panel_invite_decline_code', 'Decline by Code', '❌', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'voice':
            return {
                title: '🔊 Voice',
                description: 'Handoff to voice panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('voice_panel_create', 'Create Channel', '🔊', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('voice_panel_templates', 'Templates', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('voice_panel_setup', 'Hub Setup', '⚙️'), (0, commandPanelBuilder_1.buildButton)('voice_panel_mumble', 'Mumble', '🎧')),
                ],
            };
        case 'rsi_status':
            return {
                title: '🛰️ RSI Status',
                description: 'Handoff to RSI status panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('rsistatus_panel_check', 'Check Status', '📡', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('rsistatus_panel_deploy', 'Deploy Live Panel', '📌', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('rsistatus_panel_channels', 'Status Channels', '🏷️'), (0, commandPanelBuilder_1.buildButton)('rsistatus_panel_remove', 'Remove Panel', '🗑️', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'guild':
            return {
                title: '🏛️ Guild Setup',
                description: 'Handoff to guild panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('guild_panel_status', 'Status', '📊', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('guild_panel_setup', 'Setup', '🔗', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('guild_panel_settings', 'Settings', '⚙️'), (0, commandPanelBuilder_1.buildButton)('guild_panel_help_settings', 'Help', '❓'), (0, commandPanelBuilder_1.buildButton)('guild_panel_unlink', 'Unlink', '❌', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'commlink':
            return {
                title: '🌉 Comm Links',
                description: 'Handoff to commlink panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('commlink_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('commlink_panel_create', 'Create', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('commlink_panel_join', 'Join', '🔗'), (0, commandPanelBuilder_1.buildButton)('commlink_panel_link', 'Link Code', '🧷'), (0, commandPanelBuilder_1.buildButton)('commlink_panel_settings', 'Settings', '⚙️')),
                ],
            };
        case 'moderation':
            return {
                title: '🛡️ Moderation',
                description: 'Handoff to moderation panel.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('moderation_panel_stats', 'Stats', '📊', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('moderation_panel_list', 'List Incidents', '📋'), (0, commandPanelBuilder_1.buildButton)('moderation_panel_alerts', 'Alerts', '🔔'), (0, commandPanelBuilder_1.buildButton)('moderation_panel_settings', 'Settings', '⚙️'), (0, commandPanelBuilder_1.buildButton)('moderation_panel_report', 'Report', '🧾')),
                ],
            };
        case 'fleet':
            return {
                title: '🚀 Fleet Panel',
                description: 'Review fleet data, list fleets, or post a public fleet snapshot.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_fleet_panel_summary', 'Summary', '📦', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('org_fleet_panel_list', 'Fleet List', '📋'), (0, commandPanelBuilder_1.buildButton)('org_fleet_panel_post_public', 'Post Public', '📣', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('org_fleet_panel_open_web', 'Open Web Fleet', '🌐')),
                ],
            };
        case 'logistics_web':
            return {
                title: '📦 Logistics Web',
                description: `Open logistics web app: ${(0, appUrls_1.buildAppUrl)('/logistics')}`,
            };
        default:
            return null;
    }
}
function buildOrgRootPanel() {
    const embed = (0, orgEmbeds_1.buildOrgRootHubEmbed)();
    const row1 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_activities', 'Activities', '📅', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('org_panel_missions', 'Missions', '🧭', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('org_panel_bounties', 'Bounties', '🎯'), (0, commandPanelBuilder_1.buildButton)('org_panel_lfg', 'LFG', '🎯'), (0, commandPanelBuilder_1.buildButton)('org_panel_attendance', 'Attendance', '📋'));
    const row2 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_announcements', 'Announcements', '📢'), (0, commandPanelBuilder_1.buildButton)('org_panel_polls', 'Polls', '🗳️'), (0, commandPanelBuilder_1.buildButton)('org_panel_recruitment', 'Recruitment', '📋'), (0, commandPanelBuilder_1.buildButton)('org_panel_tickets', 'Tickets', '🎫'), (0, commandPanelBuilder_1.buildButton)('org_panel_voice', 'Voice', '🔊'));
    const row3 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_guild', 'Guild Setup', '🏛️', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('org_panel_moderation', 'Moderation', '🛡️'), (0, commandPanelBuilder_1.buildButton)('org_panel_commlink', 'Commlink', '🌉'), (0, commandPanelBuilder_1.buildButton)('org_panel_fleet', 'Fleet', '🚀', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('org_panel_logistics_web', 'Logistics Web', '📦', discord_js_1.ButtonStyle.Success));
    const row4 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_rsi_status', 'RSI Status', '🛰️'));
    const row5 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('org_panel_invitations', 'Invitations', '✉️'));
    return { embed, components: [row1, row2, row3, row4, row5] };
}
function buildInviteCodeModal(mode) {
    const title = mode === 'accept' ? 'Accept Invitation by Code' : 'Decline Invitation by Code';
    const customId = mode === 'accept' ? ORG_INVITE_CODE_MODAL_ACCEPT : ORG_INVITE_CODE_MODAL_DECLINE;
    return (0, panelEmbed_1.buildPanelModal)(customId, title, [
        {
            customId: 'invite_code',
            label: 'Invite Code',
            placeholder: 'Example: ABCD1234',
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            minLength: 8,
            maxLength: 8,
        },
    ]);
}
async function submitInviteCodeAction(interaction, mode, code) {
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
        await interaction.editReply({
            content: '❌ Invalid invite code format. Invite codes must be 8 letters/numbers.',
        });
        return;
    }
    const endpoint = mode === 'accept'
        ? `/v2/invitations/code/${normalizedCode}/accept`
        : `/v2/invitations/code/${normalizedCode}/decline`;
    try {
        await botApiClient_1.botApiClient.post(endpoint, {}, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
        const message = mode === 'accept'
            ? `✅ Invitation code **${normalizedCode}** accepted. You were added to the organization.`
            : `✅ Invitation code **${normalizedCode}** declined.`;
        await interaction.editReply({ content: message });
    }
    catch (error) {
        const msg = (0, botErrorFormat_1.formatBotApiError)(error, 'Failed to process invitation code', 'org-invite-code');
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
exports.org = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('org')
        .setDescription('Organization command hub for operations, governance, and coordination')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    category: 'organization',
    guildOnly: true,
    examples: ['/org'],
    permissions: ['ManageGuild'],
    cooldown: 5,
    async execute(interaction) {
        const { embed, components } = buildOrgRootPanel();
        await interaction.reply({
            embeds: [embed],
            components,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleButton(interaction) {
        if (interaction.customId.startsWith(ORG_FLEET_LIST_PAGE_PREFIX)) {
            await handleOrgFleetListPageButton(interaction);
            return;
        }
        const resolved = resolveOrgPanelAction(interaction.customId);
        if (!resolved) {
            await interaction.reply({
                content: '❌ This panel action is no longer valid. Run `/org` again to refresh.',
                flags: discord_js_1.MessageFlags.Ephemeral,
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
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
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
            await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateOrgSubpanel(await buildInvitationPanel(interaction)));
            return;
        }
        const panel = getOrgPanelContent(resolved.action);
        if (!panel) {
            await interaction.reply({
                content: '❌ Unknown action. Run `/org` again to refresh.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateOrgSubpanel(panel));
    },
    async handleModal(interaction) {
        if (interaction.customId !== ORG_INVITE_CODE_MODAL_ACCEPT &&
            interaction.customId !== ORG_INVITE_CODE_MODAL_DECLINE) {
            return;
        }
        const mode = interaction.customId === ORG_INVITE_CODE_MODAL_ACCEPT ? 'accept' : 'decline';
        const code = interaction.fields.getTextInputValue('invite_code');
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        await submitInviteCodeAction(interaction, mode, code);
    },
};
//# sourceMappingURL=org.js.map