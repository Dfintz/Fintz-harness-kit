import { Repository } from 'typeorm';

import {
  sanitizeGuildFeatureFlagOverrides,
  type BotFeatureFlag,
  type GuildFeatureFlagOverrides,
} from '../../bot/utils/guildFeatureFlags';
import { AppDataSource } from '../../config/database';
import {
  AdvancedEventSettings,
  AuditLogSettings,
  CrossModerationSettings,
  DiscordGuildSettings,
  DmNotificationSettings,
  EventSettings,
  GiveawaySettings,
  LfgSettings,
  NotificationPreferences,
  RecruitmentSettings,
  RoleSyncSettings,
  SmartLfgPingSettings,
  StatSettings,
  TeamVoiceSettings,
  TicketSettings,
  TunnelSettings,
  VoiceChannelSettings,
  WelcomeSettings,
} from '../../models/DiscordGuildSettings';
import { ForbiddenError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

/**
 * Discord Settings Service
 * Manages organization-specific Discord guild settings
 * Enforces tenant isolation and proper authorization
 */
export class DiscordSettingsService {
  private readonly settingsRepository: Repository<DiscordGuildSettings>;
  private static readonly SAFE_SCOPE_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

  constructor() {
    this.settingsRepository = AppDataSource.getRepository(DiscordGuildSettings);
  }

  /**
   * Get or create settings for an organization's Discord guild
   */
  async getOrCreateSettings(
    organizationId: string,
    guildId: string,
    guildName?: string,
    guildIconUrl?: string
  ): Promise<DiscordGuildSettings> {
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
      logger.info(`Created Discord settings for org:${organizationId} guild:${guildId}`);
    }

    return settings;
  }

  /**
   * Get settings for an organization's guild (with authorization check)
   */
  async getSettings(organizationId: string, guildId: string): Promise<DiscordGuildSettings | null> {
    if (!this.isSafeScopeIdentifier(organizationId) || !this.isSafeScopeIdentifier(guildId)) {
      logger.warn('Rejected getSettings call with unsafe scope identifier', {
        organizationId,
        guildId,
      });
      return null;
    }

    return this.settingsRepository.findOne({
      where: { organizationId, guildId },
    });
  }

  /**
   * Multi-tenant authorization guard for Discord guild access.
   *
   * Verifies that the given organization has the specified Discord guild
   * linked via DiscordGuildSettings. Throws {@link ForbiddenError} if not.
   *
   * Use this from any HTTP handler or service that exposes guild data
   * (roles, channels, member info) keyed by guildId, to prevent
   * cross-tenant enumeration of unrelated organizations' Discord guilds.
   *
   * @throws ForbiddenError when no DiscordGuildSettings row exists linking
   *         organizationId to guildId.
   */
  async requireGuildAccess(
    organizationId: string | undefined | null,
    guildId: string
  ): Promise<DiscordGuildSettings> {
    if (!organizationId) {
      throw new ForbiddenError('No active organization context for Discord guild access', {
        resource: 'discord_guild',
        action: 'access',
        resourceId: guildId,
      });
    }

    const settings = await this.settingsRepository.findOne({
      where: { organizationId, guildId },
    });

    if (!settings) {
      throw new ForbiddenError('Discord guild is not linked to your organization', {
        resource: 'discord_guild',
        action: 'access',
        scope: organizationId,
        resourceId: guildId,
      });
    }

    return settings;
  }

  /**
   * Get all settings for an organization
   */
  async getOrganizationSettings(organizationId: string): Promise<DiscordGuildSettings[]> {
    return this.settingsRepository.find({
      where: { organizationId },
      order: { guildName: 'ASC' },
    });
  }

  /**
   * Get all settings for a Discord guild (may span multiple orgs)
   */
  async getSettingsByGuildId(guildId: string): Promise<DiscordGuildSettings[]> {
    if (!this.isSafeScopeIdentifier(guildId)) {
      logger.warn('Rejected getSettingsByGuildId call with unsafe guild identifier', { guildId });
      return [];
    }

    return this.settingsRepository.find({
      where: { guildId },
    });
  }

  /**
   * Save a settings entity directly
   */
  async saveSettings(settings: DiscordGuildSettings): Promise<DiscordGuildSettings> {
    return this.settingsRepository.save(settings);
  }

  /**
   * Read the per-guild bot feature-flag overrides (ARCH-11) for a guild as a
   * sanitized {@link GuildFeatureFlagOverrides}, ready to feed the per-guild layer
   * of `resolveGuildFeatureFlag`. Returns `{}` when the guild has no settings row
   * or no overrides. Read-only — never creates a settings row.
   */
  async getGuildFeatureFlagOverrides(
    organizationId: string,
    guildId: string
  ): Promise<GuildFeatureFlagOverrides> {
    const settings = await this.getSettings(organizationId, guildId);
    return sanitizeGuildFeatureFlagOverrides(settings?.featureFlags);
  }

  /**
   * Persist a single per-guild bot feature-flag override (ARCH-11). Merges into
   * any existing overrides (creating the settings row if needed) and stamps
   * `lastModifiedBy`. The stored override is honored by `resolveGuildFeatureFlag`
   * unless an operator env kill-switch overrides it.
   */
  async setGuildFeatureFlagOverride(
    organizationId: string,
    guildId: string,
    flag: BotFeatureFlag,
    enabled: boolean,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'featureFlags',
      { [flag]: enabled },
      modifiedBy,
      { logLabel: 'feature flags' }
    );
  }

  /**
   * Generic helper for the merge-and-audit pattern shared by every per-field
   * settings update method. Loads (or creates) the tenant-scoped row, deep-merges
   * an optional defaults block + the existing JSONB value + the caller's partial,
   * stamps `lastModifiedBy`, persists, and emits a uniform audit log line.
   *
   * Type-safe at the call site via `K extends keyof DiscordGuildSettings`. The
   * single internal cast is required because TypeScript cannot prove that a
   * spread of indexed-access types matches the original property type, but Joi
   * validation at the route boundary guarantees the shape is correct.
   */
  private async mergeAndSaveJsonbField<K extends keyof DiscordGuildSettings>(
    organizationId: string,
    guildId: string,
    field: K,
    partial: Partial<NonNullable<DiscordGuildSettings[K]>>,
    modifiedBy: string,
    options?: {
      defaults?: Partial<NonNullable<DiscordGuildSettings[K]>>;
      logLabel?: string;
    }
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);
    const current = settings[field] as Partial<NonNullable<DiscordGuildSettings[K]>> | undefined;
    const merged = {
      ...options?.defaults,
      ...current,
      ...partial,
    } as DiscordGuildSettings[K];
    settings[field] = merged;
    settings.lastModifiedBy = modifiedBy;

    await this.settingsRepository.save(settings);

    logger.info(
      `Updated ${options?.logLabel ?? String(field)} for org:${organizationId} guild:${guildId} by:${modifiedBy}`
    );

    return settings;
  }

  /**
   * Update event settings
   */
  async updateEventSettings(
    organizationId: string,
    guildId: string,
    eventSettings: Partial<EventSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'eventSettings',
      eventSettings,
      modifiedBy,
      { logLabel: 'event settings' }
    );
  }

  /**
   * Update voice channel settings
   */
  async updateVoiceChannelSettings(
    organizationId: string,
    guildId: string,
    voiceSettings: Partial<VoiceChannelSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'voiceChannelSettings',
      voiceSettings,
      modifiedBy,
      { logLabel: 'voice channel settings' }
    );
  }

  /**
   * Update tunnel settings
   */
  async updateTunnelSettings(
    organizationId: string,
    guildId: string,
    tunnelSettings: Partial<TunnelSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'tunnelSettings',
      tunnelSettings,
      modifiedBy,
      { logLabel: 'tunnel settings' }
    );
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    organizationId: string,
    guildId: string,
    notificationPreferences: Partial<NotificationPreferences>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'notificationPreferences',
      notificationPreferences,
      modifiedBy,
      { logLabel: 'notification preferences' }
    );
  }

  /**
   * Update role sync settings
   */
  async updateRoleSyncSettings(
    organizationId: string,
    guildId: string,
    roleSyncSettings: Partial<RoleSyncSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'roleSyncSettings',
      roleSyncSettings,
      modifiedBy,
      { logLabel: 'role sync settings' }
    );
  }

  /**
   * Update cross-guild moderation settings
   */
  async updateCrossModerationSettings(
    organizationId: string,
    guildId: string,
    crossModerationSettings: Partial<CrossModerationSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'crossModerationSettings',
      crossModerationSettings,
      modifiedBy,
      {
        defaults: this.getDefaultCrossModerationSettings(),
        logLabel: 'cross moderation settings',
      }
    );
  }

  /**
   * Update ticket system settings
   */
  async updateTicketSettings(
    organizationId: string,
    guildId: string,
    ticketSettings: Partial<TicketSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'ticketSettings',
      ticketSettings,
      modifiedBy,
      { defaults: this.getDefaultTicketSettings(), logLabel: 'ticket settings' }
    );
  }

  /**
   * Update team voice settings
   */
  async updateTeamVoiceSettings(
    organizationId: string,
    guildId: string,
    teamVoiceSettings: Partial<TeamVoiceSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'teamVoiceSettings',
      teamVoiceSettings,
      modifiedBy,
      { defaults: this.getDefaultTeamVoiceSettings(), logLabel: 'team voice settings' }
    );
  }

  /**
   * Update LFG settings
   */
  async updateLfgSettings(
    organizationId: string,
    guildId: string,
    lfgSettings: {
      lfgChannelId?: string;
      lfgVoiceCategoryId?: string;
      autoPostEnabled?: boolean;
      autoLfgVoiceChannelScope?: 'all' | 'selected';
      autoLfgAllowedVoiceChannelIds?: string[];
      smartPingEnabled?: boolean;
      pingCooldownMinutes?: number;
      crossOrgEnabled?: boolean;
      crossOrgAllowList?: string[];
      crossOrgBlockList?: string[];
      crossOrgManualAllowTags?: string[];
      crossOrgManualBlockTags?: string[];
      region?: string;
      language?: string;
      roleFilterMappings?: string | Record<string, string>;
      defaultGame?: string;
      gameFilters?: string | string[];
      otherGamesChannelId?: string;
      publicLfgEnabled?: boolean;
      publicLfgDelivery?: 'dm' | 'channel';
      publicLfgChannelId?: string;
      publicLfgOptInRoleId?: string;
      publicLfgGuildAllowList?: string[];
      lfgMentionRoleId?: string;
    },
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);

    const currentSmartPing = settings.smartLfgPingSettings ?? this.getDefaultSmartLfgPingSettings();
    settings.smartLfgPingSettings = this.mergeSmartPingSettings(currentSmartPing, lfgSettings);

    const currentLfg = settings.lfgNetworkSettings ?? this.getDefaultLfgNetworkSettings();
    settings.lfgNetworkSettings = this.mergeLfgNetworkSettings(currentLfg, lfgSettings);

    // Persist game-specific LFG settings to the dedicated lfgSettings column
    const currentGameSettings = settings.lfgSettings ?? {};
    const gameSettingsUpdate = this.buildLfgGameSettingsUpdate(lfgSettings);

    if (Object.keys(gameSettingsUpdate).length > 0) {
      settings.lfgSettings = { ...currentGameSettings, ...gameSettingsUpdate };
    }

    settings.lastModifiedBy = modifiedBy;
    await this.settingsRepository.save(settings);

    logger.info(`Updated LFG settings for org:${organizationId} guild:${guildId} by:${modifiedBy}`);

    return settings;
  }

  private isSafeScopeIdentifier(value: string): boolean {
    return DiscordSettingsService.SAFE_SCOPE_ID_PATTERN.test(value);
  }

  private mergeSmartPingSettings(
    currentSmartPing: SmartLfgPingSettings,
    lfgSettings: {
      smartPingEnabled?: boolean;
      pingCooldownMinutes?: number;
    }
  ): SmartLfgPingSettings {
    return {
      ...currentSmartPing,
      enabled: lfgSettings.smartPingEnabled ?? currentSmartPing.enabled,
      cooldownHours: lfgSettings.pingCooldownMinutes
        ? lfgSettings.pingCooldownMinutes / 60
        : (currentSmartPing.cooldownHours ?? 4),
    };
  }

  private mergeLfgNetworkSettings(
    currentLfg: Record<string, unknown>,
    lfgSettings: {
      lfgChannelId?: string;
      autoPostEnabled?: boolean;
      autoLfgVoiceChannelScope?: 'all' | 'selected';
      autoLfgAllowedVoiceChannelIds?: string[];
      crossOrgEnabled?: boolean;
      crossOrgAllowList?: string[];
      crossOrgBlockList?: string[];
      crossOrgManualAllowTags?: string[];
      crossOrgManualBlockTags?: string[];
      region?: string;
      language?: string;
      roleFilterMappings?: string | Record<string, string>;
    }
  ): Record<string, unknown> {
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
        autoLfgAllowedVoiceChannelIds: lfgSettings.autoLfgAllowedVoiceChannelIds.filter(id =>
          /^\d+$/.test(id)
        ),
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

  private buildLfgGameSettingsUpdate(lfgSettings: {
    defaultGame?: string;
    gameFilters?: string | string[];
    otherGamesChannelId?: string;
    lfgVoiceCategoryId?: string;
    publicLfgEnabled?: boolean;
    publicLfgDelivery?: 'dm' | 'channel';
    publicLfgChannelId?: string;
    publicLfgOptInRoleId?: string;
    publicLfgGuildAllowList?: string[];
    lfgMentionRoleId?: string;
  }): Record<string, unknown> {
    const gameSettingsUpdate: Record<string, unknown> = {};

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
      gameSettingsUpdate.publicLfgGuildAllowList = lfgSettings.publicLfgGuildAllowList.filter(id =>
        /^\d{17,20}$/.test(id)
      );
    }
    if (lfgSettings.lfgMentionRoleId !== undefined) {
      gameSettingsUpdate.lfgMentionRoleId = lfgSettings.lfgMentionRoleId;
    }

    return gameSettingsUpdate;
  }

  /**
   * Update LFG-specific settings (game filters, public LFG, etc.)
   */
  async updateLfgGameSettings(
    organizationId: string,
    guildId: string,
    lfgGameSettings: Partial<LfgSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);

    const currentLfgSettings = settings.lfgSettings ?? {};
    settings.lfgSettings = {
      ...currentLfgSettings,
      ...lfgGameSettings,
    };

    settings.lastModifiedBy = modifiedBy;
    await this.settingsRepository.save(settings);

    logger.info(
      `Updated LFG game settings for org:${organizationId} guild:${guildId} by:${modifiedBy}`
    );

    return settings;
  }

  /**
   * Get all guild settings across all organizations
   * Used for public LFG broadcast to find servers with public LFG enabled
   */
  async getAllGuildSettings(): Promise<DiscordGuildSettings[]> {
    return this.settingsRepository.find();
  }

  /**
   * Mark guild settings as synced
   */
  async markSynced(organizationId: string, guildId: string, errorMessage?: string) {
    const settings = await this.getSettings(organizationId, guildId);
    if (!settings) {
      return;
    }

    settings.lastSyncedAt = new Date();
    if (errorMessage) {
      settings.syncErrorCount++;
      settings.lastSyncError = errorMessage;
    } else {
      settings.syncErrorCount = 0;
      settings.lastSyncError = undefined;
    }

    await this.settingsRepository.save(settings);
  }

  /**
   * Add admin user
   */
  async addAdminUser(
    organizationId: string,
    guildId: string,
    userId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);
    settings.adminUserIds ??= [];

    if (!settings.adminUserIds.includes(userId)) {
      settings.adminUserIds.push(userId);
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Remove admin user
   */
  async removeAdminUser(
    organizationId: string,
    guildId: string,
    userId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);

    if (settings.adminUserIds) {
      settings.adminUserIds = settings.adminUserIds.filter(id => id !== userId);
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Add server manager role
   */
  async addServerManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);
    settings.serverManagerRoleIds ??= [];

    if (!settings.serverManagerRoleIds.includes(roleId)) {
      settings.serverManagerRoleIds.push(roleId);
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Remove server manager role
   */
  async removeServerManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);

    if (settings.serverManagerRoleIds) {
      settings.serverManagerRoleIds = settings.serverManagerRoleIds.filter(id => id !== roleId);
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Add StarComms manager role
   */
  async addStarCommsManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);
    settings.starCommsManagerRoleIds ??= [];

    if (!settings.starCommsManagerRoleIds.includes(roleId)) {
      settings.starCommsManagerRoleIds.push(roleId);
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Remove StarComms manager role
   */
  async removeStarCommsManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(organizationId, guildId);

    if (settings.starCommsManagerRoleIds) {
      settings.starCommsManagerRoleIds = settings.starCommsManagerRoleIds.filter(
        id => id !== roleId
      );
      settings.lastModifiedBy = modifiedBy;
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  // ==================== DEFAULTS ====================

  private getDefaultEventSettings(): EventSettings {
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

  private getDefaultVoiceChannelSettings(): VoiceChannelSettings {
    return {
      autoCreateChannels: false,
      autoDeleteEmptyChannels: true,
      deleteEmptyChannelDelaySeconds: 10,
      maxActiveChannels: 50,
      userCanRename: true,
      templates: [],
    };
  }

  private getDefaultTunnelSettings(): TunnelSettings {
    return {
      enabled: false,
      maxActiveTunnels: 10,
      tunnelDurationMinutes: 60,
      autoDeleteTunnel: true,
      allowNesting: false,
    };
  }

  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      memberJoinNotifications: false,
      memberLeaveNotifications: false,
      roleChangeNotifications: false,
      eventNotifications: true,
      enableMentionRolesToNotify: false,
      notificationMentionRoles: [],
    };
  }

  private getDefaultRoleSyncSettings(): RoleSyncSettings {
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

  private getDefaultCrossModerationSettings(): CrossModerationSettings {
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

  private getDefaultTicketSettings(): TicketSettings {
    return {
      enabled: false,
      autoCloseHours: 72,
      maxOpenTicketsPerUser: 2,
      mentionSupportRoleOnCreate: true,
      notifyOnClose: true,
      allowMemberClose: true,
    };
  }

  private getDefaultTeamVoiceSettings(): TeamVoiceSettings {
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

  /**
   * Update recruitment settings
   */
  async updateRecruitmentSettings(
    organizationId: string,
    guildId: string,
    recruitmentSettings: Partial<RecruitmentSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'recruitmentSettings',
      recruitmentSettings,
      modifiedBy,
      { defaults: this.getDefaultRecruitmentSettings(), logLabel: 'recruitment settings' }
    );
  }

  private getDefaultRecruitmentSettings(): RecruitmentSettings {
    return {
      enabled: false,
      requireDiscordVerification: true,
      autoAssignRole: true,
      welcomeMessage: 'Welcome to the organization! Your application has been approved.',
      inviteFormEnabled: false,
      autoResolveOnRoleChange: true,
    };
  }

  private getDefaultLfgNetworkSettings(): Record<string, unknown> {
    return {
      lfgChannelId: '',
      autoPostEnabled: false,
      autoLfgVoiceChannelScope: 'all',
      autoLfgAllowedVoiceChannelIds: [],
      crossOrgEnabled: false,
    };
  }

  private getDefaultSmartLfgPingSettings(): SmartLfgPingSettings {
    return {
      enabled: false,
      cooldownHours: 4,
    };
  }

  private getDefaultWelcomeSettings(): WelcomeSettings {
    return {
      welcomeEnabled: false,
      goodbyeEnabled: false,
      welcomeDmEnabled: false,
    };
  }

  private getDefaultAuditLogSettings(): AuditLogSettings {
    return {
      enabled: false,
      logMessageEdits: true,
      logMessageDeletes: true,
      logRoleChanges: true,
      logChannelChanges: false,
      logMemberJoinLeave: true,
    };
  }

  /**
   * Update welcome settings
   */
  async updateWelcomeSettings(
    organizationId: string,
    guildId: string,
    welcomeSettings: Partial<WelcomeSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'welcomeSettings',
      welcomeSettings,
      modifiedBy,
      { defaults: this.getDefaultWelcomeSettings(), logLabel: 'welcome settings' }
    );
  }

  /**
   * Update audit log settings
   */
  async updateAuditLogSettings(
    organizationId: string,
    guildId: string,
    auditLogSettings: Partial<AuditLogSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'auditLogSettings',
      auditLogSettings,
      modifiedBy,
      { defaults: this.getDefaultAuditLogSettings(), logLabel: 'audit log settings' }
    );
  }

  /**
   * Update stat tracking settings
   */
  async updateStatSettings(
    organizationId: string,
    guildId: string,
    statSettings: Partial<StatSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'statSettings',
      statSettings,
      modifiedBy,
      { logLabel: 'stat settings' }
    );
  }

  /**
   * Update DM notification settings
   */
  async updateDmNotificationSettings(
    organizationId: string,
    guildId: string,
    dmNotificationSettings: Partial<DmNotificationSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'dmNotificationSettings',
      dmNotificationSettings,
      modifiedBy,
      { logLabel: 'DM notification settings' }
    );
  }

  /**
   * Update smart LFG ping settings
   */
  async updateSmartLfgPingSettings(
    organizationId: string,
    guildId: string,
    smartLfgPingSettings: Partial<SmartLfgPingSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'smartLfgPingSettings',
      smartLfgPingSettings,
      modifiedBy,
      { logLabel: 'smart LFG ping settings' }
    );
  }

  /**
   * Update giveaway settings
   */
  async updateGiveawaySettings(
    organizationId: string,
    guildId: string,
    giveawaySettings: Partial<GiveawaySettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'giveawaySettings',
      giveawaySettings,
      modifiedBy,
      { logLabel: 'giveaway settings' }
    );
  }

  /**
   * Update advanced event settings
   */
  async updateAdvancedEventSettings(
    organizationId: string,
    guildId: string,
    advancedEventSettings: Partial<AdvancedEventSettings>,
    modifiedBy: string
  ): Promise<DiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      organizationId,
      guildId,
      'advancedEventSettings',
      advancedEventSettings,
      modifiedBy,
      { logLabel: 'advanced event settings' }
    );
  }
}

// Export singleton instance
export const discordSettingsService = new DiscordSettingsService();
