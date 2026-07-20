"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_COMPONENT = void 0;
exports.getStatusChannelsForGuild = getStatusChannelsForGuild;
exports.getComponentStatusEmoji = getComponentStatusEmoji;
exports.stripStatusEmoji = stripStatusEmoji;
exports.computeChannelName = computeChannelName;
exports.getRoleEmoji = getRoleEmoji;
exports.restoreStatusChannels = restoreStatusChannels;
exports.hasActiveStatusChannels = hasActiveStatusChannels;
exports.updateStatusChannels = updateStatusChannels;
exports.renderStatusChannelMenu = renderStatusChannelMenu;
exports.createManagedStatusChannelsForGuild = createManagedStatusChannelsForGuild;
exports.createManagedStatusChannels = createManagedStatusChannels;
exports.assignStatusChannelForGuild = assignStatusChannelForGuild;
exports.assignExistingStatusChannel = assignExistingStatusChannel;
exports.removeStatusChannelsForGuild = removeStatusChannelsForGuild;
exports.removeStatusChannels = removeStatusChannels;
exports.__resetStatusChannelsForTest = __resetStatusChannelsForTest;
const discord_js_1 = require("discord.js");
const RsiStatusService_1 = require("../../services/external/RsiStatusService");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const BotClientManager_1 = require("../BotClientManager");
const rsiStatusChannelEmbeds_1 = require("../embeds/rsiStatusChannelEmbeds");
const customId_1 = require("../utils/customId");
const STATUS_ROLES = ['application', 'server'];
exports.ROLE_COMPONENT = {
    application: 'Platform',
    server: 'Persistent Universe',
};
const ROLE_DEFAULT_BASENAME = {
    application: 'RSI Platform',
    server: 'RSI Servers',
};
const ROLE_LABEL = {
    application: 'Application (Platform)',
    server: 'Servers (Persistent Universe)',
};
const STATUS_EMOJIS = ['🟢', '🟡', '🟠', '🔴', '🔧', '⚪', '⚫', '🔵'];
const MAX_CHANNEL_NAME_LENGTH = 100;
const PICKABLE_CHANNEL_TYPES = [discord_js_1.ChannelType.GuildVoice, discord_js_1.ChannelType.GuildText];
const REDIS_KEY = 'rsistatus:statuschannels';
const activeStatusChannels = new Map();
async function getGuildFromBot(guildId) {
    const manager = BotClientManager_1.BotClientManager.getInstance();
    if (!manager.isReady()) {
        throw new Error('Discord bot is not connected');
    }
    const client = manager.getClient();
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
        throw new Error('Discord guild not found or bot is not in this guild');
    }
    return guild;
}
async function hydrateGuildConfig(guildId) {
    const cached = activeStatusChannels.get(guildId);
    if (cached) {
        return cached;
    }
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return null;
        }
        const raw = await client.hget(REDIS_KEY, guildId);
        if (!raw) {
            return null;
        }
        const restored = await restoreGuildEntry(BotClientManager_1.BotClientManager.getInstance().getClient(), guildId, raw);
        if (!restored) {
            return null;
        }
        return activeStatusChannels.get(guildId) ?? null;
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to hydrate status channels from Redis', {
            guildId,
            error: formatError(err),
        });
        return null;
    }
}
async function getStatusChannelsForGuild(guildId) {
    const config = await hydrateGuildConfig(guildId);
    return config
        ? {
            application: config.application ? { ...config.application } : undefined,
            server: config.server ? { ...config.server } : undefined,
        }
        : null;
}
function getComponentStatusEmoji(status) {
    const normalized = status.toLowerCase();
    if (normalized.includes('operational')) {
        return '🟢';
    }
    if (normalized.includes('degraded') || normalized.includes('partial')) {
        return '🟡';
    }
    if (normalized.includes('maintenance')) {
        return '🔧';
    }
    if (normalized.includes('outage') || normalized.includes('major')) {
        return '🔴';
    }
    return '⚪';
}
function stripStatusEmoji(name) {
    let result = name;
    for (const emoji of STATUS_EMOJIS) {
        if (result.startsWith(emoji)) {
            result = result.slice(emoji.length);
            break;
        }
    }
    return result.replace(/^[\s\u2502|]+/, '').trim();
}
function computeChannelName(emoji, baseName) {
    return `${emoji} ${baseName}`.slice(0, MAX_CHANNEL_NAME_LENGTH);
}
function getRoleEmoji(status, role) {
    const target = exports.ROLE_COMPONENT[role].toLowerCase();
    const component = status.components.find(c => c.name.toLowerCase() === target);
    return getComponentStatusEmoji(component?.status ?? 'Unknown');
}
function formatError(error) {
    return error instanceof Error ? error.message : 'Unknown error';
}
async function saveGuildConfig(guildId, config) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hset(REDIS_KEY, guildId, JSON.stringify(config));
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to save status channels to Redis', {
            error: formatError(err),
        });
    }
}
async function removeGuildConfig(guildId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hdel(REDIS_KEY, guildId);
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to remove status channels from Redis', {
            error: formatError(err),
        });
    }
}
async function restoreGuildEntry(client, guildId, json) {
    let config;
    try {
        config = JSON.parse(json);
    }
    catch {
        await removeGuildConfig(guildId).catch(() => { });
        return false;
    }
    const guild = client.guilds.cache.get(guildId) ?? null;
    const verified = {};
    for (const role of STATUS_ROLES) {
        const tracked = config[role];
        if (!tracked) {
            continue;
        }
        const channel = guild ? await guild.channels.fetch(tracked.channelId).catch(() => null) : null;
        if (channel) {
            verified[role] = tracked;
        }
    }
    if (verified.application || verified.server) {
        activeStatusChannels.set(guildId, verified);
        await saveGuildConfig(guildId, verified);
        return true;
    }
    await removeGuildConfig(guildId);
    return false;
}
async function restoreStatusChannels() {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            logger_1.logger.info('rsistatus: Redis not available, skipping status channel restoration');
            return 0;
        }
        const all = await client.hgetall(REDIS_KEY);
        if (!all || Object.keys(all).length === 0) {
            return 0;
        }
        const botClient = BotClientManager_1.BotClientManager.getInstance().getClient();
        let restored = 0;
        for (const [guildId, json] of Object.entries(all)) {
            if (await restoreGuildEntry(botClient, guildId, json)) {
                restored++;
            }
        }
        if (restored > 0) {
            logger_1.logger.info(`🛰️ RSI Status: restored ${restored} status-channel config(s) from Redis`);
        }
        return restored;
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to restore status channels from Redis', {
            error: formatError(err),
        });
        return 0;
    }
}
function hasActiveStatusChannels() {
    return activeStatusChannels.size > 0;
}
async function renameTrackedChannel(guild, tracked, emoji) {
    const channel = await guild.channels.fetch(tracked.channelId).catch(() => null);
    if (!channel) {
        return false;
    }
    const desired = computeChannelName(emoji, tracked.baseName);
    if (channel.name === desired) {
        return true;
    }
    try {
        await channel.setName(desired, 'RSI status channel update');
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to rename status channel', {
            guildId: guild.id,
            channelId: tracked.channelId,
            error: formatError(err),
        });
    }
    return true;
}
async function updateGuildStatusChannels(guild, config, emojis) {
    let changed = false;
    for (const role of STATUS_ROLES) {
        const tracked = config[role];
        if (!tracked) {
            continue;
        }
        const stillExists = await renameTrackedChannel(guild, tracked, emojis[role]);
        if (!stillExists) {
            delete config[role];
            changed = true;
        }
    }
    if (!config.application && !config.server) {
        activeStatusChannels.delete(guild.id);
        await removeGuildConfig(guild.id);
    }
    else if (changed) {
        await saveGuildConfig(guild.id, config);
    }
}
async function updateStatusChannels(status) {
    if (activeStatusChannels.size === 0) {
        return;
    }
    const client = BotClientManager_1.BotClientManager.getInstance().getClient();
    const emojis = {
        application: getRoleEmoji(status, 'application'),
        server: getRoleEmoji(status, 'server'),
    };
    for (const [guildId, config] of activeStatusChannels) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            activeStatusChannels.delete(guildId);
            await removeGuildConfig(guildId);
            continue;
        }
        await updateGuildStatusChannels(guild, config, emojis);
    }
}
function userCanManageChannels(interaction) {
    return interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageChannels) ?? false;
}
function botCanManageChannels(guild) {
    return guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ?? false;
}
function buildMenuEmbed(config) {
    const describe = (role) => {
        const tracked = config?.[role];
        if (!tracked) {
            return `${ROLE_LABEL[role]}: *not set*`;
        }
        const kind = tracked.managed ? 'bot-created' : 'existing';
        return `${ROLE_LABEL[role]}: <#${tracked.channelId}> (${kind})`;
    };
    return (0, rsiStatusChannelEmbeds_1.buildRsiStatusChannelMenuEmbed)(describe('application'), describe('server'));
}
function buildPickerRow(role, placeholder, selectedId) {
    const menu = new discord_js_1.ChannelSelectMenuBuilder()
        .setCustomId(`rsistatus_chanpick_${role}`)
        .setPlaceholder(placeholder)
        .setChannelTypes([...PICKABLE_CHANNEL_TYPES])
        .setMinValues(1)
        .setMaxValues(1);
    if (selectedId) {
        menu.setDefaultChannels(selectedId);
    }
    return new discord_js_1.ActionRowBuilder().addComponents(menu);
}
function buildMenuComponents(config) {
    const buttonRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('rsistatus', 'chan', 'create'))
        .setLabel('Create Status Channels')
        .setEmoji('➕')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('rsistatus', 'chan', 'remove'))
        .setLabel('Remove')
        .setEmoji('🗑️')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    return [
        buttonRow,
        buildPickerRow('application', 'Search a channel for Application (Platform)', config?.application?.channelId),
        buildPickerRow('server', 'Search a channel for Servers (Persistent Universe)', config?.server?.channelId),
    ];
}
async function renderStatusChannelMenu(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guild) {
        await interaction.editReply({ content: '❌ This must be used in a server.' });
        return;
    }
    if (!userCanManageChannels(interaction)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to configure status channels.',
        });
        return;
    }
    const config = activeStatusChannels.get(interaction.guild.id);
    await interaction.editReply({
        embeds: [buildMenuEmbed(config)],
        components: buildMenuComponents(config),
    });
}
async function createManagedStatusChannelsInternal(guild) {
    if (!botCanManageChannels(guild)) {
        throw new Error('I need the Manage Channels permission to create status channels');
    }
    const status = await RsiStatusService_1.rsiStatusService.getStatus();
    const config = activeStatusChannels.get(guild.id) ?? {};
    for (const role of STATUS_ROLES) {
        if (config[role]?.managed) {
            continue;
        }
        const baseName = ROLE_DEFAULT_BASENAME[role];
        const emoji = getRoleEmoji(status, role);
        const created = await guild.channels.create({
            name: computeChannelName(emoji, baseName),
            type: discord_js_1.ChannelType.GuildVoice,
            reason: 'RSI status channel',
        });
        try {
            await created.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
        }
        catch (err) {
            logger_1.logger.warn('rsistatus: Could not lock status voice channel (needs Manage Roles)', {
                guildId: guild.id,
                error: formatError(err),
            });
        }
        config[role] = { channelId: created.id, managed: true, baseName };
    }
    activeStatusChannels.set(guild.id, config);
    await saveGuildConfig(guild.id, config);
    return config;
}
async function createManagedStatusChannelsForGuild(guildId) {
    const guild = await getGuildFromBot(guildId);
    return createManagedStatusChannelsInternal(guild);
}
async function createManagedStatusChannels(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: '❌ This must be used in a server.' });
        return;
    }
    if (!userCanManageChannels(interaction)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to create status channels.',
        });
        return;
    }
    if (!botCanManageChannels(guild)) {
        await interaction.editReply({
            content: '❌ I need the **Manage Channels** permission to create status channels.',
        });
        return;
    }
    try {
        const config = await createManagedStatusChannelsInternal(guild);
        await interaction.editReply({
            content: [
                '✅ Status channels created. They auto-update every 5 minutes:',
                config.application ? `• Application → <#${config.application.channelId}>` : '',
                config.server ? `• Servers → <#${config.server.channelId}>` : '',
            ]
                .filter(Boolean)
                .join('\n'),
        });
    }
    catch (err) {
        logger_1.logger.error('rsistatus: Failed to create status channels', { error: err });
        await interaction.editReply({
            content: '❌ Failed to create status channels. Check my permissions and try again.',
        });
    }
}
async function assignStatusChannelInternal(guild, role, channelId) {
    if (!botCanManageChannels(guild)) {
        throw new Error('I need the Manage Channels permission to rename channels');
    }
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.manageable) {
        throw new Error('I cannot manage that channel. Pick another or check my role position');
    }
    const baseName = stripStatusEmoji(channel.name) || ROLE_DEFAULT_BASENAME[role];
    const config = activeStatusChannels.get(guild.id) ?? {};
    config[role] = { channelId, managed: false, baseName };
    activeStatusChannels.set(guild.id, config);
    await saveGuildConfig(guild.id, config);
    const status = await RsiStatusService_1.rsiStatusService.getStatus();
    await updateStatusChannels(status);
    return config;
}
async function assignStatusChannelForGuild(guildId, role, channelId) {
    const guild = await getGuildFromBot(guildId);
    return assignStatusChannelInternal(guild, role, channelId);
}
async function assignExistingStatusChannel(interaction, role) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: '❌ This must be used in a server.' });
        return;
    }
    if (!userCanManageChannels(interaction)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to configure status channels.',
        });
        return;
    }
    if (!botCanManageChannels(guild)) {
        await interaction.editReply({
            content: '❌ I need the **Manage Channels** permission to rename channels.',
        });
        return;
    }
    const channelId = interaction.values[0];
    try {
        await assignStatusChannelInternal(guild, role, channelId);
        await interaction.editReply({
            content: `✅ <#${channelId}> now shows the RSI ${ROLE_LABEL[role]} status.`,
        });
    }
    catch (err) {
        logger_1.logger.error('rsistatus: Failed to assign status channel', { error: err });
        await interaction.editReply({
            content: '❌ Failed to set the status channel. Check my permissions and try again.',
        });
    }
}
async function cleanupTrackedChannel(guild, tracked) {
    const channel = await guild.channels.fetch(tracked.channelId).catch(() => null);
    if (!channel) {
        return;
    }
    try {
        if (tracked.managed) {
            await channel.delete('RSI status channel removed');
        }
        else if (channel.name !== tracked.baseName) {
            await channel.setName(tracked.baseName, 'RSI status channel disabled');
        }
    }
    catch (err) {
        logger_1.logger.warn('rsistatus: Failed to clean up status channel on removal', {
            guildId: guild.id,
            channelId: tracked.channelId,
            error: formatError(err),
        });
    }
}
async function removeStatusChannelsForGuild(guildId) {
    const config = (await hydrateGuildConfig(guildId)) ?? activeStatusChannels.get(guildId);
    if (!config) {
        return false;
    }
    const manager = BotClientManager_1.BotClientManager.getInstance();
    const guild = manager.isReady()
        ? (manager.getClient().guilds.cache.get(guildId) ??
            (await manager
                .getClient()
                .guilds.fetch(guildId)
                .catch(() => null)))
        : null;
    if (guild) {
        for (const role of STATUS_ROLES) {
            const tracked = config[role];
            if (tracked) {
                await cleanupTrackedChannel(guild, tracked);
            }
        }
    }
    activeStatusChannels.delete(guildId);
    await removeGuildConfig(guildId);
    return true;
}
async function removeStatusChannels(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: '❌ This must be used in a server.' });
        return;
    }
    if (!userCanManageChannels(interaction)) {
        await interaction.editReply({
            content: '❌ You need the **Manage Channels** permission to remove status channels.',
        });
        return;
    }
    const removed = await removeStatusChannelsForGuild(guild.id);
    if (!removed) {
        await interaction.editReply({ content: '❌ No status channels are configured here.' });
        return;
    }
    await interaction.editReply({ content: '✅ RSI status channels removed.' });
}
function __resetStatusChannelsForTest() {
    activeStatusChannels.clear();
}
//# sourceMappingURL=rsiStatusChannels.js.map