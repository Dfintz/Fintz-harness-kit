"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordGuildSettings = void 0;
const typeorm_1 = require("typeorm");
let DiscordGuildSettings = class DiscordGuildSettings {
    id;
    organizationId;
    guildId;
    guildName;
    guildIconUrl;
    eventSettings;
    voiceChannelSettings;
    tunnelSettings;
    notificationPreferences;
    roleSyncSettings;
    crossModerationSettings;
    ticketSettings;
    statSettings;
    dmNotificationSettings;
    smartLfgPingSettings;
    recruitmentSettings;
    giveawaySettings;
    advancedEventSettings;
    teamVoiceSettings;
    roleGatingSettings;
    lfgNetworkSettings;
    lfgSettings;
    welcomeSettings;
    auditLogSettings;
    featureFlags;
    timezone;
    settingsEnabled;
    adminUserIds;
    serverManagerRoleIds;
    starCommsManagerRoleIds;
    assistantRoleIds;
    metadata;
    lastModifiedBy;
    createdAt;
    updatedAt;
    lastSyncedAt;
    syncErrorCount;
    lastSyncError;
    toDTO() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            guildId: this.guildId,
            guildName: this.guildName,
            guildIconUrl: this.guildIconUrl,
            eventSettings: this.eventSettings,
            voiceChannelSettings: this.voiceChannelSettings,
            tunnelSettings: this.tunnelSettings,
            notificationPreferences: this.notificationPreferences,
            roleSyncSettings: this.roleSyncSettings,
            crossModerationSettings: this.crossModerationSettings,
            ticketSettings: this.ticketSettings,
            statSettings: this.statSettings,
            dmNotificationSettings: this.dmNotificationSettings,
            smartLfgPingSettings: this.smartLfgPingSettings,
            recruitmentSettings: this.recruitmentSettings,
            giveawaySettings: this.giveawaySettings,
            advancedEventSettings: this.advancedEventSettings,
            teamVoiceSettings: this.teamVoiceSettings,
            roleGatingSettings: this.roleGatingSettings,
            lfgNetworkSettings: this.lfgNetworkSettings,
            lfgSettings: this.lfgSettings,
            welcomeSettings: this.welcomeSettings,
            auditLogSettings: this.auditLogSettings,
            timezone: this.timezone,
            settingsEnabled: this.settingsEnabled,
            adminUserIds: this.adminUserIds,
            serverManagerRoleIds: this.serverManagerRoleIds,
            starCommsManagerRoleIds: this.starCommsManagerRoleIds,
            assistantRoleIds: this.assistantRoleIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastSyncedAt: this.lastSyncedAt,
        };
    }
};
exports.DiscordGuildSettings = DiscordGuildSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "guildName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "guildIconUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "eventSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "voiceChannelSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "tunnelSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "notificationPreferences", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "roleSyncSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "crossModerationSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "ticketSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "statSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "dmNotificationSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "smartLfgPingSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "recruitmentSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "giveawaySettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "advancedEventSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "teamVoiceSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "roleGatingSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "lfgNetworkSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "lfgSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "welcomeSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "auditLogSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "featureFlags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DiscordGuildSettings.prototype, "settingsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], DiscordGuildSettings.prototype, "adminUserIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], DiscordGuildSettings.prototype, "serverManagerRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], DiscordGuildSettings.prototype, "starCommsManagerRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], DiscordGuildSettings.prototype, "assistantRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DiscordGuildSettings.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "lastModifiedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DiscordGuildSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DiscordGuildSettings.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], DiscordGuildSettings.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], DiscordGuildSettings.prototype, "syncErrorCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DiscordGuildSettings.prototype, "lastSyncError", void 0);
exports.DiscordGuildSettings = DiscordGuildSettings = __decorate([
    (0, typeorm_1.Entity)('discord_guild_settings'),
    (0, typeorm_1.Index)(['organizationId', 'guildId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['guildId'])
], DiscordGuildSettings);
//# sourceMappingURL=DiscordGuildSettings.js.map