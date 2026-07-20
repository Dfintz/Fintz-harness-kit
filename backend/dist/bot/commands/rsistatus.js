"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsistatus = void 0;
exports.parseRsiStatusChannelAction = parseRsiStatusChannelAction;
exports.buildPanelSnapshotSignature = buildPanelSnapshotSignature;
exports.shouldDropPanelTrackingForError = shouldDropPanelTrackingForError;
exports.restorePanelEntry = restorePanelEntry;
exports.getRsiStatusPanelForGuild = getRsiStatusPanelForGuild;
exports.deployRsiStatusPanelForGuild = deployRsiStatusPanelForGuild;
exports.removeRsiStatusPanelForGuild = removeRsiStatusPanelForGuild;
exports.restoreRsiStatusPanels = restoreRsiStatusPanels;
exports.restoreRsiStatusChannels = restoreRsiStatusChannels;
const discord_js_1 = require("discord.js");
const RsiStatusService_1 = require("../../services/external/RsiStatusService");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const BotClientManager_1 = require("../BotClientManager");
const rsistatusEmbeds_1 = require("../embeds/rsistatusEmbeds");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const customId_1 = require("../utils/customId");
const embedBuilder_1 = require("../utils/embedBuilder");
const statusChannels = __importStar(require("./rsiStatusChannels"));
function formatError(error) {
    return error instanceof Error ? error.message : 'Unknown error';
}
const RSISTATUS_PREFIX = 'rsistatus';
const RSISTATUS_PANEL_ACTION = 'panel';
const RSISTATUS_PANEL_SCOPE = (0, customId_1.buildCustomId)(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION);
function parseRsiStatusChannelAction(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== RSISTATUS_PREFIX || parsed.action !== 'chan') {
        return null;
    }
    const [channelAction = ''] = parsed.params;
    if (channelAction === 'create' || channelAction === 'remove') {
        return channelAction;
    }
    return null;
}
const REDIS_PANELS_KEY = 'rsistatus:panels';
const activePanels = new Map();
let pollInterval = null;
const POLL_INTERVAL_MS = 5 * 60 * 1000;
let lastPanelSnapshotSignature = null;
const PANEL_DROP_DISCORD_ERROR_CODES = new Set([10003, 10008]);
function buildPanelSnapshotSignature(status) {
    return JSON.stringify({
        overallStatus: status.overallStatus,
        components: status.components.map(component => ({
            name: component.name,
            status: component.status,
        })),
        latestIncident: status.latestIncident
            ? {
                title: status.latestIncident.title,
                resolved: status.latestIncident.resolved,
                pubDate: status.latestIncident.pubDate,
                description: status.latestIncident.description,
                link: status.latestIncident.link,
            }
            : null,
    });
}
function extractDiscordErrorCode(error) {
    if (error instanceof discord_js_1.DiscordAPIError) {
        return Number(error.code);
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const maybeCode = error.code;
        if (typeof maybeCode === 'number' && Number.isFinite(maybeCode)) {
            return maybeCode;
        }
    }
    return null;
}
function shouldDropPanelTrackingForError(error) {
    const code = extractDiscordErrorCode(error);
    return code !== null && PANEL_DROP_DISCORD_ERROR_CODES.has(code);
}
async function restorePanelEntry(guildId, json) {
    const { channelId, messageId } = JSON.parse(json);
    const botClient = BotClientManager_1.BotClientManager.getInstance().getClient();
    try {
        const channel = await botClient.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
            await removePanelFromRedis(guildId);
            return false;
        }
        await channel.messages.fetch(messageId);
        activePanels.set(guildId, { channelId, messageId });
        return true;
    }
    catch (error) {
        if (shouldDropPanelTrackingForError(error)) {
            await removePanelFromRedis(guildId);
            return false;
        }
        activePanels.set(guildId, { channelId, messageId });
        logger_1.logger.warn('rsistatus: transient error verifying panel on restore; keeping for retry', {
            guildId,
            channelId,
            messageId,
            error: formatError(error),
        });
        return true;
    }
}
async function hydratePanelForGuild(guildId) {
    const cached = activePanels.get(guildId);
    if (cached) {
        return { ...cached };
    }
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return null;
        }
        const raw = await client.hget(REDIS_PANELS_KEY, guildId);
        if (!raw) {
            return null;
        }
        const restored = await restorePanelEntry(guildId, raw);
        if (!restored) {
            return null;
        }
        const panel = activePanels.get(guildId);
        return panel ? { ...panel } : null;
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to hydrate panel from Redis', {
            guildId,
            error: formatError(err),
        });
        return null;
    }
}
function ensureBotReady() {
    if (!BotClientManager_1.BotClientManager.getInstance().isReady()) {
        throw new Error('Discord bot is not connected');
    }
}
async function getRsiStatusPanelForGuild(guildId) {
    return hydratePanelForGuild(guildId);
}
async function deployRsiStatusPanelForGuild(guildId, channelId) {
    ensureBotReady();
    const client = BotClientManager_1.BotClientManager.getInstance().getClient();
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
        throw new Error('Discord guild not found or bot is not in this guild');
    }
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.type !== discord_js_1.ChannelType.GuildText) {
        throw new Error('Panels can only be deployed in text channels');
    }
    await removeRsiStatusPanelForGuild(guildId);
    const status = await RsiStatusService_1.rsiStatusService.getStatus();
    const embed = buildStatusEmbed(status);
    const linkRow = buildLinkRow();
    const msg = await channel.send({
        embeds: [embed],
        components: [linkRow],
    });
    const panel = {
        channelId: channel.id,
        messageId: msg.id,
    };
    activePanels.set(guildId, panel);
    await savePanelToRedis(guildId, channel.id, msg.id);
    startPolling();
    lastPanelSnapshotSignature = buildPanelSnapshotSignature(status);
    return panel;
}
async function removeRsiStatusPanelForGuild(guildId) {
    const panel = await hydratePanelForGuild(guildId);
    if (!panel) {
        return false;
    }
    try {
        const client = BotClientManager_1.BotClientManager.getInstance().getClient();
        const channel = await client.channels.fetch(panel.channelId).catch(() => null);
        if (channel?.isTextBased()) {
            const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
            if (msg) {
                await msg.delete();
            }
        }
    }
    catch {
    }
    activePanels.delete(guildId);
    await removePanelFromRedis(guildId);
    if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
        stopPolling();
    }
    return true;
}
async function savePanelToRedis(guildId, channelId, messageId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hset(REDIS_PANELS_KEY, guildId, JSON.stringify({ channelId, messageId }));
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to save panel to Redis', { error: formatError(err) });
    }
}
async function removePanelFromRedis(guildId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hdel(REDIS_PANELS_KEY, guildId);
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to remove panel from Redis', { error: formatError(err) });
    }
}
async function restoreRsiStatusPanels() {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            logger_1.logger.info('rsistatus: Redis not available, skipping panel restoration');
            return;
        }
        const allPanels = await client.hgetall(REDIS_PANELS_KEY);
        if (!allPanels || Object.keys(allPanels).length === 0) {
            logger_1.logger.info('rsistatus: No persisted panels to restore');
            return;
        }
        let restored = 0;
        for (const [guildId, json] of Object.entries(allPanels)) {
            try {
                if (await restorePanelEntry(guildId, json)) {
                    restored++;
                }
            }
            catch {
                await client.hdel(REDIS_PANELS_KEY, guildId).catch(() => { });
            }
        }
        logger_1.logger.info(`🛰️ RSI Status: restored ${restored} panel(s) from Redis`);
        if (activePanels.size > 0) {
            startPolling();
        }
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to restore panels from Redis', { error: formatError(err) });
    }
}
async function restoreRsiStatusChannels() {
    await statusChannels.restoreStatusChannels();
    if (statusChannels.hasActiveStatusChannels()) {
        startPolling();
    }
}
exports.rsistatus = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('rsistatus')
        .setDescription('RSI server status monitor — check status or deploy a live panel'),
    category: 'utility',
    guildOnly: true,
    examples: ['/rsistatus'],
    async execute(interaction) {
        const embed = (0, rsistatusEmbeds_1.buildRsiStatusRootMenuEmbed)();
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'check'))
            .setLabel('Check Status')
            .setEmoji('📡')
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'deploy'))
            .setLabel('Deploy Live Panel')
            .setEmoji('📌')
            .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'channels'))
            .setLabel('Status Channels')
            .setEmoji('🏷️')
            .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'remove'))
            .setLabel('Remove Panel')
            .setEmoji('🗑️')
            .setStyle(discord_js_1.ButtonStyle.Danger));
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleButton(interaction) {
        const { customId } = interaction;
        const channelAction = parseRsiStatusChannelAction(customId);
        if (channelAction) {
            await handleStatusChannelButton(interaction, channelAction);
            return;
        }
        if (customId === 'rsistatus_confirmremove') {
            await handleRemovePanel(interaction);
            return;
        }
        if (customId === 'rsistatus_removedismiss') {
            await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
            return;
        }
        if ((0, customId_1.customIdScope)(customId) !== RSISTATUS_PANEL_SCOPE) {
            return;
        }
        const [action = ''] = (0, customId_1.parseCustomId)(customId).params;
        switch (action) {
            case 'check':
                await handleCheckStatus(interaction);
                break;
            case 'deploy':
                await handleDeployPanel(interaction);
                break;
            case 'remove':
                await handleRemovePanelPrompt(interaction);
                break;
            case 'channels':
                await statusChannels.renderStatusChannelMenu(interaction);
                break;
            default:
                break;
        }
    },
    async handleChannelSelectMenu(interaction) {
        const { customId } = interaction;
        if (customId === 'rsistatus_chanpick_application') {
            await statusChannels.assignExistingStatusChannel(interaction, 'application');
            startPolling();
        }
        else if (customId === 'rsistatus_chanpick_server') {
            await statusChannels.assignExistingStatusChannel(interaction, 'server');
            startPolling();
        }
    },
};
async function handleStatusChannelButton(interaction, action) {
    if (action === 'create') {
        await statusChannels.createManagedStatusChannels(interaction);
        startPolling();
    }
    else if (action === 'remove') {
        await statusChannels.removeStatusChannels(interaction);
        if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
            stopPolling();
        }
    }
}
async function handleCheckStatus(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const status = await RsiStatusService_1.rsiStatusService.getStatus();
        const embed = buildStatusEmbed(status);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('rsistatus: Failed to check status', { error });
        await interaction.editReply({ content: '❌ Failed to fetch RSI status. Try again later.' });
    }
}
async function handleDeployPanel(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply({ content: '❌ This command must be used in a server.' });
        return;
    }
    if (!interaction.guild?.members.cache
        .get(interaction.user.id)
        ?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to deploy a status panel.',
        });
        return;
    }
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.type !== discord_js_1.ChannelType.GuildText) {
        await interaction.editReply({ content: '❌ Panels can only be deployed in text channels.' });
        return;
    }
    try {
        const panel = await deployRsiStatusPanelForGuild(interaction.guildId, channel.id);
        await interaction.editReply({
            content: `✅ RSI Status panel deployed! It will auto-update every 5 minutes.\nPanel message: https://discord.com/channels/${interaction.guildId}/${panel.channelId}/${panel.messageId}`,
        });
    }
    catch (error) {
        logger_1.logger.error('rsistatus: Failed to deploy panel', { error });
        await interaction.editReply({ content: '❌ Failed to deploy panel. Check bot permissions.' });
    }
}
async function handleRemovePanelPrompt(interaction) {
    await interaction.reply((0, confirmationPrompt_1.buildConfirmationPrompt)({
        confirmCustomId: 'rsistatus_confirmremove',
        cancelCustomId: 'rsistatus_removedismiss',
        message: 'remove the live RSI status panel',
        confirmLabel: 'Remove Panel',
        confirmEmoji: '🗑️',
        cancelLabel: 'Keep Panel',
        cancelEmoji: '↩️',
    }));
}
async function handleRemovePanel(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply({ content: '❌ This command must be used in a server.' });
        return;
    }
    if (!interaction.guild?.members.cache
        .get(interaction.user.id)
        ?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to remove a status panel.',
        });
        return;
    }
    const removed = await removeRsiStatusPanelForGuild(interaction.guildId);
    if (!removed) {
        await interaction.editReply({ content: '❌ No active status panel found in this server.' });
        return;
    }
    await interaction.editReply({ content: '✅ RSI Status panel removed.' });
}
function buildLinkRow() {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel('View Status Page')
        .setURL('https://status.robertsspaceindustries.com/')
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setEmoji('🌐'));
}
function buildStatusEmbed(status) {
    const allOperational = status.components.every(c => c.status.toLowerCase() === 'operational');
    const embedColor = allOperational ? embedBuilder_1.EmbedColors.SUCCESS : embedBuilder_1.EmbedColors.ERROR;
    const statusEmoji = allOperational ? '🟢' : '🔴';
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedColor)
        .setTitle(`${statusEmoji} RSI Service Status`)
        .setDescription(`**${status.overallStatus}**\n\n${status.components
        .map(c => {
        const emoji = statusChannels.getComponentStatusEmoji(c.status);
        return `${emoji} **${c.name}** — ${c.status}`;
    })
        .join('\n')}`)
        .setTimestamp()
        .build();
    if (status.latestIncident) {
        const incident = status.latestIncident;
        const resolvedTag = incident.resolved ? '✅ Resolved' : '🔴 Active';
        const pubDate = incident.pubDate ? new Date(incident.pubDate) : null;
        const timeStr = pubDate ? `<t:${Math.floor(pubDate.getTime() / 1000)}:R>` : 'Unknown';
        const desc = incident.description.length > 500
            ? `${incident.description.slice(0, 497)}...`
            : incident.description;
        embed.addFields({
            name: `📋 Latest Incident — ${resolvedTag}`,
            value: `**[${incident.title}](${incident.link})**\n${timeStr}\n\n${desc}`,
            inline: false,
        });
    }
    else {
        embed.addFields({
            name: '📋 Latest Incident',
            value: 'No recent incidents found.',
            inline: false,
        });
    }
    embed.setFooter({
        text: 'Data from status.robertsspaceindustries.com • Updates every 5 min',
    });
    return embed;
}
function startPolling() {
    if (pollInterval) {
        return;
    }
    logger_1.logger.info('🛰️ RSI Status polling started');
    pollInterval = setInterval(() => {
        updateAllPanels().catch((err) => logger_1.logger.warn('rsistatus: Poll update failed', { error: formatError(err) }));
    }, POLL_INTERVAL_MS);
    pollInterval.unref();
}
function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        logger_1.logger.info('🛰️ RSI Status polling stopped');
    }
}
async function updateAllPanels() {
    const hasPanels = activePanels.size > 0;
    const hasChannels = statusChannels.hasActiveStatusChannels();
    if (!hasPanels && !hasChannels) {
        stopPolling();
        return;
    }
    RsiStatusService_1.rsiStatusService.invalidateCache();
    const status = await RsiStatusService_1.rsiStatusService.getStatus();
    if (hasChannels) {
        await statusChannels.updateStatusChannels(status);
    }
    if (hasPanels) {
        const nextSnapshotSignature = buildPanelSnapshotSignature(status);
        const shouldRefreshPanels = nextSnapshotSignature !== lastPanelSnapshotSignature;
        if (shouldRefreshPanels) {
            lastPanelSnapshotSignature = nextSnapshotSignature;
            const embed = buildStatusEmbed(status);
            const linkRow = buildLinkRow();
            const staleGuilds = await updateGuildPanels(embed, linkRow);
            for (const guildId of staleGuilds) {
                activePanels.delete(guildId);
                await removePanelFromRedis(guildId);
            }
        }
    }
    if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
        stopPolling();
    }
}
function markStaleGuild(staleGuilds, guildId) {
    staleGuilds.push(guildId);
}
function shouldSkipPanelAfterError(staleGuilds, guildId, error, message, panel) {
    if (shouldDropPanelTrackingForError(error)) {
        markStaleGuild(staleGuilds, guildId);
        return;
    }
    logger_1.logger.warn(message, {
        guildId,
        channelId: panel.channelId,
        messageId: panel.messageId,
        error: formatError(error),
    });
}
async function fetchPanelChannel(client, guildId, panel, staleGuilds) {
    try {
        const fetchedChannel = await client.channels.fetch(panel.channelId);
        if (!fetchedChannel?.isTextBased()) {
            markStaleGuild(staleGuilds, guildId);
            return null;
        }
        return fetchedChannel;
    }
    catch (error) {
        shouldSkipPanelAfterError(staleGuilds, guildId, error, 'rsistatus: Failed to fetch panel channel', panel);
        return null;
    }
}
async function fetchPanelMessage(channel, guildId, panel, staleGuilds) {
    try {
        return await channel.messages.fetch(panel.messageId);
    }
    catch (error) {
        shouldSkipPanelAfterError(staleGuilds, guildId, error, 'rsistatus: Failed to fetch panel message', panel);
        return null;
    }
}
async function editPanelMessage(message, embed, linkRow, guildId, panel, staleGuilds) {
    try {
        await message.edit({ embeds: [embed], components: [linkRow] });
    }
    catch (error) {
        shouldSkipPanelAfterError(staleGuilds, guildId, error, 'rsistatus: Failed to edit panel message', panel);
    }
}
async function updateGuildPanels(embed, linkRow) {
    const client = BotClientManager_1.BotClientManager.getInstance().getClient();
    const staleGuilds = [];
    for (const [guildId, panel] of activePanels) {
        const channel = await fetchPanelChannel(client, guildId, panel, staleGuilds);
        if (!channel) {
            continue;
        }
        const message = await fetchPanelMessage(channel, guildId, panel, staleGuilds);
        if (!message) {
            continue;
        }
        await editPanelMessage(message, embed, linkRow, guildId, panel, staleGuilds);
    }
    return staleGuilds;
}
//# sourceMappingURL=rsistatus.js.map