import type { AdvancedEventSettings, AuditLogSettings, CrossModerationSettings, DmNotificationSettings, EventSettings, GiveawaySettings, LfgSettings, NotificationPreferences, RecruitmentSettings, RoleSyncSettings, SmartLfgPingSettings, StatSettings, TeamVoiceSettings, TicketSettings, TunnelSettings, VoiceChannelSettings, WelcomeSettings } from '../../models/DiscordGuildSettings';
import { FederationDiscordGuildSettings } from '../../models/FederationDiscordGuildSettings';
export declare class FederationDiscordSettingsService {
    private static instance;
    private readonly repo;
    private constructor();
    static getInstance(): FederationDiscordSettingsService;
    getOrCreateSettings(federationId: string, guildId: string, guildName?: string, guildIconUrl?: string): Promise<FederationDiscordGuildSettings>;
    getSettings(federationId: string, guildId: string): Promise<FederationDiscordGuildSettings | null>;
    getAllForFederation(federationId: string): Promise<FederationDiscordGuildSettings[]>;
    getSettingsByGuildId(guildId: string): Promise<FederationDiscordGuildSettings[]>;
    saveSettings(settings: FederationDiscordGuildSettings): Promise<FederationDiscordGuildSettings>;
    deleteSettings(federationId: string, guildId: string): Promise<void>;
    private mergeAndSaveJsonbField;
    updateEventSettings(federationId: string, guildId: string, eventSettings: Partial<EventSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateVoiceChannelSettings(federationId: string, guildId: string, voiceSettings: Partial<VoiceChannelSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateTunnelSettings(federationId: string, guildId: string, tunnelSettings: Partial<TunnelSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateNotificationPreferences(federationId: string, guildId: string, notificationPreferences: Partial<NotificationPreferences>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateRoleSyncSettings(federationId: string, guildId: string, roleSyncSettings: Partial<RoleSyncSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateCrossModerationSettings(federationId: string, guildId: string, crossModerationSettings: Partial<CrossModerationSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateTicketSettings(federationId: string, guildId: string, ticketSettings: Partial<TicketSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateTeamVoiceSettings(federationId: string, guildId: string, teamVoiceSettings: Partial<TeamVoiceSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateLfgSettings(federationId: string, guildId: string, lfgSettings: Partial<LfgSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateRecruitmentSettings(federationId: string, guildId: string, recruitmentSettings: Partial<RecruitmentSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateWelcomeSettings(federationId: string, guildId: string, welcomeSettings: Partial<WelcomeSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateAuditLogSettings(federationId: string, guildId: string, auditLogSettings: Partial<AuditLogSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateStatSettings(federationId: string, guildId: string, statSettings: Partial<StatSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateDmNotificationSettings(federationId: string, guildId: string, dmNotificationSettings: Partial<DmNotificationSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateSmartLfgPingSettings(federationId: string, guildId: string, smartLfgPingSettings: Partial<SmartLfgPingSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateGiveawaySettings(federationId: string, guildId: string, giveawaySettings: Partial<GiveawaySettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    updateAdvancedEventSettings(federationId: string, guildId: string, advancedEventSettings: Partial<AdvancedEventSettings>, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    addStarCommsManagerRole(federationId: string, guildId: string, roleId: string, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
    removeStarCommsManagerRole(federationId: string, guildId: string, roleId: string, modifiedBy: string): Promise<FederationDiscordGuildSettings>;
}
export declare const federationDiscordSettingsService: FederationDiscordSettingsService;
//# sourceMappingURL=FederationDiscordSettingsService.d.ts.map