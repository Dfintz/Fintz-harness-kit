import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import type {
  AdvancedEventSettings,
  AuditLogSettings,
  CrossModerationSettings,
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
import { FederationDiscordGuildSettings } from '../../models/FederationDiscordGuildSettings';
import { logger } from '../../utils/logger';

/**
 * Federation Discord Settings Service
 *
 * Manages federation-scoped Discord guild settings. Mirrors the CRUD
 * patterns of DiscordSettingsService but uses federationId as the
 * tenant scope.
 *
 * Permission enforcement is handled at the controller layer via
 * requireFederationPermission('settings').
 */
export class FederationDiscordSettingsService {
  private static instance: FederationDiscordSettingsService;
  private readonly repo: Repository<FederationDiscordGuildSettings>;

  private constructor() {
    this.repo = AppDataSource.getRepository(FederationDiscordGuildSettings);
  }

  static getInstance(): FederationDiscordSettingsService {
    if (!FederationDiscordSettingsService.instance) {
      FederationDiscordSettingsService.instance = new FederationDiscordSettingsService();
    }
    return FederationDiscordSettingsService.instance;
  }

  // ==================== READ / WRITE ====================

  /**
   * Get or create settings for a federation's Discord guild
   */
  async getOrCreateSettings(
    federationId: string,
    guildId: string,
    guildName?: string,
    guildIconUrl?: string
  ): Promise<FederationDiscordGuildSettings> {
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
      logger.info(
        `Created federation Discord guild settings for fed:${federationId} guild:${guildId}`
      );
    }

    return settings;
  }

  /**
   * Get settings for a specific federation + guild pair
   */
  async getSettings(
    federationId: string,
    guildId: string
  ): Promise<FederationDiscordGuildSettings | null> {
    return this.repo.findOne({ where: { federationId, guildId } });
  }

  /**
   * Get all guild settings for a federation
   */
  async getAllForFederation(federationId: string): Promise<FederationDiscordGuildSettings[]> {
    return this.repo.find({
      where: { federationId },
      order: { guildName: 'ASC' },
    });
  }

  /**
   * Get all federation settings for a Discord guild (bot handler lookups)
   */
  async getSettingsByGuildId(guildId: string): Promise<FederationDiscordGuildSettings[]> {
    return this.repo.find({ where: { guildId } });
  }

  /**
   * Save a settings entity
   */
  async saveSettings(
    settings: FederationDiscordGuildSettings
  ): Promise<FederationDiscordGuildSettings> {
    return this.repo.save(settings);
  }

  /**
   * Delete settings (used when a federation unlinks its guild)
   */
  async deleteSettings(federationId: string, guildId: string): Promise<void> {
    await this.repo.delete({ federationId, guildId });
    logger.info(
      `Deleted federation Discord guild settings for fed:${federationId} guild:${guildId}`
    );
  }

  // ==================== PER-SECTION UPDATES ====================

  /**
   * Generic merge-and-save helper. Loads (or creates) the row, deep-merges
   * the existing JSONB value with the caller's partial, stamps lastModifiedBy,
   * and persists.
   */
  private async mergeAndSaveJsonbField<K extends keyof FederationDiscordGuildSettings>(
    federationId: string,
    guildId: string,
    field: K,
    partial: Partial<NonNullable<FederationDiscordGuildSettings[K]>>,
    modifiedBy: string,
    options?: {
      defaults?: Partial<NonNullable<FederationDiscordGuildSettings[K]>>;
      logLabel?: string;
    }
  ): Promise<FederationDiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(federationId, guildId);
    const current = settings[field] as
      Partial<NonNullable<FederationDiscordGuildSettings[K]>> | undefined;
    const merged = {
      ...options?.defaults,
      ...current,
      ...partial,
    } as FederationDiscordGuildSettings[K];
    settings[field] = merged;
    settings.lastModifiedBy = modifiedBy;

    await this.repo.save(settings);

    logger.info(
      `Updated ${options?.logLabel ?? String(field)} for fed:${federationId} guild:${guildId} by:${modifiedBy}`
    );

    return settings;
  }

  async updateEventSettings(
    federationId: string,
    guildId: string,
    eventSettings: Partial<EventSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'eventSettings',
      eventSettings,
      modifiedBy,
      {
        logLabel: 'event settings',
      }
    );
  }

  async updateVoiceChannelSettings(
    federationId: string,
    guildId: string,
    voiceSettings: Partial<VoiceChannelSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'voiceChannelSettings',
      voiceSettings,
      modifiedBy,
      { logLabel: 'voice channel settings' }
    );
  }

  async updateTunnelSettings(
    federationId: string,
    guildId: string,
    tunnelSettings: Partial<TunnelSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'tunnelSettings',
      tunnelSettings,
      modifiedBy,
      { logLabel: 'tunnel settings' }
    );
  }

  async updateNotificationPreferences(
    federationId: string,
    guildId: string,
    notificationPreferences: Partial<NotificationPreferences>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'notificationPreferences',
      notificationPreferences,
      modifiedBy,
      { logLabel: 'notification preferences' }
    );
  }

  async updateRoleSyncSettings(
    federationId: string,
    guildId: string,
    roleSyncSettings: Partial<RoleSyncSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'roleSyncSettings',
      roleSyncSettings,
      modifiedBy,
      { logLabel: 'role sync settings' }
    );
  }

  async updateCrossModerationSettings(
    federationId: string,
    guildId: string,
    crossModerationSettings: Partial<CrossModerationSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'crossModerationSettings',
      crossModerationSettings,
      modifiedBy,
      { logLabel: 'cross moderation settings' }
    );
  }

  async updateTicketSettings(
    federationId: string,
    guildId: string,
    ticketSettings: Partial<TicketSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'ticketSettings',
      ticketSettings,
      modifiedBy,
      { logLabel: 'ticket settings' }
    );
  }

  async updateTeamVoiceSettings(
    federationId: string,
    guildId: string,
    teamVoiceSettings: Partial<TeamVoiceSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'teamVoiceSettings',
      teamVoiceSettings,
      modifiedBy,
      { logLabel: 'team voice settings' }
    );
  }

  async updateLfgSettings(
    federationId: string,
    guildId: string,
    lfgSettings: Partial<LfgSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'lfgSettings',
      lfgSettings,
      modifiedBy,
      { logLabel: 'LFG settings' }
    );
  }

  async updateRecruitmentSettings(
    federationId: string,
    guildId: string,
    recruitmentSettings: Partial<RecruitmentSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'recruitmentSettings',
      recruitmentSettings,
      modifiedBy,
      { logLabel: 'recruitment settings' }
    );
  }

  async updateWelcomeSettings(
    federationId: string,
    guildId: string,
    welcomeSettings: Partial<WelcomeSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'welcomeSettings',
      welcomeSettings,
      modifiedBy,
      { logLabel: 'welcome settings' }
    );
  }

  async updateAuditLogSettings(
    federationId: string,
    guildId: string,
    auditLogSettings: Partial<AuditLogSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'auditLogSettings',
      auditLogSettings,
      modifiedBy,
      { logLabel: 'audit log settings' }
    );
  }

  async updateStatSettings(
    federationId: string,
    guildId: string,
    statSettings: Partial<StatSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'statSettings',
      statSettings,
      modifiedBy,
      { logLabel: 'stat settings' }
    );
  }

  async updateDmNotificationSettings(
    federationId: string,
    guildId: string,
    dmNotificationSettings: Partial<DmNotificationSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'dmNotificationSettings',
      dmNotificationSettings,
      modifiedBy,
      { logLabel: 'DM notification settings' }
    );
  }

  async updateSmartLfgPingSettings(
    federationId: string,
    guildId: string,
    smartLfgPingSettings: Partial<SmartLfgPingSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'smartLfgPingSettings',
      smartLfgPingSettings,
      modifiedBy,
      { logLabel: 'smart LFG ping settings' }
    );
  }

  async updateGiveawaySettings(
    federationId: string,
    guildId: string,
    giveawaySettings: Partial<GiveawaySettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'giveawaySettings',
      giveawaySettings,
      modifiedBy,
      { logLabel: 'giveaway settings' }
    );
  }

  async updateAdvancedEventSettings(
    federationId: string,
    guildId: string,
    advancedEventSettings: Partial<AdvancedEventSettings>,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    return this.mergeAndSaveJsonbField(
      federationId,
      guildId,
      'advancedEventSettings',
      advancedEventSettings,
      modifiedBy,
      { logLabel: 'advanced event settings' }
    );
  }

  async addStarCommsManagerRole(
    federationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
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

  async removeStarCommsManagerRole(
    federationId: string,
    guildId: string,
    roleId: string,
    modifiedBy: string
  ): Promise<FederationDiscordGuildSettings> {
    const settings = await this.getOrCreateSettings(federationId, guildId);

    if (settings.starCommsManagerRoleIds) {
      settings.starCommsManagerRoleIds = settings.starCommsManagerRoleIds.filter(
        id => id !== roleId
      );
      settings.lastModifiedBy = modifiedBy;
      await this.repo.save(settings);
    }

    return settings;
  }
}

export const federationDiscordSettingsService = FederationDiscordSettingsService.getInstance();
