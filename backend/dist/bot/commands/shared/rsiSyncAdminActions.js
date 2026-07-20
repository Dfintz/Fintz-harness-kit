"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRsiSyncAdminAction = isRsiSyncAdminAction;
exports.hasManageRolesPermission = hasManageRolesPermission;
exports.resolveOrgIdFromGuild = resolveOrgIdFromGuild;
exports.handleRsiSyncAdminAction = handleRsiSyncAdminAction;
const discord_js_1 = require("discord.js");
const GuildOrganizationService_1 = require("../../../services/discord/GuildOrganizationService");
const api_1 = require("../../constants/api");
const botApiClient_1 = require("../../utils/botApiClient");
const botErrorFormat_1 = require("../../utils/botErrorFormat");
const RSI_SYNC_ADMIN_ACTIONS = new Set(['status', 'setup', 'run', 'audit']);
function isRsiSyncAdminAction(value) {
    return RSI_SYNC_ADMIN_ACTIONS.has(value);
}
function hasManageRolesPermission(interaction) {
    return Boolean(interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageRoles));
}
async function resolveOrgIdFromGuild(guildId) {
    try {
        const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
        return await guildOrgService.resolveOrganization(guildId);
    }
    catch {
        return null;
    }
}
async function replyManageRolesRequired(interaction) {
    await interaction.reply({
        content: '❌ You need the **Manage Roles** permission to use RSI sync admin actions.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function replyRsiSyncSetupHint(interaction) {
    await interaction.reply({
        content: '🔧 Setup wizard is available in the web app under Organization Settings → Integrations → RSI Sync.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
function getSyncTypeIcon(syncType) {
    switch (syncType) {
        case 'scheduled':
            return '🔄';
        case 'manual':
            return '👤';
        default:
            return '🔗';
    }
}
async function replyHandlerError(interaction, error) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content: `❌ Error: ${msg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    else {
        await interaction.reply({
            content: `❌ Error: ${msg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleStatusAction(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const mappingsResponse = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/rsi/role-mapping/${orgId}`, {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const mappings = mappingsResponse.data.data?.mappings ?? mappingsResponse.data.mappings ?? [];
        if (mappings.length === 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xffff00)
                .setTitle('📋 RSI Role Sync Status')
                .setDescription('No role mappings configured for this organization.')
                .addFields({
                name: 'Get Started',
                value: 'Use the **Setup Wizard** button above, then configure rank mappings in Organization Settings → Integrations → RSI Sync.',
                inline: false,
            })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📋 RSI Role Sync Status')
            .setTimestamp();
        const mappingLines = [];
        for (const mapping of mappings.slice(0, 15)) {
            const discordRoleDisplay = mapping.discordRoleId
                ? `<@&${mapping.discordRoleId}>`
                : '❌ Not mapped';
            const statusIcon = mapping.isActive ? '🟢' : '🔴';
            const permCount = mapping.summary?.permissionCount ?? 0;
            mappingLines.push(`${statusIcon} **${mapping.rsiRank}** → ${discordRoleDisplay} (${permCount} permissions)`);
        }
        embed.addFields({
            name: 'Role Mappings',
            value: mappingLines.join('\n') || 'No mappings',
            inline: false,
        });
        if (mappings.length > 15) {
            embed.addFields({
                name: 'Note',
                value: `Showing 15 of ${mappings.length} mappings. View all in the web app.`,
                inline: false,
            });
        }
        const withDiscordRole = mappings.filter((m) => m.discordRoleId).length;
        const activeMappings = mappings.filter((m) => m.isActive).length;
        embed.addFields({ name: 'Total Mappings', value: mappings.length.toString(), inline: true }, { name: 'Active', value: activeMappings.toString(), inline: true }, { name: 'With Discord Role', value: withDiscordRole.toString(), inline: true });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `status:org=${orgId}`);
        await interaction.editReply({ content: `❌ Failed to fetch status: ${errorMessage}` });
    }
}
async function handleRunAction(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.post(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/sync`, {
            force: false,
        }, {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const triggered = response.data.data?.triggered ?? false;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🔄 Role Synchronization Triggered')
            .setDescription('Role synchronization has been started for this organization.')
            .addFields({ name: 'Organization', value: orgId, inline: true }, { name: 'Status', value: triggered ? '✅ Started' : '⏳ Queued', inline: true })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `run-sync:org=${orgId}`);
        await interaction.editReply({ content: `❌ Failed to run sync: ${errorMessage}` });
    }
}
async function handleAuditAction(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: '❌ This server is not linked to an organization.\n💡 Use `/guild setup` to link this server first.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/audit`, {
            params: { limit: 5 },
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const logs = response.data.data?.logs ?? [];
        const total = response.data.data?.total ?? logs.length;
        if (logs.length === 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x808080)
                .setTitle('📋 RSI Sync Audit Log')
                .setDescription('No sync history found for this organization.')
                .addFields({
                name: 'Get Started',
                value: 'Click **Run Sync** to start syncing roles.',
                inline: false,
            })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📋 RSI Sync Audit Log')
            .setDescription(`Showing last ${logs.length} of ${total} sync operations`)
            .setTimestamp();
        const logEntries = [];
        for (const log of logs.slice(0, 5)) {
            const syncedAt = new Date(log.syncedAt);
            const typeIcon = getSyncTypeIcon(log.syncType);
            const statusIcon = log.errors > 0 ? '⚠️' : '✅';
            logEntries.push(`${statusIcon} ${typeIcon} <t:${Math.floor(syncedAt.getTime() / 1000)}:R> - ` +
                `${log.changesApplied}/${log.changesDetected} changes, ${log.errors} errors`);
        }
        embed.addFields({
            name: 'Recent Syncs',
            value: logEntries.join('\n') || 'No entries',
            inline: false,
        });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `audit:org=${orgId}`);
        await interaction.editReply({ content: `❌ Failed to fetch audit log: ${errorMessage}` });
    }
}
const ACTION_HANDLERS = {
    status: handleStatusAction,
    run: handleRunAction,
    audit: handleAuditAction,
};
async function handleRsiSyncAdminAction(action, interaction) {
    if (!hasManageRolesPermission(interaction)) {
        await replyManageRolesRequired(interaction);
        return;
    }
    if (action === 'setup') {
        await replyRsiSyncSetupHint(interaction);
        return;
    }
    const guildId = interaction.guildId;
    const orgId = guildId ? await resolveOrgIdFromGuild(guildId) : null;
    try {
        await ACTION_HANDLERS[action](interaction, orgId);
    }
    catch (error) {
        await replyHandlerError(interaction, error);
    }
}
//# sourceMappingURL=rsiSyncAdminActions.js.map