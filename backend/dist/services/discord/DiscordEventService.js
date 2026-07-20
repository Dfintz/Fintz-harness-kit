"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordEventService = void 0;
const discord_js_1 = require("discord.js");
const discord_1 = require("../../bot/utils/discord");
const logger_1 = require("../../utils/logger");
class DiscordEventService {
    static instance;
    client = null;
    constructor() { }
    static getInstance() {
        DiscordEventService.instance ??= new DiscordEventService();
        return DiscordEventService.instance;
    }
    initialize(client) {
        this.client = client;
        logger_1.logger.info('DiscordEventService initialized');
    }
    async createEvent(guildId, activity) {
        if (!this.client) {
            logger_1.logger.warn('DiscordEventService: Client not initialized');
            return null;
        }
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                logger_1.logger.warn(`DiscordEventService: Guild ${guildId} not found in cache`);
                return null;
            }
            if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageEvents)) {
                logger_1.logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
                return null;
            }
            const startTime = new Date(activity.scheduledStartDate);
            const endTime = activity.scheduledEndDate
                ? new Date(activity.scheduledEndDate)
                : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
            const summaryLine = activity.participantCount !== undefined
                ? `Participants: ${activity.participantCount}${activity.participantCap !== undefined ? ` / ${activity.participantCap}` : ''}`
                : '';
            const descriptionParts = [activity.description?.trim() ?? '', summaryLine].filter(Boolean);
            const fullDescription = descriptionParts.join('\n\n');
            const event = await guild.scheduledEvents.create({
                name: activity.title.substring(0, 100),
                description: fullDescription.substring(0, 1000) || undefined,
                scheduledStartTime: startTime,
                scheduledEndTime: endTime,
                privacyLevel: discord_js_1.GuildScheduledEventPrivacyLevel.GuildOnly,
                entityType: discord_js_1.GuildScheduledEventEntityType.External,
                entityMetadata: {
                    location: activity.location ?? 'Star Citizen',
                },
            });
            logger_1.logger.info(`Created Discord event ${event.id} for activity "${activity.title}" in guild ${guildId}`);
            return event.id;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create Discord event in guild ${guildId}:`, error);
            return null;
        }
    }
    async updateEvent(guildId, discordEventId, updates) {
        if (!this.client) {
            return false;
        }
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                return false;
            }
            if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageEvents)) {
                logger_1.logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
                return false;
            }
            const event = await guild.scheduledEvents.fetch(discordEventId).catch(() => null);
            if (!event) {
                return false;
            }
            const editData = {};
            if (updates.title) {
                editData.name = updates.title.substring(0, 100);
            }
            if (updates.description !== undefined) {
                editData.description = updates.description.substring(0, 1000);
            }
            if (updates.scheduledStartDate) {
                editData.scheduledStartTime = new Date(updates.scheduledStartDate);
            }
            if (updates.scheduledEndDate) {
                editData.scheduledEndTime = new Date(updates.scheduledEndDate);
            }
            if (updates.status === 'completed') {
                editData.status = discord_js_1.GuildScheduledEventStatus.Completed;
            }
            if (updates.status === 'cancelled') {
                editData.status = discord_js_1.GuildScheduledEventStatus.Canceled;
            }
            await event.edit(editData);
            logger_1.logger.info(`Updated Discord event ${discordEventId} in guild ${guildId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to update Discord event ${discordEventId}:`, error);
            return false;
        }
    }
    async deleteEvent(guildId, discordEventId) {
        if (!this.client) {
            return false;
        }
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                return false;
            }
            if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageEvents)) {
                logger_1.logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
                return false;
            }
            const event = await guild.scheduledEvents.fetch(discordEventId).catch(() => null);
            if (!event) {
                return true;
            }
            await event.delete();
            logger_1.logger.info(`Deleted Discord event ${discordEventId} in guild ${guildId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete Discord event ${discordEventId}:`, error);
            return false;
        }
    }
}
exports.DiscordEventService = DiscordEventService;
//# sourceMappingURL=DiscordEventService.js.map