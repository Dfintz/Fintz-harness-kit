"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordAuditLogService = void 0;
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
class DiscordAuditLogService {
    static instance;
    client = null;
    onMessageDelete = (message) => {
        this.handleMessageDelete(message).catch(err => logger_1.logger.error('AuditLog messageDelete error:', err));
    };
    onMessageUpdate = (oldMessage, newMessage) => {
        this.handleMessageEdit(oldMessage, newMessage).catch(err => logger_1.logger.error('AuditLog messageUpdate error:', err));
    };
    onGuildMemberUpdate = (oldMember, newMember) => {
        this.handleMemberUpdate(oldMember, newMember).catch(err => logger_1.logger.error('AuditLog guildMemberUpdate error:', err));
    };
    onChannelCreate = channel => {
        if (channel.isDMBased()) {
            return;
        }
        this.handleChannelCreate(channel).catch(err => logger_1.logger.error('AuditLog channelCreate error:', err));
    };
    onChannelDelete = channel => {
        if (channel.isDMBased()) {
            return;
        }
        this.handleChannelDelete(channel).catch(err => logger_1.logger.error('AuditLog channelDelete error:', err));
    };
    constructor() { }
    static getInstance() {
        DiscordAuditLogService.instance ??= new DiscordAuditLogService();
        return DiscordAuditLogService.instance;
    }
    initialize(client) {
        this.client = client;
        this.registerListeners();
        logger_1.logger.info('DiscordAuditLogService initialized');
    }
    shutdown() {
        if (!this.client) {
            return;
        }
        this.client.off('messageDelete', this.onMessageDelete);
        this.client.off('messageUpdate', this.onMessageUpdate);
        this.client.off('guildMemberUpdate', this.onGuildMemberUpdate);
        this.client.off('channelCreate', this.onChannelCreate);
        this.client.off('channelDelete', this.onChannelDelete);
        this.client = null;
        logger_1.logger.info('DiscordAuditLogService shut down');
    }
    registerListeners() {
        if (!this.client) {
            return;
        }
        this.client.on('messageDelete', this.onMessageDelete);
        this.client.on('messageUpdate', this.onMessageUpdate);
        this.client.on('guildMemberUpdate', this.onGuildMemberUpdate);
        this.client.on('channelCreate', this.onChannelCreate);
        this.client.on('channelDelete', this.onChannelDelete);
    }
    async handleMessageDelete(message) {
        if (!message.guild || message.author?.bot) {
            return;
        }
        const settings = await this.getSettings(message.guild.id);
        if (!settings?.enabled || !settings.logMessageDeletes || !settings.logChannelId) {
            return;
        }
        if (settings.ignoredChannelIds?.includes(message.channel.id)) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff5252)
            .setTitle('Message Deleted')
            .setDescription(`**Author:** ${message.author?.tag ?? 'Unknown'}\n` +
            `**Channel:** <#${message.channel.id}>\n` +
            `**Content:** ${(message.content ?? '*empty or not cached*').substring(0, 1000)}`)
            .setTimestamp();
        await this.postLog(message.guild.id, settings.logChannelId, embed, auditLogger_1.AuditEventType.DISCORD_MESSAGE_DELETED, {
            authorTag: message.author?.tag,
            channelId: message.channel.id,
        });
    }
    async handleMessageEdit(oldMessage, newMessage) {
        if (!newMessage.guild || newMessage.author?.bot) {
            return;
        }
        if (oldMessage.content === newMessage.content) {
            return;
        }
        const settings = await this.getSettings(newMessage.guild.id);
        if (!settings?.enabled || !settings.logMessageEdits || !settings.logChannelId) {
            return;
        }
        if (settings.ignoredChannelIds?.includes(newMessage.channel.id)) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xffab00)
            .setTitle('Message Edited')
            .setDescription(`**Author:** ${newMessage.author?.tag ?? 'Unknown'}\n` +
            `**Channel:** <#${newMessage.channel.id}>\n` +
            `**Before:** ${(oldMessage.content ?? '*not cached*').substring(0, 500)}\n` +
            `**After:** ${(newMessage.content ?? '*empty*').substring(0, 500)}`)
            .setTimestamp();
        await this.postLog(newMessage.guild.id, settings.logChannelId, embed, auditLogger_1.AuditEventType.DISCORD_MESSAGE_EDITED, {
            authorTag: newMessage.author?.tag,
            channelId: newMessage.channel.id,
        });
    }
    async handleMemberUpdate(oldMember, newMember) {
        const settings = await this.getSettings(newMember.guild.id);
        if (!settings?.enabled || !settings.logRoleChanges || !settings.logChannelId) {
            return;
        }
        const oldRoles = new Set(oldMember.roles.cache.keys());
        const newRoles = new Set(newMember.roles.cache.keys());
        const added = [...newRoles].filter(r => !oldRoles.has(r));
        const removed = [...oldRoles].filter(r => !newRoles.has(r));
        if (added.length === 0 && removed.length === 0) {
            return;
        }
        const changes = [];
        for (const roleId of added) {
            changes.push(`+ <@&${roleId}>`);
        }
        for (const roleId of removed) {
            changes.push(`- <@&${roleId}>`);
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Role Changes')
            .setDescription(`**Member:** ${newMember.user.tag}\n` + `**Changes:**\n${changes.join('\n')}`)
            .setTimestamp();
        await this.postLog(newMember.guild.id, settings.logChannelId, embed, auditLogger_1.AuditEventType.DISCORD_ROLE_CHANGED, {
            memberTag: newMember.user.tag,
        });
    }
    async handleChannelCreate(channel) {
        const settings = await this.getSettings(channel.guild.id);
        if (!settings?.enabled || !settings.logChannelChanges || !settings.logChannelId) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00c853)
            .setTitle('Channel Created')
            .setDescription(`**Name:** ${channel.name}\n` + `**Type:** ${channel.type}\n` + `**ID:** ${channel.id}`)
            .setTimestamp();
        await this.postLog(channel.guild.id, settings.logChannelId, embed, auditLogger_1.AuditEventType.DISCORD_CHANNEL_CREATED, {
            channelName: channel.name,
            channelType: channel.type,
        });
    }
    async handleChannelDelete(channel) {
        const settings = await this.getSettings(channel.guild.id);
        if (!settings?.enabled || !settings.logChannelChanges || !settings.logChannelId) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff5252)
            .setTitle('Channel Deleted')
            .setDescription(`**Name:** ${channel.name}\n` + `**Type:** ${channel.type}\n` + `**ID:** ${channel.id}`)
            .setTimestamp();
        await this.postLog(channel.guild.id, settings.logChannelId, embed, auditLogger_1.AuditEventType.DISCORD_CHANNEL_DELETED, {
            channelName: channel.name,
            channelType: channel.type,
        });
    }
    async getSettings(guildId) {
        try {
            const service = new DiscordSettingsService_1.DiscordSettingsService();
            const allSettings = await service.getSettingsByGuildId(guildId);
            return allSettings?.[0]?.auditLogSettings ?? null;
        }
        catch {
            return null;
        }
    }
    async postLog(guildId, channelId, embed, auditEventType, auditDetails) {
        if (!this.client) {
            return;
        }
        if (auditEventType) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditEventType,
                message: embed.data.title ?? 'Discord audit event',
                resource: `discord/guild/${guildId}`,
                metadata: { guildId, ...auditDetails },
            });
        }
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(channelId);
            if (channel?.isTextBased()) {
                await channel.send({ embeds: [embed] });
            }
        }
        catch (err) {
            logger_1.logger.debug(`AuditLog: Failed to post log to ${channelId}: ${err}`);
        }
    }
}
exports.DiscordAuditLogService = DiscordAuditLogService;
//# sourceMappingURL=DiscordAuditLogService.js.map