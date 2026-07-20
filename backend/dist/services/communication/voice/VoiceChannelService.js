"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceChannelService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../../../types");
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const REDIS_TEMPLATE_PREFIX = 'bot:voice:template:';
const REDIS_CONFIG_PREFIX = 'bot:voice:config:';
const REDIS_CHANNEL_PREFIX = 'bot:voice:channel:';
class VoiceChannelService {
    static instance;
    channels = new Map();
    templates = new Map();
    configs = new Map();
    stats = new Map();
    cleanupInterval;
    constructor() {
        this.initializeDefaultTemplates();
        this.startCleanupTask();
        this.loadFromRedis().catch(err => logger_1.logger.warn('VoiceChannelService: Failed to load persisted data from Redis', err));
    }
    static getInstance() {
        if (!VoiceChannelService.instance) {
            VoiceChannelService.instance = new VoiceChannelService();
        }
        return VoiceChannelService.instance;
    }
    async loadFromRedis() {
        let totalLoaded = 0;
        const templateKeys = await redis_1.cache.keys(`${REDIS_TEMPLATE_PREFIX}*`);
        for (const key of templateKeys) {
            const data = await redis_1.cache.get(key);
            if (!data) {
                continue;
            }
            data.createdAt = new Date(data.createdAt);
            this.templates.set(data.id, data);
            totalLoaded++;
        }
        const configKeys = await redis_1.cache.keys(`${REDIS_CONFIG_PREFIX}*`);
        for (const key of configKeys) {
            const data = await redis_1.cache.get(key);
            if (!data) {
                continue;
            }
            this.configs.set(data.guildId, data);
            totalLoaded++;
        }
        const channelKeys = await redis_1.cache.keys(`${REDIS_CHANNEL_PREFIX}*`);
        for (const key of channelKeys) {
            const data = await redis_1.cache.get(key);
            if (!data) {
                continue;
            }
            data.createdAt = new Date(data.createdAt);
            if (data.expiresAt) {
                data.expiresAt = new Date(data.expiresAt);
            }
            data.activityLogs = (data.activityLogs || []).map(log => ({
                ...log,
                timestamp: new Date(log.timestamp),
            }));
            this.channels.set(data.id, data);
            totalLoaded++;
        }
        if (totalLoaded > 0) {
            logger_1.logger.info(`VoiceChannelService: Restored ${totalLoaded} items from Redis`);
        }
    }
    async persistChannel(channel) {
        try {
            await redis_1.cache.set(`${REDIS_CHANNEL_PREFIX}${channel.id}`, channel);
        }
        catch (err) {
            logger_1.logger.warn('VoiceChannelService: Failed to persist channel to Redis', err);
        }
    }
    async unpersistChannel(channelId) {
        try {
            await redis_1.cache.del(`${REDIS_CHANNEL_PREFIX}${channelId}`);
        }
        catch (err) {
            logger_1.logger.warn('VoiceChannelService: Failed to remove channel from Redis', err);
        }
    }
    async persistTemplate(template) {
        if (template.createdBy === 'system') {
            return;
        }
        try {
            await redis_1.cache.set(`${REDIS_TEMPLATE_PREFIX}${template.id}`, template);
        }
        catch (err) {
            logger_1.logger.warn('VoiceChannelService: Failed to persist template to Redis', err);
        }
    }
    async unpersistTemplate(templateId) {
        try {
            await redis_1.cache.del(`${REDIS_TEMPLATE_PREFIX}${templateId}`);
        }
        catch (err) {
            logger_1.logger.warn('VoiceChannelService: Failed to remove template from Redis', err);
        }
    }
    async persistConfig(config) {
        try {
            await redis_1.cache.set(`${REDIS_CONFIG_PREFIX}${config.guildId}`, config);
        }
        catch (err) {
            logger_1.logger.warn('VoiceChannelService: Failed to persist config to Redis', err);
        }
    }
    createChannel(name, guildId, channelId, creatorId, type, options) {
        const channel = {
            id: (0, uuid_1.v4)(),
            name,
            guildId,
            channelId,
            type,
            creatorId,
            eventId: options?.eventId,
            createdAt: new Date(),
            expiresAt: options?.expiresAt,
            userLimit: options?.userLimit,
            isTemporary: type === types_1.VoiceChannelType.TEMPORARY || Boolean(options?.expiresAt),
            activityLogs: [],
            templateId: options?.templateId,
        };
        this.channels.set(channel.id, channel);
        this.persistChannel(channel).catch(() => { });
        return channel;
    }
    getChannel(channelId) {
        return this.channels.get(channelId);
    }
    getChannelByDiscordId(discordChannelId) {
        return Array.from(this.channels.values()).find(channel => channel.channelId === discordChannelId);
    }
    getGuildChannels(guildId) {
        return Array.from(this.channels.values()).filter(channel => channel.guildId === guildId);
    }
    getEventChannels(eventId) {
        return Array.from(this.channels.values()).filter(channel => channel.eventId === eventId);
    }
    getTemporaryChannels() {
        return Array.from(this.channels.values()).filter(channel => channel.isTemporary);
    }
    getExpiredChannels() {
        const now = new Date();
        return Array.from(this.channels.values()).filter(channel => channel.expiresAt && channel.expiresAt <= now);
    }
    logActivity(channelId, userId, userName, action, guildId, channelName) {
        const channel = this.channels.get(channelId);
        if (channel) {
            const log = {
                userId,
                userName,
                channelId: channel.channelId,
                channelName,
                guildId,
                action,
                timestamp: new Date(),
            };
            channel.activityLogs.push(log);
            this.persistChannel(channel).catch(() => { });
        }
    }
    getActivityLogs(channelId) {
        const channel = this.channels.get(channelId);
        return channel ? channel.activityLogs : [];
    }
    getGuildActivityLogs(guildId) {
        const logs = [];
        this.channels.forEach(channel => {
            if (channel.guildId === guildId) {
                logs.push(...channel.activityLogs);
            }
        });
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    deleteChannel(channelId) {
        const deleted = this.channels.delete(channelId);
        if (deleted) {
            this.unpersistChannel(channelId).catch(() => { });
        }
        return deleted;
    }
    deleteByDiscordId(discordChannelId) {
        const channel = this.getChannelByDiscordId(discordChannelId);
        if (channel) {
            return this.deleteChannel(channel.id);
        }
        return false;
    }
    updateExpiration(channelId, expiresAt) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.expiresAt = expiresAt;
            channel.isTemporary = Boolean(expiresAt) || channel.type === types_1.VoiceChannelType.TEMPORARY;
            this.persistChannel(channel).catch(() => { });
            return true;
        }
        return false;
    }
    updateUserLimit(channelId, userLimit) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.userLimit = userLimit;
            this.persistChannel(channel).catch(() => { });
            return true;
        }
        return false;
    }
    cleanupExpiredChannels() {
        const expiredChannels = this.getExpiredChannels();
        const deletedIds = [];
        expiredChannels.forEach(channel => {
            this.deleteChannel(channel.id);
            deletedIds.push(channel.channelId);
        });
        return deletedIds;
    }
    initializeDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'default',
                name: 'Default Channel',
                description: 'Basic voice channel template',
                userLimit: 0,
                bitrate: 64000,
                autoDelete: true,
                autoDeleteDelay: 5,
                namingPattern: "{user}'s Channel",
                createdAt: new Date(),
                createdBy: 'system',
            },
            {
                id: 'gaming',
                name: 'Gaming Session',
                description: 'Optimized for gaming',
                userLimit: 10,
                bitrate: 96000,
                autoDelete: true,
                autoDeleteDelay: 10,
                namingPattern: "{user}'s Game",
                permissions: {
                    canSpeak: true,
                    canStream: true,
                    canUseVoiceActivity: true,
                    canPrioritySpeaker: false,
                },
                createdAt: new Date(),
                createdBy: 'system',
            },
            {
                id: 'meeting',
                name: 'Meeting Room',
                description: 'Professional meeting space',
                userLimit: 25,
                bitrate: 128000,
                autoDelete: true,
                autoDeleteDelay: 15,
                namingPattern: 'Meeting - {user}',
                permissions: {
                    canSpeak: true,
                    canStream: true,
                    canUseVoiceActivity: false,
                    canPrioritySpeaker: true,
                },
                createdAt: new Date(),
                createdBy: 'system',
            },
            {
                id: 'streaming',
                name: 'Stream Room',
                description: 'High quality for streaming',
                userLimit: 50,
                bitrate: 128000,
                autoDelete: true,
                autoDeleteDelay: 5,
                namingPattern: '{user} is Live!',
                permissions: {
                    canSpeak: true,
                    canStream: true,
                    canUseVoiceActivity: true,
                    canPrioritySpeaker: false,
                },
                createdAt: new Date(),
                createdBy: 'system',
            },
            {
                id: 'private',
                name: 'Private Room',
                description: 'Invite-only voice channel',
                userLimit: 5,
                bitrate: 96000,
                autoDelete: true,
                autoDeleteDelay: 2,
                namingPattern: "🔒 {user}'s Room",
                permissions: {
                    canSpeak: true,
                    canStream: false,
                    canUseVoiceActivity: true,
                    canPrioritySpeaker: false,
                },
                createdAt: new Date(),
                createdBy: 'system',
            },
        ];
        defaultTemplates.forEach(template => {
            this.templates.set(template.id, template);
        });
        logger_1.logger.info(`Initialized ${defaultTemplates.length} default voice channel templates`);
    }
    createTemplate(template) {
        const id = `template-${Date.now()}-${(0, uuid_1.v4)().substring(0, 8)}`;
        const newTemplate = {
            ...template,
            id,
            createdAt: new Date(),
        };
        this.templates.set(id, newTemplate);
        this.persistTemplate(newTemplate).catch(() => { });
        logger_1.logger.info(`Created voice channel template: ${newTemplate.name} (${id})`);
        return newTemplate;
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    listTemplates() {
        return Array.from(this.templates.values());
    }
    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }
        Object.assign(template, updates);
        this.persistTemplate(template).catch(() => { });
        logger_1.logger.info(`Updated voice channel template: ${templateId}`);
        return true;
    }
    deleteTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (template?.createdBy === 'system') {
            logger_1.logger.warn(`Cannot delete system template: ${templateId}`);
            return false;
        }
        const deleted = this.templates.delete(templateId);
        if (deleted) {
            this.unpersistTemplate(templateId).catch(() => { });
            logger_1.logger.info(`Deleted voice channel template: ${templateId}`);
        }
        return deleted;
    }
    configureGuild(config) {
        this.configs.set(config.guildId, config);
        this.persistConfig(config).catch(() => { });
        logger_1.logger.info(`Configured voice channels for guild ${config.guildId}`);
    }
    getGuildConfig(guildId) {
        return this.configs.get(guildId);
    }
    updateGuildConfig(guildId, updates) {
        const config = this.configs.get(guildId);
        if (!config) {
            return false;
        }
        Object.assign(config, updates);
        this.persistConfig(config).catch(() => { });
        logger_1.logger.info(`Updated voice channel config for guild ${guildId}`);
        return true;
    }
    initializeStats(channelId, guildId) {
        if (!this.stats.has(channelId)) {
            this.stats.set(channelId, {
                channelId,
                guildId,
                totalSessions: 0,
                totalUsers: 0,
                totalDuration: 0,
                averageDuration: 0,
                peakUsers: 0,
                lastUsed: new Date(),
                userStats: new Map(),
            });
        }
    }
    trackUserSession(channelId, userId, username, duration) {
        const stats = this.stats.get(channelId);
        if (!stats) {
            return;
        }
        stats.totalSessions++;
        stats.totalUsers++;
        stats.totalDuration += duration;
        stats.averageDuration = stats.totalDuration / stats.totalSessions;
        const userStat = stats.userStats.get(userId) || {
            userId,
            username,
            sessionCount: 0,
            totalTime: 0,
        };
        userStat.sessionCount++;
        userStat.totalTime += duration;
        stats.userStats.set(userId, userStat);
        logger_1.logger.debug(`Tracked session for user ${username} in channel ${channelId}: ${duration} minutes`);
    }
    updatePeakUsers(channelId, userCount) {
        const stats = this.stats.get(channelId);
        if (stats) {
            stats.peakUsers = Math.max(stats.peakUsers, userCount);
            stats.lastUsed = new Date();
        }
    }
    getChannelStats(channelId) {
        return this.stats.get(channelId);
    }
    getGuildStats(guildId) {
        return Array.from(this.stats.values()).filter(s => s.guildId === guildId);
    }
    getTopChannels(guildId, limit = 10) {
        return this.getGuildStats(guildId)
            .sort((a, b) => b.totalSessions - a.totalSessions)
            .slice(0, limit);
    }
    getTopUsers(guildId, limit = 10) {
        const userMap = new Map();
        this.getGuildStats(guildId).forEach(stats => {
            stats.userStats.forEach((userStat, userId) => {
                const existing = userMap.get(userId);
                if (existing) {
                    existing.totalTime += userStat.totalTime;
                    existing.sessionCount += userStat.sessionCount;
                }
                else {
                    userMap.set(userId, {
                        userId: userStat.userId,
                        username: userStat.username,
                        totalTime: userStat.totalTime,
                        sessionCount: userStat.sessionCount,
                    });
                }
            });
        });
        return Array.from(userMap.values())
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, limit);
    }
    customizeChannel(channelId, userId, customizations) {
        const channel = this.channels.get(channelId);
        if (!channel) {
            return false;
        }
        if (channel.creatorId !== userId) {
            throw new Error('Only the channel owner can customize it');
        }
        channel.customizations = customizations;
        this.persistChannel(channel).catch(() => { });
        logger_1.logger.info(`Customized voice channel ${channelId}`);
        return true;
    }
    startCleanupTask() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredChannels();
        }, 60000);
        this.cleanupInterval.unref();
        logger_1.logger.info('Started voice channel cleanup task');
    }
    stopCleanupTask() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            logger_1.logger.info('Stopped voice channel cleanup task');
        }
    }
    getServiceStats() {
        const totalSessions = Array.from(this.stats.values()).reduce((sum, stat) => sum + stat.totalSessions, 0);
        return {
            totalTemplates: this.templates.size,
            totalChannels: this.channels.size,
            totalActiveChannels: Array.from(this.channels.values()).filter(c => !c.expiresAt || c.expiresAt > new Date()).length,
            totalGuilds: this.configs.size,
            totalSessions,
        };
    }
}
exports.VoiceChannelService = VoiceChannelService;
//# sourceMappingURL=VoiceChannelService.js.map