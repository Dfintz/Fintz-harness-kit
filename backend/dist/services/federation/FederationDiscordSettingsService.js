"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.federationDiscordSettingsService = exports.FederationDiscordSettingsService = void 0;
const database_1 = require("../../config/database");
const FederationDiscordGuildSettings_1 = require("../../models/FederationDiscordGuildSettings");
const logger_1 = require("../../utils/logger");
class FederationDiscordSettingsService {
    static instance;
    repo;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(FederationDiscordGuildSettings_1.FederationDiscordGuildSettings);
    }
    static getInstance() {
        if (!FederationDiscordSettingsService.instance) {
            FederationDiscordSettingsService.instance = new FederationDiscordSettingsService();
        }
        return FederationDiscordSettingsService.instance;
    }
    async getOrCreateSettings(federationId, guildId, guildName, guildIconUrl) {
        const id = `${federationId}:${guildId}`;
        let settings = await this.repo.findOne({ where: { id } });
        if (!settings) {
            settings = this.repo.create({
                id,
                federationId,
                guildId,
                guildName,
                guildIconUrl,
            });
            await this.repo.save(settings);
            logger_1.logger.info(`Created federation Discord guild settings for fed:${federationId} guild:${guildId}`);
        }
        return settings;
    }
    async getSettings(federationId, guildId) {
        return this.repo.findOne({ where: { federationId, guildId } });
    }
    async getAllForFederation(federationId) {
        return this.repo.find({
            where: { federationId },
            order: { guildName: 'ASC' },
        });
    }
    async getSettingsByGuildId(guildId) {
        return this.repo.find({ where: { guildId } });
    }
    async saveSettings(settings) {
        return this.repo.save(settings);
    }
    async deleteSettings(federationId, guildId) {
        await this.repo.delete({ federationId, guildId });
        logger_1.logger.info(`Deleted federation Discord guild settings for fed:${federationId} guild:${guildId}`);
    }
    async mergeAndSaveJsonbField(federationId, guildId, field, partial, modifiedBy, options) {
        const settings = await this.getOrCreateSettings(federationId, guildId);
        const current = settings[field];
        const merged = {
            ...options?.defaults,
            ...current,
            ...partial,
        };
        settings[field] = merged;
        settings.lastModifiedBy = modifiedBy;
        await this.repo.save(settings);
        logger_1.logger.info(`Updated ${options?.logLabel ?? String(field)} for fed:${federationId} guild:${guildId} by:${modifiedBy}`);
        return settings;
    }
    async updateEventSettings(federationId, guildId, eventSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'eventSettings', eventSettings, modifiedBy, {
            logLabel: 'event settings',
        });
    }
    async updateVoiceChannelSettings(federationId, guildId, voiceSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'voiceChannelSettings', voiceSettings, modifiedBy, { logLabel: 'voice channel settings' });
    }
    async updateTunnelSettings(federationId, guildId, tunnelSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'tunnelSettings', tunnelSettings, modifiedBy, { logLabel: 'tunnel settings' });
    }
    async updateNotificationPreferences(federationId, guildId, notificationPreferences, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'notificationPreferences', notificationPreferences, modifiedBy, { logLabel: 'notification preferences' });
    }
    async updateRoleSyncSettings(federationId, guildId, roleSyncSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'roleSyncSettings', roleSyncSettings, modifiedBy, { logLabel: 'role sync settings' });
    }
    async updateCrossModerationSettings(federationId, guildId, crossModerationSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'crossModerationSettings', crossModerationSettings, modifiedBy, { logLabel: 'cross moderation settings' });
    }
    async updateTicketSettings(federationId, guildId, ticketSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'ticketSettings', ticketSettings, modifiedBy, { logLabel: 'ticket settings' });
    }
    async updateTeamVoiceSettings(federationId, guildId, teamVoiceSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'teamVoiceSettings', teamVoiceSettings, modifiedBy, { logLabel: 'team voice settings' });
    }
    async updateLfgSettings(federationId, guildId, lfgSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'lfgSettings', lfgSettings, modifiedBy, { logLabel: 'LFG settings' });
    }
    async updateRecruitmentSettings(federationId, guildId, recruitmentSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'recruitmentSettings', recruitmentSettings, modifiedBy, { logLabel: 'recruitment settings' });
    }
    async updateWelcomeSettings(federationId, guildId, welcomeSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'welcomeSettings', welcomeSettings, modifiedBy, { logLabel: 'welcome settings' });
    }
    async updateAuditLogSettings(federationId, guildId, auditLogSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'auditLogSettings', auditLogSettings, modifiedBy, { logLabel: 'audit log settings' });
    }
    async updateStatSettings(federationId, guildId, statSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'statSettings', statSettings, modifiedBy, { logLabel: 'stat settings' });
    }
    async updateDmNotificationSettings(federationId, guildId, dmNotificationSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'dmNotificationSettings', dmNotificationSettings, modifiedBy, { logLabel: 'DM notification settings' });
    }
    async updateSmartLfgPingSettings(federationId, guildId, smartLfgPingSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'smartLfgPingSettings', smartLfgPingSettings, modifiedBy, { logLabel: 'smart LFG ping settings' });
    }
    async updateGiveawaySettings(federationId, guildId, giveawaySettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'giveawaySettings', giveawaySettings, modifiedBy, { logLabel: 'giveaway settings' });
    }
    async updateAdvancedEventSettings(federationId, guildId, advancedEventSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(federationId, guildId, 'advancedEventSettings', advancedEventSettings, modifiedBy, { logLabel: 'advanced event settings' });
    }
    async addStarCommsManagerRole(federationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(federationId, guildId);
        if (!settings.starCommsManagerRoleIds) {
            settings.starCommsManagerRoleIds = [];
        }
        if (!settings.starCommsManagerRoleIds.includes(roleId)) {
            settings.starCommsManagerRoleIds.push(roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.repo.save(settings);
        }
        return settings;
    }
    async removeStarCommsManagerRole(federationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(federationId, guildId);
        if (settings.starCommsManagerRoleIds) {
            settings.starCommsManagerRoleIds = settings.starCommsManagerRoleIds.filter(id => id !== roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.repo.save(settings);
        }
        return settings;
    }
}
exports.FederationDiscordSettingsService = FederationDiscordSettingsService;
exports.federationDiscordSettingsService = FederationDiscordSettingsService.getInstance();
//# sourceMappingURL=FederationDiscordSettingsService.js.map