"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeChannelName = sanitizeChannelName;
exports.buildIssueChannelOverwrites = buildIssueChannelOverwrites;
exports.createIssueChannel = createIssueChannel;
exports.deleteIssueChannel = deleteIssueChannel;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const discord_1 = require("./discord");
const CHANNEL_NAME_MAX = 90;
function sanitizeChannelName(raw) {
    const cleaned = raw
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    const trimmed = cleaned.slice(0, CHANNEL_NAME_MAX).replace(/-+$/g, '');
    return trimmed.length > 0 ? trimmed : 'issue';
}
function buildIssueChannelOverwrites(guild, initiatorId, roleId) {
    const participate = [
        discord_js_1.PermissionFlagsBits.ViewChannel,
        discord_js_1.PermissionFlagsBits.SendMessages,
        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
        discord_js_1.PermissionFlagsBits.AttachFiles,
        discord_js_1.PermissionFlagsBits.EmbedLinks,
    ];
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
        { id: initiatorId, allow: participate },
        { id: roleId, allow: [...participate, discord_js_1.PermissionFlagsBits.ManageMessages] },
    ];
    const botId = guild.members.me?.id;
    if (botId) {
        overwrites.push({ id: botId, allow: [...participate, discord_js_1.PermissionFlagsBits.ManageChannels] });
    }
    return overwrites;
}
async function createIssueChannel(guild, options) {
    const { initiatorId, roleId, categoryId, name, topic, reason } = options;
    if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageChannels)) {
        logger_1.logger.warn(`IssueChannel: bot lacks ManageChannels in guild ${guild.name} (${guild.id}); skipping channel`);
        return null;
    }
    const category = guild.channels.cache.get(categoryId);
    if (category?.type !== discord_js_1.ChannelType.GuildCategory) {
        logger_1.logger.warn(`IssueChannel: category ${categoryId} missing or not a category in guild ${guild.id}; skipping channel`);
        return null;
    }
    const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
    if (!role) {
        logger_1.logger.warn(`IssueChannel: role ${roleId} not found in guild ${guild.id}; skipping channel`);
        return null;
    }
    try {
        return await guild.channels.create({
            name: sanitizeChannelName(name),
            type: discord_js_1.ChannelType.GuildText,
            parent: category.id,
            topic,
            permissionOverwrites: buildIssueChannelOverwrites(guild, initiatorId, roleId),
            reason: reason ?? 'Ephemeral issue channel',
        });
    }
    catch (error) {
        logger_1.logger.warn(`IssueChannel: failed to create channel in guild ${guild.id} (category ${categoryId}): ${error instanceof Error ? error.message : 'unknown error'}`);
        return null;
    }
}
async function deleteIssueChannel(guild, channelId, reason) {
    try {
        const channel = guild.channels.cache.get(channelId) ??
            (await guild.channels.fetch(channelId).catch(() => null));
        if (channel) {
            await channel.delete(reason);
        }
    }
    catch (error) {
        logger_1.logger.warn(`IssueChannel: failed to delete channel ${channelId} in guild ${guild.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}
//# sourceMappingURL=issueChannel.js.map