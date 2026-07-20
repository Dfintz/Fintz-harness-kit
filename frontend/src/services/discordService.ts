import { apiClient } from './apiClient';
import { BaseService } from './baseService';

/**
 * Tunnel configuration types
 */
export interface TunnelRateLimitConfig {
  maxMessages: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface TunnelConnection {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
  webhookUrl?: string;
  webhookId?: string;
  connectedAt: Date;
}

export interface Tunnel {
  id: string;
  name: string;
  inviteCode: string;
  creatorGuildId: string;
  creatorChannelId: string;
  isPublic: boolean;
  password?: string;
  createdAt: Date;
  connectedChannels: TunnelConnection[];
  rateLimitConfig?: TunnelRateLimitConfig;
  contentFilterEnabled: boolean;
  allowBotMessages: boolean;
  maxConnectedServers: number;
}

/**
 * Voice channel configuration types
 */
export interface VoiceChannelConfig {
  guildId: string;
  categoryId?: string;
  creatorChannelId?: string;
  hubChannelId?: string;
  hubChannelIds?: string[];
  autoCreateChannels: boolean;
  autoDeleteEmpty: boolean;
  deleteEmptyChannelDelaySeconds?: number;
  defaultUserLimit?: number;
  nameTemplate: string;
  bitrate?: number;
  allowRename: boolean;
  allowUserLimit: boolean;
}

export interface VoiceChannelTemplate {
  id: string;
  name: string;
  description?: string;
  userLimit?: number;
  bitrate?: number;
  nameTemplate: string;
  autoDelete: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface VoiceChannel {
  id: string;
  name: string;
  guildId: string;
  channelId: string;
  type: string;
  creatorId: string;
  eventId?: string;
  createdAt: Date;
  expiresAt?: Date;
  userLimit?: number;
  isTemporary: boolean;
}

// NOTE: DiscordGuild type is defined in hooks/queries/useOrgSettingsQueries.ts
// (matches the backend GET /api/v2/organizations/:id/discord/guilds response shape)

/**
 * Team voice settings for Discord integration
 */
export interface TeamVoiceSettings {
  enabled: boolean;
  allowBaseVisibility?: boolean;
  allowListenIn?: boolean;
  enforcePushToTalk?: boolean;
  enablePrioritySpeaker?: boolean;
  autoCreateOnTeamCreate?: boolean;
  autoDeleteOnTeamDelete?: boolean;
  parentCategoryId?: string;
  baseAccessRoleId?: string;
}

/**
 * Organization Discord settings
 */
export interface DiscordSettings {
  organizationId: string;
  guildId?: string;
  guildName?: string;
  voiceConfig?: VoiceChannelConfig;
  tunnels: Tunnel[];
  voiceChannels: VoiceChannel[];
  voiceTemplates: VoiceChannelTemplate[];
}

/**
 * Ticketing settings payload for the Discord ticketing system
 */
export interface TicketSettingsPayload {
  enabled: boolean;
  defaultCategoryId?: string;
  transcriptChannelId?: string;
  supportRoleId?: string;
  escalationRoleId?: string;
  formChannelId?: string;
  autoCloseHours?: number;
  maxOpenTicketsPerUser?: number;
  mentionSupportRoleOnCreate?: boolean;
  notifyOnClose?: boolean;
  allowMemberClose?: boolean;
  blockedRoleIds?: string[];
  requiredRoleIds?: string[];
  roleMatchMode?: 'any' | 'all';
  rateSupportEnabled?: boolean;
  channelNameTemplate?: string;
  quickResponseCategories?: { id: string; name: string }[];
  quickResponses?: { id: string; name: string; content: string; categoryId?: string }[];
}

/**
 * LFG settings payload
 */
export interface LfgSettingsPayload {
  lfgChannelId?: string;
  autoPostEnabled?: boolean;
  /** Auto-LFG voice-channel scope: all channels or selected channels only */
  autoLfgVoiceChannelScope?: 'all' | 'selected';
  /** Voice channel IDs allowed when scope is set to 'selected' */
  autoLfgAllowedVoiceChannelIds?: string[];
  smartPingEnabled?: boolean;
  pingCooldownMinutes?: number;
  crossOrgEnabled?: boolean;
  /** Organization IDs allowed for cross-org LFG; empty = all allied orgs */
  crossOrgAllowList?: string[];
  /** Organization IDs explicitly blocked from cross-org LFG */
  crossOrgBlockList?: string[];
  /** RSI tags manually whitelisted for cross-org LFG (e.g., 'FRINAUTS') */
  crossOrgManualAllowTags?: string[];
  /** RSI tags manually blocked from cross-org LFG (e.g., 'BADORG') */
  crossOrgManualBlockTags?: string[];
  region?: string;
  language?: string;
  roleFilterMappings?: string;
  /** Default game for LFG posts (default: Star Citizen) */
  defaultGame?: string;
  /** Comma-separated list of allowed games (empty = Star Citizen only) */
  gameFilters?: string;
  /** Channel for non-default-game LFG posts */
  otherGamesChannelId?: string;
  /** Enable public LFG across servers */
  publicLfgEnabled?: boolean;
  /** How public LFG posts are delivered: dm or channel */
  publicLfgDelivery?: 'dm' | 'channel';
  /** Channel for incoming public LFG posts */
  publicLfgChannelId?: string;
  /** Role required to receive public LFG DMs */
  publicLfgOptInRoleId?: string;
  /** Guild IDs allowed to receive LFG broadcasts; empty = all connected guilds */
  publicLfgGuildAllowList?: string[];
  /** Role to @mention in the LFG channel when a new LFG post is created */
  lfgMentionRoleId?: string;
}

export interface UserDiscordPreferences {
  dmEnabled: boolean;
  lfgPingOptIn: boolean;
  eventReminderOptIn: boolean;
  ticketDmOptIn: boolean;
  recruitmentDmOptIn: boolean;
  moderationAlertOptIn: boolean;
  timezone?: string;
}

/**
 * Guild settings DTO — typed shape matching backend DiscordGuildSettings.toDTO().
 * Replaces `Record<string, unknown>` for compile-time safety.
 */
export interface GuildSettingsDTO {
  id?: string;
  organizationId?: string;
  guildId?: string;
  guildName?: string;
  guildIconUrl?: string;
  eventSettings?: Record<string, unknown>;
  voiceChannelSettings?: Record<string, unknown>;
  tunnelSettings?: Record<string, unknown>;
  notificationPreferences?: Record<string, unknown>;
  roleSyncSettings?: Record<string, unknown>;
  crossModerationSettings?: Record<string, unknown>;
  ticketSettings?: TicketSettingsPayload;
  statSettings?: Record<string, unknown>;
  dmNotificationSettings?: Record<string, unknown>;
  smartLfgPingSettings?: Record<string, unknown>;
  recruitmentSettings?: RecruitmentSettingsPayload;
  giveawaySettings?: Record<string, unknown>;
  advancedEventSettings?: Record<string, unknown>;
  teamVoiceSettings?: TeamVoiceSettings;
  roleGatingSettings?: Record<string, unknown>;
  lfgNetworkSettings?: Record<string, unknown>;
  lfgSettings?: Record<string, unknown>;
  welcomeSettings?: Record<string, unknown>;
  auditLogSettings?: Record<string, unknown>;
  timezone?: string;
  settingsEnabled?: boolean;
  adminUserIds?: string[];
  serverManagerRoleIds?: string[];
  assistantRoleIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
}

export type RsiStatusRole = 'application' | 'server';

export interface RsiStatusChannelConfig {
  channelId: string;
  managed: boolean;
  baseName: string;
  channelName: string | null;
  channelType: 'text' | 'voice' | 'other';
}

export interface RsiStatusPanelConfig {
  channelId: string;
  messageId: string;
  messageUrl: string;
}

export interface RsiStatusSnapshotView {
  overallStatus: string;
  fetchedAt: string;
  components: Array<{
    name: string;
    status: string;
    emoji: string;
  }>;
}

export interface RsiStatusConfiguration {
  panel: RsiStatusPanelConfig | null;
  channels: {
    application: RsiStatusChannelConfig | null;
    server: RsiStatusChannelConfig | null;
  };
  latestSnapshot: RsiStatusSnapshotView;
}

/**
 * Discord Service
 * Handles Discord settings, tunnel management, and voice channel configuration.
 *
 * Tunnel (Jump Point) CRUD operations call the real /api/v2/jumppoints backend.
 * Voice channel settings are persisted via the guild settings API.
 */
class DiscordService extends BaseService {
  protected basePath = '/api/v2/discord';

  private readonly jumpPointsPath = '/api/v2/jumppoints';

  private readonly settingsBasePath = '/api/orgs';

  /**
   * Build the settings path for a specific guild under an organization.
   */
  private guildSettingsPath(organizationId: string, guildId: string): string {
    return `${this.settingsBasePath}/${organizationId}/discord/settings/${guildId}`;
  }

  /**
   * Get Discord settings for an organization.
   * Fetches real tunnels from Jump Points API and merges with stub voice data.
   */
  /**
   * Get all roles for a Discord guild (for dropdown population)
   */
  async getGuildRoles(guildId: string): Promise<{ id: string; name: string }[]> {
    try {
      this.log('getGuildRoles', { guildId });
      const response = await apiClient.get<{
        data: { roles: { id: string; name: string }[] };
      }>(`/api/v2/discord/guilds/${guildId}/roles`);
      const envelope = response.data as Record<string, unknown>;
      const data = envelope?.data as Record<string, unknown>;
      return (data?.roles as { id: string; name: string }[]) ?? [];
    } catch (error) {
      return this.handleError(error, 'getGuildRoles');
    }
  }

  /**
   * Get all channels for a Discord guild (for dropdown population)
   */
  async getGuildChannels(
    guildId: string
  ): Promise<{ id: string; name: string; type: number; parentId?: string }[]> {
    try {
      this.log('getGuildChannels', { guildId });
      const response = await apiClient.get<{
        data: { channels: { id: string; name: string; type: number; parentId?: string }[] };
      }>(`/api/v2/discord/guilds/${guildId}/channels`);
      const envelope = response.data as Record<string, unknown>;
      const data = envelope?.data as Record<string, unknown>;
      return (
        (data?.channels as {
          id: string;
          name: string;
          type: number;
          parentId?: string;
        }[]) ?? []
      );
    } catch (error) {
      return this.handleError(error, 'getGuildChannels');
    }
  }

  async getSettings(organizationId: string, guildId?: string): Promise<DiscordSettings> {
    try {
      this.log('getSettings', { organizationId, guildId });

      // Fetch tunnels from the Jump Points API, scoped to guild when available
      const params = guildId ? { guildId } : undefined;
      const response = await apiClient.get<Tunnel[]>(this.jumpPointsPath, { params });
      const tunnels = response.data ?? [];

      return {
        organizationId,
        tunnels,
        voiceChannels: [],
        voiceTemplates: [],
      };
    } catch (error) {
      return this.handleError(error, 'getSettings');
    }
  }

  /**
   * Update voice channel configuration
   */
  async updateVoiceConfig(
    organizationId: string,
    guildId: string,
    config: Partial<VoiceChannelConfig>
  ): Promise<VoiceChannelConfig> {
    try {
      this.log('updateVoiceConfig', { organizationId, guildId, config });

      const response = await apiClient.patch<{ voiceChannelSettings: VoiceChannelConfig }>(
        `${this.guildSettingsPath(organizationId, guildId)}/voice-channels`,
        {
          channelNameTemplate: config.nameTemplate || undefined,
          hubChannelId: config.hubChannelIds?.length
            ? config.hubChannelIds[0]
            : config.hubChannelId || null,
          hubChannelIds: config.hubChannelIds?.length ? config.hubChannelIds : undefined,
          autoCreateChannels: config.autoCreateChannels,
          autoDeleteEmptyChannels: config.autoDeleteEmpty,
          deleteEmptyChannelDelaySeconds: config.deleteEmptyChannelDelaySeconds,
          userCanRename: config.allowRename,
          defaultUserLimit: config.defaultUserLimit,
          bitrate: config.bitrate,
          allowUserLimit: config.allowUserLimit,
          parentCategoryId: config.categoryId || null,
        }
      );

      return response.data?.voiceChannelSettings ?? (config as VoiceChannelConfig);
    } catch (error) {
      return this.handleError(error, 'updateVoiceConfig');
    }
  }

  /**
   * Create a new tunnel (jump point)
   */
  async createTunnel(
    organizationId: string,
    tunnelData: {
      name: string;
      guildId: string;
      channelId: string;
      isPublic?: boolean;
      password?: string;
      contentFilterEnabled?: boolean;
    }
  ): Promise<Tunnel> {
    try {
      this.log('createTunnel', { organizationId, tunnelData });
      const response = await apiClient.post<Tunnel>(this.jumpPointsPath, tunnelData);
      return response.data;
    } catch (error) {
      return this.handleError(error, 'createTunnel');
    }
  }

  /**
   * Update tunnel settings
   */
  async updateTunnel(tunnelId: string, updates: Partial<Tunnel>): Promise<Tunnel> {
    try {
      this.log('updateTunnel', { tunnelId, updates });
      const response = await apiClient.put<Tunnel>(`${this.jumpPointsPath}/${tunnelId}`, updates);
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateTunnel');
    }
  }

  /**
   * Regenerate the invite code for a tunnel
   */
  async regenerateInviteCode(tunnelId: string): Promise<string> {
    try {
      this.log('regenerateInviteCode', { tunnelId });
      const response = await apiClient.post<{ inviteCode: string }>(
        `${this.jumpPointsPath}/${tunnelId}/regenerate-code`
      );
      return response.data.inviteCode;
    } catch (error) {
      return this.handleError(error, 'regenerateInviteCode');
    }
  }

  /**
   * Delete a tunnel
   */
  async deleteTunnel(tunnelId: string, guildId: string): Promise<boolean> {
    try {
      this.log('deleteTunnel', { tunnelId, guildId });
      await apiClient.delete(`${this.jumpPointsPath}/${tunnelId}`, { data: { guildId } });
      return true;
    } catch (error) {
      return this.handleError(error, 'deleteTunnel');
    }
  }

  /**
   * Create a voice channel template
   */
  async createVoiceTemplate(
    organizationId: string,
    template: Omit<VoiceChannelTemplate, 'id' | 'createdAt' | 'createdBy'>,
    guildId?: string
  ): Promise<VoiceChannelTemplate> {
    try {
      this.log('createVoiceTemplate', { organizationId, template });
      const resolvedGuildId = guildId || organizationId;
      const response = await apiClient.post<VoiceChannelTemplate>(
        `${this.guildSettingsPath(organizationId, resolvedGuildId)}/voice-templates`,
        template
      );
      return response.data ?? ({} as VoiceChannelTemplate);
    } catch (error) {
      return this.handleError(error, 'createVoiceTemplate');
    }
  }

  /**
   * Delete a voice channel template
   */
  async deleteVoiceTemplate(
    organizationId: string,
    guildId: string,
    templateId: string
  ): Promise<boolean> {
    try {
      this.log('deleteVoiceTemplate', { organizationId, guildId, templateId });
      await apiClient.delete(
        `${this.guildSettingsPath(organizationId, guildId)}/voice-templates/${templateId}`
      );
      return true;
    } catch (error) {
      return this.handleError(error, 'deleteVoiceTemplate');
    }
  }

  /**
   * Update team voice settings for an organization's guild
   */
  async updateTeamVoiceSettings(
    organizationId: string,
    guildId: string,
    settings: Partial<TeamVoiceSettings>
  ): Promise<TeamVoiceSettings> {
    try {
      this.log('updateTeamVoiceSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch<{ teamVoiceSettings: TeamVoiceSettings }>(
        `${this.guildSettingsPath(organizationId, guildId)}/team-voice`,
        settings
      );
      return response.data?.teamVoiceSettings ?? (settings as TeamVoiceSettings);
    } catch (error) {
      return this.handleError(error, 'updateTeamVoiceSettings');
    }
  }

  /**
   * Update recruitment settings for a guild
   */
  async updateRecruitmentSettings(
    organizationId: string,
    guildId: string,
    settings: Partial<RecruitmentSettingsPayload>
  ): Promise<unknown> {
    try {
      this.log('updateRecruitmentSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/recruitment`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateRecruitmentSettings');
    }
  }

  /**
   * Update ticket settings for a guild
   */
  async updateTicketSettings(
    organizationId: string,
    guildId: string,
    settings: Partial<TicketSettingsPayload>
  ): Promise<unknown> {
    try {
      this.log('updateTicketSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/tickets`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateTicketSettings');
    }
  }

  /**
   * Update LFG settings for a guild
   */
  async updateLfgSettings(
    organizationId: string,
    guildId: string,
    settings: Partial<LfgSettingsPayload>
  ): Promise<unknown> {
    try {
      this.log('updateLfgSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/lfg`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateLfgSettings');
    }
  }

  /**
   * Update event settings for a guild
   */
  async updateEventSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateEventSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/events`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateEventSettings');
    }
  }

  /**
   * Update notification preferences for a guild
   */
  async updateNotificationPreferences(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateNotificationPreferences', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/notifications`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateNotificationPreferences');
    }
  }

  /**
   * Update role sync settings for a guild
   */
  async updateRoleSyncSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateRoleSyncSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/role-sync`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateRoleSyncSettings');
    }
  }

  /**
   * Update cross-moderation settings for a guild
   */
  async updateCrossModerationSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateCrossModerationSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/cross-moderation`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateCrossModerationSettings');
    }
  }

  /**
   * Update stat tracking settings for a guild
   */
  async updateStatSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateStatSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/stat-settings`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateStatSettings');
    }
  }

  /**
   * Update DM notification settings for a guild
   */
  async updateDmNotificationSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateDmNotificationSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/dm-notification-settings`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateDmNotificationSettings');
    }
  }

  /**
   * Update giveaway settings for a guild
   */
  async updateGiveawaySettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateGiveawaySettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/giveaway-settings`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateGiveawaySettings');
    }
  }

  /**
   * Update advanced event settings for a guild
   */
  async updateAdvancedEventSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateAdvancedEventSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/advanced-event-settings`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateAdvancedEventSettings');
    }
  }

  /**
   * Update server-wide timezone
   */
  async updateTimezone(
    organizationId: string,
    guildId: string,
    timezone: string
  ): Promise<unknown> {
    try {
      this.log('updateTimezone', { organizationId, guildId, timezone });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/timezone`,
        { timezone }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateTimezone');
    }
  }

  /**
   * Export recruitment applications as CSV (triggers download)
   */
  async exportApplicationsCsv(organizationId: string): Promise<void> {
    try {
      this.log('exportApplicationsCsv', { organizationId });
      const response = await apiClient.get(
        `${this.settingsBasePath}/${organizationId}/recruitment/export/csv`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications-${organizationId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.handleError(error, 'exportApplicationsCsv');
    }
  }

  /**
   * Create a ticket quick response
   */
  async createQuickResponse(
    organizationId: string,
    guildId: string,
    data: { name: string; content: string; categoryId?: string }
  ): Promise<unknown> {
    try {
      this.log('createQuickResponse', data);
      const response = await apiClient.post(
        `${this.guildSettingsPath(organizationId, guildId)}/quick-responses`,
        data
      );
      return (response.data as Record<string, unknown>)?.data;
    } catch (error) {
      return this.handleError(error, 'createQuickResponse');
    }
  }

  /**
   * Delete a ticket quick response
   */
  async deleteQuickResponse(
    organizationId: string,
    guildId: string,
    responseId: string
  ): Promise<boolean> {
    try {
      this.log('deleteQuickResponse', { responseId });
      await apiClient.delete(
        `${this.guildSettingsPath(organizationId, guildId)}/quick-responses/${responseId}`
      );
      return true;
    } catch (error) {
      return this.handleError(error, 'deleteQuickResponse');
    }
  }

  /**
   * Create a quick response category
   */
  async createQuickResponseCategory(
    organizationId: string,
    guildId: string,
    name: string
  ): Promise<unknown> {
    try {
      this.log('createQuickResponseCategory', { name });
      const response = await apiClient.post(
        `${this.guildSettingsPath(organizationId, guildId)}/quick-response-categories`,
        { name }
      );
      return (response.data as Record<string, unknown>)?.data;
    } catch (error) {
      return this.handleError(error, 'createQuickResponseCategory');
    }
  }

  /**
   * Delete a quick response category
   */
  async deleteQuickResponseCategory(
    organizationId: string,
    guildId: string,
    categoryId: string
  ): Promise<boolean> {
    try {
      this.log('deleteQuickResponseCategory', { categoryId });
      await apiClient.delete(
        `${this.guildSettingsPath(organizationId, guildId)}/quick-response-categories/${categoryId}`
      );
      return true;
    } catch (error) {
      return this.handleError(error, 'deleteQuickResponseCategory');
    }
  }

  /**
   * Update welcome settings for a guild
   */
  async updateWelcomeSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateWelcomeSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/welcome`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateWelcomeSettings');
    }
  }

  /**
   * Update audit log settings for a guild
   */
  async updateAuditLogSettings(
    organizationId: string,
    guildId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> {
    try {
      this.log('updateAuditLogSettings', { organizationId, guildId, settings });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/audit-log`,
        settings
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateAuditLogSettings');
    }
  }

  /**
   * Get the current user's notification preferences for a guild
   */
  async getUserPreferences(
    organizationId: string,
    guildId: string
  ): Promise<UserDiscordPreferences> {
    try {
      this.log('getUserPreferences', { organizationId, guildId });
      const response = await apiClient.get<UserDiscordPreferences>(
        `${this.settingsBasePath}/${organizationId}/discord/user-preferences/${guildId}`
      );
      return (
        response.data ?? {
          dmEnabled: true,
          lfgPingOptIn: true,
          eventReminderOptIn: true,
          ticketDmOptIn: true,
          recruitmentDmOptIn: true,
          moderationAlertOptIn: true,
        }
      );
    } catch (error) {
      return this.handleError(error, 'getUserPreferences');
    }
  }

  /**
   * Update the current user's notification preferences for a guild
   */
  async updateUserPreferences(
    organizationId: string,
    guildId: string,
    updates: Partial<UserDiscordPreferences>
  ): Promise<UserDiscordPreferences> {
    try {
      this.log('updateUserPreferences', { organizationId, guildId, updates });
      const response = await apiClient.patch<UserDiscordPreferences>(
        `${this.settingsBasePath}/${organizationId}/discord/user-preferences/${guildId}`,
        updates
      );
      return response.data ?? (updates as UserDiscordPreferences);
    } catch (error) {
      return this.handleError(error, 'updateUserPreferences');
    }
  }

  /**
   * Get full guild settings (reads settings for all tabs)
   */
  async getGuildSettings(organizationId: string, guildId: string): Promise<GuildSettingsDTO> {
    try {
      this.log('getGuildSettings', { organizationId, guildId });
      const response = await apiClient.get<GuildSettingsDTO>(
        `${this.settingsBasePath}/${organizationId}/discord/settings/${guildId}`
      );
      return response.data ?? {};
    } catch (error) {
      return this.handleError(error, 'getGuildSettings');
    }
  }

  /**
   * Get RSI status panel/channel configuration for a guild.
   */
  async getRsiStatusConfiguration(
    organizationId: string,
    guildId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('getRsiStatusConfiguration', { organizationId, guildId });
      const response = await apiClient.get<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getRsiStatusConfiguration');
    }
  }

  /**
   * Deploy or replace the RSI status panel in a text channel.
   */
  async deployRsiStatusPanel(
    organizationId: string,
    guildId: string,
    channelId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('deployRsiStatusPanel', { organizationId, guildId, channelId });
      const response = await apiClient.post<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status/panel/deploy`,
        { channelId }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'deployRsiStatusPanel');
    }
  }

  /**
   * Remove the RSI status panel for a guild.
   */
  async removeRsiStatusPanel(
    organizationId: string,
    guildId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('removeRsiStatusPanel', { organizationId, guildId });
      const response = await apiClient.delete<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status/panel`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'removeRsiStatusPanel');
    }
  }

  /**
   * Create bot-managed voice channels for RSI Application/Server status.
   */
  async createManagedRsiStatusChannels(
    organizationId: string,
    guildId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('createManagedRsiStatusChannels', { organizationId, guildId });
      const response = await apiClient.post<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status/channels/managed`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'createManagedRsiStatusChannels');
    }
  }

  /**
   * Assign an existing channel (text or voice) to one RSI status role.
   */
  async assignRsiStatusChannel(
    organizationId: string,
    guildId: string,
    role: RsiStatusRole,
    channelId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('assignRsiStatusChannel', { organizationId, guildId, role, channelId });
      const response = await apiClient.patch<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status/channels/${role}`,
        { channelId }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'assignRsiStatusChannel');
    }
  }

  /**
   * Remove all RSI status channel mappings for a guild.
   */
  async removeRsiStatusChannels(
    organizationId: string,
    guildId: string
  ): Promise<RsiStatusConfiguration> {
    try {
      this.log('removeRsiStatusChannels', { organizationId, guildId });
      const response = await apiClient.delete<RsiStatusConfiguration>(
        `${this.guildSettingsPath(organizationId, guildId)}/rsi-status/channels`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'removeRsiStatusChannels');
    }
  }

  /**
   * Update assistant role IDs for a guild
   */
  async updateAssistantRoles(
    organizationId: string,
    guildId: string,
    assistantRoleIds: string[]
  ): Promise<unknown> {
    try {
      this.log('updateAssistantRoles', { organizationId, guildId, assistantRoleIds });
      const response = await apiClient.patch(
        `${this.guildSettingsPath(organizationId, guildId)}/assistant-roles`,
        { assistantRoleIds }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateAssistantRoles');
    }
  }

  async addAdminUser(organizationId: string, guildId: string, userId: string): Promise<unknown> {
    try {
      const response = await apiClient.post(
        `${this.guildSettingsPath(organizationId, guildId)}/admins`,
        { userId }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'addAdminUser');
    }
  }

  async removeAdminUser(organizationId: string, guildId: string, userId: string): Promise<unknown> {
    try {
      const response = await apiClient.delete(
        `${this.guildSettingsPath(organizationId, guildId)}/admins/${userId}`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'removeAdminUser');
    }
  }

  async addServerManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string
  ): Promise<unknown> {
    try {
      const response = await apiClient.post(
        `${this.guildSettingsPath(organizationId, guildId)}/server-managers`,
        { roleId }
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'addServerManagerRole');
    }
  }

  async removeServerManagerRole(
    organizationId: string,
    guildId: string,
    roleId: string
  ): Promise<unknown> {
    try {
      const response = await apiClient.delete(
        `${this.guildSettingsPath(organizationId, guildId)}/server-managers/${roleId}`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'removeServerManagerRole');
    }
  }
}

export interface RecruitmentSettingsPayload {
  enabled: boolean;
  applicationChannelId?: string;
  acceptRoleId?: string;
  denyRoleId?: string;
  pendingRoleId?: string;
  requireDiscordVerification?: boolean;
  autoAssignRole?: boolean;
  welcomeMessage?: string;
  deniedMessage?: string;
  confirmationMessage?: string;
  completionMessage?: string;
  inviteFormEnabled?: boolean;
  inviteFormBindingCode?: string;
  discordInviteUrl?: string;
  autoResolveOnRoleChange?: boolean;
  restrictedRoleIds?: string[];
  requiredRoleIds?: string[];
  requiredRoleMatchMode?: 'any' | 'all';
  acceptedRemovalRoleIds?: string[];
  deniedRemovalRoleIds?: string[];
  removeRolesOnSubmit?: string[];
  acceptedChannelId?: string;
  deniedChannelId?: string;
  pendingChannelId?: string;
  applicationTimeLimitMinutes?: number;
  actionOnApplicantLeave?: 'nothing' | 'withdraw' | 'notify' | 'archive';
}

export const discordService = new DiscordService();
