import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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
} from './DiscordGuildSettings';

/**
 * Federation Discord Guild Settings
 *
 * Stores federation-scoped Discord configuration for a central guild.
 * Mirrors the org-scoped DiscordGuildSettings structure but uses federationId
 * as the tenant scope instead of organizationId.
 *
 * Permission model: ambassador-based via requireFederationPermission('settings'),
 * not org membership checks.
 */
@Entity('federation_discord_guild_settings')
@Index(['federationId', 'guildId'], { unique: true })
@Index(['federationId'])
@Index(['guildId'])
export class FederationDiscordGuildSettings {
  @PrimaryColumn()
  id!: string; // Format: "fed_id:guild_id"

  @Column()
  federationId!: string;

  @Column()
  guildId!: string;

  @Column({ nullable: true })
  guildName?: string;

  @Column({ nullable: true })
  guildIconUrl?: string;

  // ==================== SETTINGS ====================

  @Column({ type: 'jsonb', nullable: true })
  eventSettings?: EventSettings;

  @Column({ type: 'jsonb', nullable: true })
  voiceChannelSettings?: VoiceChannelSettings;

  @Column({ type: 'jsonb', nullable: true })
  tunnelSettings?: TunnelSettings;

  @Column({ type: 'jsonb', nullable: true })
  notificationPreferences?: NotificationPreferences;

  @Column({ type: 'jsonb', nullable: true })
  roleSyncSettings?: RoleSyncSettings;

  @Column({ type: 'jsonb', nullable: true })
  crossModerationSettings?: CrossModerationSettings;

  @Column({ type: 'jsonb', nullable: true })
  ticketSettings?: TicketSettings;

  @Column({ type: 'jsonb', nullable: true })
  statSettings?: StatSettings;

  @Column({ type: 'jsonb', nullable: true })
  dmNotificationSettings?: DmNotificationSettings;

  @Column({ type: 'jsonb', nullable: true })
  smartLfgPingSettings?: SmartLfgPingSettings;

  @Column({ type: 'jsonb', nullable: true })
  recruitmentSettings?: RecruitmentSettings;

  @Column({ type: 'jsonb', nullable: true })
  giveawaySettings?: GiveawaySettings;

  @Column({ type: 'jsonb', nullable: true })
  advancedEventSettings?: AdvancedEventSettings;

  @Column({ type: 'jsonb', nullable: true })
  teamVoiceSettings?: TeamVoiceSettings;

  @Column({ type: 'jsonb', nullable: true })
  roleGatingSettings?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  lfgNetworkSettings?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  lfgSettings?: LfgSettings;

  @Column({ type: 'jsonb', nullable: true })
  welcomeSettings?: WelcomeSettings;

  @Column({ type: 'jsonb', nullable: true })
  auditLogSettings?: AuditLogSettings;

  // ==================== CONFIGURATION ====================

  /** Server-wide timezone (IANA format, e.g. 'America/New_York') */
  @Column({ type: 'varchar', nullable: true })
  timezone?: string;

  @Column({ default: true })
  settingsEnabled!: boolean;

  @Column('simple-array', { nullable: true })
  adminUserIds?: string[];

  @Column('simple-array', { nullable: true })
  serverManagerRoleIds?: string[];

  @Column('simple-array', { nullable: true })
  starCommsManagerRoleIds?: string[];

  @Column('simple-array', { nullable: true })
  assistantRoleIds?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // ==================== AUDIT ====================

  @Column({ nullable: true })
  lastModifiedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  lastSyncedAt?: Date;

  @Column({ default: 0 })
  syncErrorCount!: number;

  @Column({ nullable: true })
  lastSyncError?: string;

  // ==================== METHODS ====================

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
}
