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
exports.FederationDiscordGuildSettings = void 0;
const typeorm_1 = require("typeorm");
let FederationDiscordGuildSettings = class FederationDiscordGuildSettings {
    id;
    federationId;
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
            federationId: this.federationId,
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
exports.FederationDiscordGuildSettings = FederationDiscordGuildSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "guildName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "guildIconUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "eventSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "voiceChannelSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "tunnelSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "notificationPreferences", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "roleSyncSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "crossModerationSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "ticketSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "statSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "dmNotificationSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "smartLfgPingSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "recruitmentSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "giveawaySettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "advancedEventSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "teamVoiceSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "roleGatingSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "lfgNetworkSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "lfgSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "welcomeSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "auditLogSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], FederationDiscordGuildSettings.prototype, "settingsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], FederationDiscordGuildSettings.prototype, "adminUserIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], FederationDiscordGuildSettings.prototype, "serverManagerRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], FederationDiscordGuildSettings.prototype, "starCommsManagerRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], FederationDiscordGuildSettings.prototype, "assistantRoleIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationDiscordGuildSettings.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "lastModifiedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationDiscordGuildSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FederationDiscordGuildSettings.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], FederationDiscordGuildSettings.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], FederationDiscordGuildSettings.prototype, "syncErrorCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FederationDiscordGuildSettings.prototype, "lastSyncError", void 0);
exports.FederationDiscordGuildSettings = FederationDiscordGuildSettings = __decorate([
    (0, typeorm_1.Entity)('federation_discord_guild_settings'),
    (0, typeorm_1.Index)(['federationId', 'guildId'], { unique: true }),
    (0, typeorm_1.Index)(['federationId']),
    (0, typeorm_1.Index)(['guildId'])
], FederationDiscordGuildSettings);
//# sourceMappingURL=FederationDiscordGuildSettings.js.map