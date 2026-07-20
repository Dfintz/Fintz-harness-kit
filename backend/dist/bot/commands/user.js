"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.user = void 0;
const discord_js_1 = require("discord.js");
const data_source_1 = require("../../data-source");
const ship_1 = require("../../services/ship");
const UserService_1 = require("../../services/user/UserService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const userEmbeds_1 = require("../embeds/userEmbeds");
const appUrls_1 = require("../utils/appUrls");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const USER_HANGAR_PANEL_PREFIX = 'user_hangar_panel_';
const HANGAR_SHIP_PREVIEW_LIMIT = 8;
const HANGAR_PUBLIC_SHARING_KEYS = ['public', 'PUBLIC'];
const HANGAR_ORG_SHARING_KEYS = ['organization', 'ORGANIZATION'];
const HANGAR_ALLIANCE_SHARING_KEYS = ['alliance', 'ALLIANCE'];
const HANGAR_PRIVATE_SHARING_KEYS = ['private', 'PRIVATE'];
const HANGAR_SHARED_USERS_KEYS = ['shared_users', 'SHARED_USERS'];
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
let _userShipService = null;
function getUserShipService() {
    _userShipService ??= new ship_1.UserShipService();
    return _userShipService;
}
const USER_ROOT_ACTION_ALIASES = {
    verification: 'verify',
    notifications: 'notify',
    rsi: 'scstats',
    rsi_status: 'scstats',
    status: 'scstats',
};
function normalizeRootAction(action) {
    return USER_ROOT_ACTION_ALIASES[action] ?? action;
}
function formatCountRecord(record, max = 4) {
    const entries = Object.entries(record)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max);
    if (entries.length === 0) {
        return 'None';
    }
    return entries.map(([key, count]) => `${key}: ${count}`).join(' • ');
}
function getCountForKeys(record, keys) {
    return keys.reduce((sum, key) => sum + (record[key] ?? 0), 0);
}
function formatShipName(ship) {
    if (ship.customName?.trim()) {
        return `${ship.customName.trim()} (${ship.shipName})`;
    }
    return ship.shipName;
}
function formatShipPreview(ships) {
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
function formatInsurancePreview(ships) {
    if (ships.length === 0) {
        return 'No insurance renewals due in the next 30 days.';
    }
    return ships
        .slice(0, HANGAR_SHIP_PREVIEW_LIMIT)
        .map(entry => {
        const when = entry.daysUntilExpiration < 0
            ? `${Math.abs(entry.daysUntilExpiration)}d overdue`
            : `${entry.daysUntilExpiration}d left`;
        return `• ${formatShipName(entry.ship)} — ${when}`;
    })
        .join('\n');
}
function formatTopShips(ships) {
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
async function resolveHangarContext(interaction) {
    if (!data_source_1.AppDataSource.isInitialized) {
        await interaction.reply({
            content: '⚠️ Hangar data is temporarily unavailable. Please try again in a moment.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return null;
    }
    const discordId = interaction.user?.id;
    if (!discordId) {
        await interaction.reply({
            content: '❌ Could not resolve your Discord account. Run `/user` again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return null;
    }
    try {
        const user = await getUserService().getUserByDiscordId(discordId);
        if (!user) {
            await interaction.reply({
                content: '🔗 Your Discord account is not linked yet. Sign in with Discord on the web app first, then try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return null;
        }
        const activeOrgId = user.activeOrgId ?? '';
        if (!activeOrgId) {
            await interaction.reply({
                content: '❌ No active organization is configured for your account yet. Set your active org in the web app and try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return null;
        }
        return {
            userId: user.id,
            displayName: user.displayName ?? user.username,
            activeOrgId,
        };
    }
    catch (error) {
        logger_1.logger.warn('Failed to resolve Discord user hangar context', {
            errorMessage: (0, errorHandler_1.getErrorMessage)(error),
            discordId,
        });
        await interaction.reply({
            content: '❌ Failed to load hangar data. Please try again shortly.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return null;
    }
}
async function loadHangarSummary(context) {
    return getUserShipService().getUserShipSummary(context.activeOrgId, context.userId);
}
async function loadHangarTopShips(context, limit = 3) {
    const page = await getUserShipService().getUserShips(context.userId, {
        page: 1,
        limit,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
    });
    return page.data;
}
function buildPublicHangarEmbed(context) {
    const publicCount = getCountForKeys(context.summary.bySharingLevel, HANGAR_PUBLIC_SHARING_KEYS);
    const orgCount = getCountForKeys(context.summary.bySharingLevel, HANGAR_ORG_SHARING_KEYS);
    const allianceCount = getCountForKeys(context.summary.bySharingLevel, HANGAR_ALLIANCE_SHARING_KEYS);
    const statusBreakdown = formatCountRecord(context.summary.byStatus, 3);
    const roleBreakdown = formatCountRecord(context.summary.byRole, 3);
    const topShips = formatTopShips(context.topShips);
    return (0, userEmbeds_1.buildUserPublicHangarSnapshotEmbed)({
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
        hangarUrl: (0, appUrls_1.buildAppUrl)('/hangar'),
    });
}
function resolveUserPanelAction(customId) {
    const rootSub = (0, commandPanelBuilder_1.parsePanelCustomId)(customId, 'user');
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
const USER_BREADCRUMB_ROOT = 'User Hub';
const USER_PANEL_BACK_ID = (0, commandPanelBuilder_1.buildPanelCustomId)('user', 'back');
function decorateUserSubpanel(panel) {
    return (0, commandPanelBuilder_1.decorateSubpanel)(panel, {
        breadcrumb: [USER_BREADCRUMB_ROOT, (0, commandPanelBuilder_1.stripLeadingPanelEmoji)(panel.title)],
        backCustomId: USER_PANEL_BACK_ID,
    });
}
const USER_HANGAR_BREADCRUMB_LABEL = 'Hangar';
const USER_HANGAR_BACK_ID = (0, commandPanelBuilder_1.buildPanelCustomId)('user', 'hangar');
function decorateHangarSubpanel(panel) {
    return (0, commandPanelBuilder_1.decorateSubpanel)(panel, {
        breadcrumb: [
            USER_BREADCRUMB_ROOT,
            USER_HANGAR_BREADCRUMB_LABEL,
            (0, commandPanelBuilder_1.stripLeadingPanelEmoji)(panel.title),
        ],
        backCustomId: USER_HANGAR_BACK_ID,
    });
}
async function updateHangarSubpanel(interaction, panel) {
    await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateHangarSubpanel(panel));
}
function getUserRootPanelContent(action) {
    switch (action) {
        case 'hangar':
            return {
                title: '🚀 User Hangar',
                description: 'Open live hangar summaries from Discord, then publish a public summary to this channel when needed.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('user_hangar_panel_summary', 'Summary', '📦', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_my_ships', 'My Ships', '🚢'), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_insurance', 'Insurance Due', '🛡️'), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_loans', 'Loaned', '🤝'), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_sharing', 'Sharing', '🔗')),
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('user_hangar_panel_open_web', 'Open Web Hangar', '🌐', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_post_public', 'Post Public', '📣', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_add_ship', 'Add Ship', '➕'), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_update_ship', 'Update Ship', '✏️'), (0, commandPanelBuilder_1.buildButton)('user_hangar_panel_delete_ship', 'Delete Ship', '🗑️', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'verify':
            return {
                title: '🔐 RSI Verification',
                description: 'Link your RSI account, validate verification state, and manage your connection.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('verify_panel_link', 'Link Account', '🔗', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('verify_panel_check', 'Check Verification', '✅', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('verify_panel_user', 'My Verification', '👤'), (0, commandPanelBuilder_1.buildButton)('verify_panel_unlink', 'Unlink', '❌', discord_js_1.ButtonStyle.Danger)),
                ],
            };
        case 'notify':
            return {
                title: '🔔 Notifications',
                description: 'Manage your personal notification preferences. Server-wide notification controls are available under `/notify` (Manage Server only).',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('notify_panel_my_status', 'My Preferences', '👤', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('notify_panel_my_toggle', 'Toggle Preferences', '⚙️')),
                ],
            };
        case 'scstats':
            return {
                title: '📊 SCStats Summary',
                description: 'Open personal Star Citizen engagement and invite summary views.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('stats_panel_me', 'My Stats', '👤', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('stats_panel_invites', 'Invites', '📨'), (0, commandPanelBuilder_1.buildButton)('stats_panel_leaderboard_msg', 'Leaderboard (Msg)', '💬'), (0, commandPanelBuilder_1.buildButton)('stats_panel_leaderboard_voice', 'Leaderboard (Voice)', '🎤')),
                ],
            };
        case 'profile':
            return {
                title: '👤 Profile Quick Actions',
                description: [
                    `Open profile: ${(0, appUrls_1.buildAppUrl)('/profile')}`,
                    `Open account settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=account')}`,
                    `Open notification settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=notifications')}`,
                ].join('\n'),
            };
        case 'security':
            return {
                title: '🛡️ Security Quick Actions',
                description: [
                    `Open security settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=security')}`,
                    `Open API key management: ${(0, appUrls_1.buildAppUrl)('/settings?tab=api-keys')}`,
                    'Use the **RSI Verification** button on `/user` to link or verify your RSI account.',
                ].join('\n'),
            };
        case 'privacy':
            return {
                title: '🔒 Privacy Quick Actions',
                description: [
                    `Open privacy & data settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=privacy')}`,
                    'Consent preferences and data export/delete tools live in the Privacy & Data tab.',
                ].join('\n'),
            };
        case 'account':
            return {
                title: '⚙️ Account Settings Quick Actions',
                description: [
                    `Open account settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=account')}`,
                    `Open notification settings: ${(0, appUrls_1.buildAppUrl)('/settings?tab=notifications')}`,
                ].join('\n'),
            };
        case 'api_keys':
            return {
                title: '🔑 API Keys Quick Actions',
                description: [
                    `Open API keys: ${(0, appUrls_1.buildAppUrl)('/settings?tab=api-keys')}`,
                    'Create and revoke keys from the API Keys settings tab.',
                ].join('\n'),
            };
        case 'help':
            return {
                title: '❓ Help Center',
                description: 'Open help flows for wiki, FAQ, and setup guidance.',
                rows: [
                    (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('help_panel_wiki', 'Wiki Help', '📖', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('help_panel_faq', 'FAQ', '❓'), (0, commandPanelBuilder_1.buildButton)('help_panel_server_setup', 'Server Setup', '🛠️'), (0, commandPanelBuilder_1.buildButton)('help_panel_more_features', 'More Features', '✨')),
                ],
            };
        default:
            return null;
    }
}
async function showHangarSummary(interaction) {
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
            `Open full hangar: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
async function showHangarShips(interaction) {
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
            `Open full hangar: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
async function showHangarInsurance(interaction) {
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
            `Open full hangar: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
async function showHangarLoans(interaction) {
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
            `Open full hangar: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
async function showHangarSharing(interaction) {
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
            `Open full hangar: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
async function showHangarWebLink(interaction) {
    await updateHangarSubpanel(interaction, {
        title: '🌐 Open Web Hangar',
        description: `Open your hangar in the web app: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
    });
}
async function postHangarPublicSnapshot(interaction) {
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
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.send({ embeds: [buildPublicHangarEmbed({ ...context, summary, topShips })] });
    await interaction.reply({
        content: '✅ Posted your hangar summary publicly in this channel.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function showHangarPlaceholder(interaction, title, verb) {
    await updateHangarSubpanel(interaction, {
        title,
        description: [
            `Phase 2 ${verb} action is not enabled in Discord yet.`,
            `Use web hangar for now: ${(0, appUrls_1.buildAppUrl)('/hangar')}`,
        ].join('\n'),
    });
}
const HANGAR_ACTION_HANDLERS = {
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
async function handleHangarAction(interaction, action) {
    const handler = HANGAR_ACTION_HANDLERS[action];
    if (!handler) {
        return false;
    }
    await handler(interaction);
    return true;
}
function buildUserRootPanel() {
    const embed = (0, userEmbeds_1.buildUserRootHubEmbed)();
    const row1 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('user_panel_hangar', 'Hangar', '🚀', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('user_panel_verify', 'RSI Verification', '🔐', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('user_panel_notify', 'Notifications', '🔔', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('user_panel_scstats', 'SCStats', '📊'), (0, commandPanelBuilder_1.buildButton)('user_panel_profile', 'Profile', '👤'));
    const row2 = (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('user_panel_security', 'Security', '🛡️'), (0, commandPanelBuilder_1.buildButton)('user_panel_privacy', 'Privacy', '🔒'), (0, commandPanelBuilder_1.buildButton)('user_panel_account', 'Account Settings', '⚙️'), (0, commandPanelBuilder_1.buildButton)('user_panel_help', 'Help', '❓'));
    return { embed, components: [row1, row2] };
}
exports.user = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('user')
        .setDescription('Personal hub: hangar, RSI verification, notifications, SCStats, and settings'),
    category: 'social',
    guildOnly: true,
    examples: ['/user'],
    cooldown: 5,
    async execute(interaction) {
        const { embed, components } = buildUserRootPanel();
        await interaction.reply({
            embeds: [embed],
            components,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleButton(interaction) {
        const resolvedAction = resolveUserPanelAction(interaction.customId);
        if (!resolvedAction) {
            await interaction.reply({
                content: '❌ This panel action is no longer valid. Run `/user` again to refresh.',
                flags: discord_js_1.MessageFlags.Ephemeral,
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
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (resolvedAction.action === 'back') {
            const { embed, components } = buildUserRootPanel();
            await interaction.update({ embeds: [embed], components });
            return;
        }
        const panel = getUserRootPanelContent(resolvedAction.action);
        if (!panel) {
            await interaction.reply({
                content: '❌ Unknown action. Run `/user` again to refresh.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateUserSubpanel(panel));
    },
};
//# sourceMappingURL=user.js.map