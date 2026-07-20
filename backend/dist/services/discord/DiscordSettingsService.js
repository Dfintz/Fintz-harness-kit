"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordSettingsService = exports.DiscordSettingsService = void 0;
const guildFeatureFlags_1 = require("../../bot/utils/guildFeatureFlags");
const database_1 = require("../../config/database");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
class DiscordSettingsService {
    settingsRepository;
    static SAFE_SCOPE_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
    constructor() {
        this.settingsRepository = database_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
    }
    async getOrCreateSettings(organizationId, guildId, guildName, guildIconUrl) {
        const id = `${organizationId}:${guildId}`;
        let settings = await this.settingsRepository.findOne({
            where: { id },
        });
        if (!settings) {
            settings = this.settingsRepository.create({
                id,
                organizationId,
                guildId,
                guildName,
                guildIconUrl,
                eventSettings: this.getDefaultEventSettings(),
                voiceChannelSettings: this.getDefaultVoiceChannelSettings(),
                tunnelSettings: this.getDefaultTunnelSettings(),
                notificationPreferences: this.getDefaultNotificationPreferences(),
                roleSyncSettings: this.getDefaultRoleSyncSettings(),
                crossModerationSettings: this.getDefaultCrossModerationSettings(),
                ticketSettings: this.getDefaultTicketSettings(),
                recruitmentSettings: this.getDefaultRecruitmentSettings(),
                teamVoiceSettings: this.getDefaultTeamVoiceSettings(),
                lfgNetworkSettings: this.getDefaultLfgNetworkSettings(),
                smartLfgPingSettings: this.getDefaultSmartLfgPingSettings(),
                welcomeSettings: this.getDefaultWelcomeSettings(),
                auditLogSettings: this.getDefaultAuditLogSettings(),
            });
            await this.settingsRepository.save(settings);
            logger_1.logger.info(`Created Discord settings for org:${organizationId} guild:${guildId}`);
        }
        return settings;
    }
    async getSettings(organizationId, guildId) {
        if (!this.isSafeScopeIdentifier(organizationId) || !this.isSafeScopeIdentifier(guildId)) {
            logger_1.logger.warn('Rejected getSettings call with unsafe scope identifier', {
                organizationId,
                guildId,
            });
            return null;
        }
        return this.settingsRepository.findOne({
            where: { organizationId, guildId },
        });
    }
    async requireGuildAccess(organizationId, guildId) {
        if (!organizationId) {
            throw new apiErrors_1.ForbiddenError('No active organization context for Discord guild access', {
                resource: 'discord_guild',
                action: 'access',
                resourceId: guildId,
            });
        }
        const settings = await this.settingsRepository.findOne({
            where: { organizationId, guildId },
        });
        if (!settings) {
            throw new apiErrors_1.ForbiddenError('Discord guild is not linked to your organization', {
                resource: 'discord_guild',
                action: 'access',
                scope: organizationId,
                resourceId: guildId,
            });
        }
        return settings;
    }
    async getOrganizationSettings(organizationId) {
        return this.settingsRepository.find({
            where: { organizationId },
            order: { guildName: 'ASC' },
        });
    }
    async getSettingsByGuildId(guildId) {
        if (!this.isSafeScopeIdentifier(guildId)) {
            logger_1.logger.warn('Rejected getSettingsByGuildId call with unsafe guild identifier', { guildId });
            return [];
        }
        return this.settingsRepository.find({
            where: { guildId },
        });
    }
    async saveSettings(settings) {
        return this.settingsRepository.save(settings);
    }
    async getGuildFeatureFlagOverrides(organizationId, guildId) {
        const settings = await this.getSettings(organizationId, guildId);
        return (0, guildFeatureFlags_1.sanitizeGuildFeatureFlagOverrides)(settings?.featureFlags);
    }
    async setGuildFeatureFlagOverride(organizationId, guildId, flag, enabled, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'featureFlags', { [flag]: enabled }, modifiedBy, { logLabel: 'feature flags' });
    }
    async mergeAndSaveJsonbField(organizationId, guildId, field, partial, modifiedBy, options) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        const current = settings[field];
        const merged = {
            ...options?.defaults,
            ...current,
            ...partial,
        };
        settings[field] = merged;
        settings.lastModifiedBy = modifiedBy;
        await this.settingsRepository.save(settings);
        logger_1.logger.info(`Updated ${options?.logLabel ?? String(field)} for org:${organizationId} guild:${guildId} by:${modifiedBy}`);
        return settings;
    }
    async updateEventSettings(organizationId, guildId, eventSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'eventSettings', eventSettings, modifiedBy, { logLabel: 'event settings' });
    }
    async updateVoiceChannelSettings(organizationId, guildId, voiceSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'voiceChannelSettings', voiceSettings, modifiedBy, { logLabel: 'voice channel settings' });
    }
    async updateTunnelSettings(organizationId, guildId, tunnelSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'tunnelSettings', tunnelSettings, modifiedBy, { logLabel: 'tunnel settings' });
    }
    async updateNotificationPreferences(organizationId, guildId, notificationPreferences, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'notificationPreferences', notificationPreferences, modifiedBy, { logLabel: 'notification preferences' });
    }
    async updateRoleSyncSettings(organizationId, guildId, roleSyncSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'roleSyncSettings', roleSyncSettings, modifiedBy, { logLabel: 'role sync settings' });
    }
    async updateCrossModerationSettings(organizationId, guildId, crossModerationSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'crossModerationSettings', crossModerationSettings, modifiedBy, {
            defaults: this.getDefaultCrossModerationSettings(),
            logLabel: 'cross moderation settings',
        });
    }
    async updateTicketSettings(organizationId, guildId, ticketSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'ticketSettings', ticketSettings, modifiedBy, { defaults: this.getDefaultTicketSettings(), logLabel: 'ticket settings' });
    }
    async updateTeamVoiceSettings(organizationId, guildId, teamVoiceSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'teamVoiceSettings', teamVoiceSettings, modifiedBy, { defaults: this.getDefaultTeamVoiceSettings(), logLabel: 'team voice settings' });
    }
    async updateLfgSettings(organizationId, guildId, lfgSettings, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        const currentSmartPing = settings.smartLfgPingSettings ?? this.getDefaultSmartLfgPingSettings();
        settings.smartLfgPingSettings = this.mergeSmartPingSettings(currentSmartPing, lfgSettings);
        const currentLfg = settings.lfgNetworkSettings ?? this.getDefaultLfgNetworkSettings();
        settings.lfgNetworkSettings = this.mergeLfgNetworkSettings(currentLfg, lfgSettings);
        const currentGameSettings = settings.lfgSettings ?? {};
        const gameSettingsUpdate = this.buildLfgGameSettingsUpdate(lfgSettings);
        if (Object.keys(gameSettingsUpdate).length > 0) {
            settings.lfgSettings = { ...currentGameSettings, ...gameSettingsUpdate };
        }
        settings.lastModifiedBy = modifiedBy;
        await this.settingsRepository.save(settings);
        logger_1.logger.info(`Updated LFG settings for org:${organizationId} guild:${guildId} by:${modifiedBy}`);
        return settings;
    }
    isSafeScopeIdentifier(value) {
        return DiscordSettingsService.SAFE_SCOPE_ID_PATTERN.test(value);
    }
    mergeSmartPingSettings(currentSmartPing, lfgSettings) {
        return {
            ...currentSmartPing,
            enabled: lfgSettings.smartPingEnabled ?? currentSmartPing.enabled,
            cooldownHours: lfgSettings.pingCooldownMinutes
                ? lfgSettings.pingCooldownMinutes / 60
                : (currentSmartPing.cooldownHours ?? 4),
        };
    }
    mergeLfgNetworkSettings(currentLfg, lfgSettings) {
        return {
            ...currentLfg,
            ...(lfgSettings.lfgChannelId !== undefined && { lfgChannelId: lfgSettings.lfgChannelId }),
            ...(lfgSettings.autoPostEnabled !== undefined && {
                autoPostEnabled: lfgSettings.autoPostEnabled,
            }),
            ...(lfgSettings.autoLfgVoiceChannelScope !== undefined && {
                autoLfgVoiceChannelScope: lfgSettings.autoLfgVoiceChannelScope,
            }),
            ...(lfgSettings.autoLfgAllowedVoiceChannelIds !== undefined && {
                autoLfgAllowedVoiceChannelIds: lfgSettings.autoLfgAllowedVoiceChannelIds.filter(id => /^\d+$/.test(id)),
            }),
            ...(lfgSettings.crossOrgEnabled !== undefined && {
                crossOrgEnabled: lfgSettings.crossOrgEnabled,
            }),
            ...(lfgSettings.crossOrgAllowList !== undefined && {
                crossOrgAllowList: lfgSettings.crossOrgAllowList.filter(id => id.trim().length > 0),
            }),
            ...(lfgSettings.crossOrgBlockList !== undefined && {
                crossOrgBlockList: lfgSettings.crossOrgBlockList.filter(id => id.trim().length > 0),
            }),
            ...(lfgSettings.crossOrgManualAllowTags !== undefined && {
                crossOrgManualAllowTags: lfgSettings.crossOrgManualAllowTags
                    .map(tag => tag.trim().toUpperCase())
                    .filter(tag => tag.length > 0),
            }),
            ...(lfgSettings.crossOrgManualBlockTags !== undefined && {
                crossOrgManualBlockTags: lfgSettings.crossOrgManualBlockTags
                    .map(tag => tag.trim().toUpperCase())
                    .filter(tag => tag.length > 0),
            }),
            ...(lfgSettings.region !== undefined && { region: lfgSettings.region }),
            ...(lfgSettings.language !== undefined && { language: lfgSettings.language }),
            ...(lfgSettings.roleFilterMappings !== undefined && {
                roleFilterMappings: lfgSettings.roleFilterMappings,
            }),
        };
    }
    buildLfgGameSettingsUpdate(lfgSettings) {
        const gameSettingsUpdate = {};
        if (lfgSettings.defaultGame !== undefined) {
            gameSettingsUpdate.defaultGame = lfgSettings.defaultGame;
        }
        if (lfgSettings.gameFilters !== undefined) {
            const raw = lfgSettings.gameFilters;
            const list = Array.isArray(raw) ? raw : raw.split(',');
            gameSettingsUpdate.gameFilters = list.map(g => g.trim()).filter(g => g.length > 0);
        }
        if (lfgSettings.otherGamesChannelId !== undefined) {
            gameSettingsUpdate.otherGamesChannelId = lfgSettings.otherGamesChannelId;
        }
        if (lfgSettings.lfgVoiceCategoryId !== undefined) {
            gameSettingsUpdate.lfgVoiceCategoryId = lfgSettings.lfgVoiceCategoryId;
        }
        if (lfgSettings.publicLfgEnabled !== undefined) {
            gameSettingsUpdate.publicLfgEnabled = lfgSettings.publicLfgEnabled;
        }
        if (lfgSettings.publicLfgDelivery !== undefined) {
            gameSettingsUpdate.publicLfgDelivery = lfgSettings.publicLfgDelivery;
        }
        if (lfgSettings.publicLfgChannelId !== undefined) {
            gameSettingsUpdate.publicLfgChannelId = lfgSettings.publicLfgChannelId;
        }
        if (lfgSettings.publicLfgOptInRoleId !== undefined) {
            gameSettingsUpdate.publicLfgOptInRoleId = lfgSettings.publicLfgOptInRoleId;
        }
        if (lfgSettings.publicLfgGuildAllowList !== undefined) {
            gameSettingsUpdate.publicLfgGuildAllowList = lfgSettings.publicLfgGuildAllowList.filter(id => /^\d{17,20}$/.test(id));
        }
        if (lfgSettings.lfgMentionRoleId !== undefined) {
            gameSettingsUpdate.lfgMentionRoleId = lfgSettings.lfgMentionRoleId;
        }
        return gameSettingsUpdate;
    }
    async updateLfgGameSettings(organizationId, guildId, lfgGameSettings, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        const currentLfgSettings = settings.lfgSettings ?? {};
        settings.lfgSettings = {
            ...currentLfgSettings,
            ...lfgGameSettings,
        };
        settings.lastModifiedBy = modifiedBy;
        await this.settingsRepository.save(settings);
        logger_1.logger.info(`Updated LFG game settings for org:${organizationId} guild:${guildId} by:${modifiedBy}`);
        return settings;
    }
    async getAllGuildSettings() {
        return this.settingsRepository.find();
    }
    async markSynced(organizationId, guildId, errorMessage) {
        const settings = await this.getSettings(organizationId, guildId);
        if (!settings) {
            return;
        }
        settings.lastSyncedAt = new Date();
        if (errorMessage) {
            settings.syncErrorCount++;
            settings.lastSyncError = errorMessage;
        }
        else {
            settings.syncErrorCount = 0;
            settings.lastSyncError = undefined;
        }
        await this.settingsRepository.save(settings);
    }
    async addAdminUser(organizationId, guildId, userId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        settings.adminUserIds ??= [];
        if (!settings.adminUserIds.includes(userId)) {
            settings.adminUserIds.push(userId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    async removeAdminUser(organizationId, guildId, userId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        if (settings.adminUserIds) {
            settings.adminUserIds = settings.adminUserIds.filter(id => id !== userId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    async addServerManagerRole(organizationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        settings.serverManagerRoleIds ??= [];
        if (!settings.serverManagerRoleIds.includes(roleId)) {
            settings.serverManagerRoleIds.push(roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    async removeServerManagerRole(organizationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        if (settings.serverManagerRoleIds) {
            settings.serverManagerRoleIds = settings.serverManagerRoleIds.filter(id => id !== roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    async addStarCommsManagerRole(organizationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        settings.starCommsManagerRoleIds ??= [];
        if (!settings.starCommsManagerRoleIds.includes(roleId)) {
            settings.starCommsManagerRoleIds.push(roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    async removeStarCommsManagerRole(organizationId, guildId, roleId, modifiedBy) {
        const settings = await this.getOrCreateSettings(organizationId, guildId);
        if (settings.starCommsManagerRoleIds) {
            settings.starCommsManagerRoleIds = settings.starCommsManagerRoleIds.filter(id => id !== roleId);
            settings.lastModifiedBy = modifiedBy;
            await this.settingsRepository.save(settings);
        }
        return settings;
    }
    getDefaultEventSettings() {
        return {
            autoDeleteEventMessages: false,
            eventMessageRetentionDays: 30,
            cleanupMode: 'afterEnd',
            cleanupHoursAfterEnd: 48,
            allowEventRsvp: true,
            remindersEnabled: true,
            reminderHoursBefore: [24, 1],
            maxMirrorsPerActivity: 5,
            createEventThread: false,
        };
    }
    getDefaultVoiceChannelSettings() {
        return {
            autoCreateChannels: false,
            autoDeleteEmptyChannels: true,
            deleteEmptyChannelDelaySeconds: 10,
            maxActiveChannels: 50,
            userCanRename: true,
            templates: [],
        };
    }
    getDefaultTunnelSettings() {
        return {
            enabled: false,
            maxActiveTunnels: 10,
            tunnelDurationMinutes: 60,
            autoDeleteTunnel: true,
            allowNesting: false,
        };
    }
    getDefaultNotificationPreferences() {
        return {
            memberJoinNotifications: false,
            memberLeaveNotifications: false,
            roleChangeNotifications: false,
            eventNotifications: true,
            enableMentionRolesToNotify: false,
            notificationMentionRoles: [],
        };
    }
    getDefaultRoleSyncSettings() {
        return {
            enabled: false,
            syncRolesFromApi: true,
            syncRolesFromSheet: false,
            autoRoleManagement: false,
            removeRolesOnLeave: true,
            syncIntervalMinutes: 60,
            syncOnBotJoin: true,
            requireManualApproval: false,
            roleMappings: {},
        };
    }
    getDefaultCrossModerationSettings() {
        return {
            enabled: false,
            sharedBanListEnabled: true,
            sharedMuteListEnabled: false,
            autoBanOnSharedList: false,
            propagateTimeouts: false,
            forwardModerationAlerts: true,
            notifyOnSharedAction: true,
            allowedGuildIds: [],
        };
    }
    getDefaultTicketSettings() {
        return {
            enabled: false,
            autoCloseHours: 72,
            maxOpenTicketsPerUser: 2,
            mentionSupportRoleOnCreate: true,
            notifyOnClose: true,
            allowMemberClose: true,
        };
    }
    getDefaultTeamVoiceSettings() {
        return {
            enabled: false,
            allowBaseVisibility: false,
            allowListenIn: false,
            enforcePushToTalk: false,
            enablePrioritySpeaker: false,
            autoCreateOnTeamCreate: true,
            autoDeleteOnTeamDelete: true,
        };
    }
    async updateRecruitmentSettings(organizationId, guildId, recruitmentSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'recruitmentSettings', recruitmentSettings, modifiedBy, { defaults: this.getDefaultRecruitmentSettings(), logLabel: 'recruitment settings' });
    }
    getDefaultRecruitmentSettings() {
        return {
            enabled: false,
            requireDiscordVerification: true,
            autoAssignRole: true,
            welcomeMessage: 'Welcome to the organization! Your application has been approved.',
            inviteFormEnabled: false,
            autoResolveOnRoleChange: true,
        };
    }
    getDefaultLfgNetworkSettings() {
        return {
            lfgChannelId: '',
            autoPostEnabled: false,
            autoLfgVoiceChannelScope: 'all',
            autoLfgAllowedVoiceChannelIds: [],
            crossOrgEnabled: false,
        };
    }
    getDefaultSmartLfgPingSettings() {
        return {
            enabled: false,
            cooldownHours: 4,
        };
    }
    getDefaultWelcomeSettings() {
        return {
            welcomeEnabled: false,
            goodbyeEnabled: false,
            welcomeDmEnabled: false,
        };
    }
    getDefaultAuditLogSettings() {
        return {
            enabled: false,
            logMessageEdits: true,
            logMessageDeletes: true,
            logRoleChanges: true,
            logChannelChanges: false,
            logMemberJoinLeave: true,
        };
    }
    async updateWelcomeSettings(organizationId, guildId, welcomeSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'welcomeSettings', welcomeSettings, modifiedBy, { defaults: this.getDefaultWelcomeSettings(), logLabel: 'welcome settings' });
    }
    async updateAuditLogSettings(organizationId, guildId, auditLogSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'auditLogSettings', auditLogSettings, modifiedBy, { defaults: this.getDefaultAuditLogSettings(), logLabel: 'audit log settings' });
    }
    async updateStatSettings(organizationId, guildId, statSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'statSettings', statSettings, modifiedBy, { logLabel: 'stat settings' });
    }
    async updateDmNotificationSettings(organizationId, guildId, dmNotificationSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'dmNotificationSettings', dmNotificationSettings, modifiedBy, { logLabel: 'DM notification settings' });
    }
    async updateSmartLfgPingSettings(organizationId, guildId, smartLfgPingSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'smartLfgPingSettings', smartLfgPingSettings, modifiedBy, { logLabel: 'smart LFG ping settings' });
    }
    async updateGiveawaySettings(organizationId, guildId, giveawaySettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'giveawaySettings', giveawaySettings, modifiedBy, { logLabel: 'giveaway settings' });
    }
    async updateAdvancedEventSettings(organizationId, guildId, advancedEventSettings, modifiedBy) {
        return this.mergeAndSaveJsonbField(organizationId, guildId, 'advancedEventSettings', advancedEventSettings, modifiedBy, { logLabel: 'advanced event settings' });
    }
}
exports.DiscordSettingsService = DiscordSettingsService;
exports.discordSettingsService = new DiscordSettingsService();
//# sourceMappingURL=DiscordSettingsService.js.map