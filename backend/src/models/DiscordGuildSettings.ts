import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Voice channel template for temporary voice channel management
 */
export interface VoiceChannelTemplate {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  bitrate?: number;
  userLimit?: number;
  parentChannelId?: string;
  tags?: string[];
  enabled: boolean;
  /** Discord channel name template (variables: {user}, {nickname}, {game}, {count}) */
  nameTemplate?: string;
  /** Auto-delete the channel when it becomes empty */
  autoDelete?: boolean;
  /** User ID who created the template */
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Event settings configuration
 */
export interface EventSettings {
  eventAnnouncementChannelId?: string;
  /**
   * Legacy single-role mention for event announcements. Prefer
   * `eventNotificationRoleIds` (array) for new configuration; both are honored
   * at announcement time, with the array taking precedence.
   */
  eventNotificationRoleId?: string;
  /** Roles to @mention when a new event embed is posted. Optional. */
  eventNotificationRoleIds?: string[];
  /**
   * Master toggle for mentioning roles when posting event embeds. Defaults to
   * true when role IDs are configured. Set to false to suppress mentions
   * without clearing the role list.
   */
  enableEventMentions?: boolean;
  autoDeleteEventMessages?: boolean;
  eventMessageRetentionDays?: number;
  allowEventRsvp?: boolean;
  remindersEnabled?: boolean;
  reminderHoursBefore?: number[];
  eventCreationRoleId?: string;
  /** Max mirrors allowed per activity (1–10). Defaults to 5 when unset. */
  maxMirrorsPerActivity?: number;
  /** Auto-create temporary Discord roles for event participants when they RSVP */
  tempRolesEnabled?: boolean;
  /** Color for auto-created temp roles (Discord integer color, default 0x3498db) */
  tempRoleColor?: number;
  /** Channel where completed events are archived (summary embed posted) */
  archiveChannelId?: string;
  /** Hours after event ends before archiving (default: 24) */
  archiveAfterHours?: number;
  /** Roles allowed to RSVP to events (empty = all) */
  allowedRoleIds?: string[];
  /** Roles banned from RSVPing to events */
  bannedRoleIds?: string[];
  /** Auto-create a native Discord Scheduled Event for new activities (default: false) */
  createDiscordEvent?: boolean;
  /** Discord category ID where voice channels for scheduled events are created */
  eventVoiceCategoryId?: string;
  /** How message cleanup timing is calculated: 'afterEnd' counts from event end, 'afterComplete' from status=completed */
  cleanupMode?: 'afterEnd' | 'afterComplete';
  /** Hours after the event ends/completes before messages are deleted (when cleanupMode is used) */
  cleanupHoursAfterEnd?: number;
  /** Auto-create a discussion thread on the event embed for logging & participant chat */
  createEventThread?: boolean;
  /** Auto-publish (crosspost) messages sent to Discord announcement channels (type 5) */
  autoPublishAnnouncements?: boolean;
}

/**
 * Temporary voice channel settings
 */
export interface VoiceChannelSettings {
  parentCategoryId?: string;
  hubChannelId?: string; // "Join to Create" lobby — joining this channel auto-creates a temp channel
  /** Additional hub channel IDs (multi-hub support) */
  hubChannelIds?: string[];
  /** Channel name template for auto-created channels. Variables: {user}, {nickname}, {game}, {count} */
  channelNameTemplate?: string;
  autoCreateChannels?: boolean;
  autoDeleteEmptyChannels?: boolean;
  deleteEmptyChannelDelayMinutes?: number;
  /**
   * Seconds to wait after a temp channel becomes empty before deleting.
   * Takes precedence over `deleteEmptyChannelDelayMinutes` when set.
   * 0 = delete immediately.
   */
  deleteEmptyChannelDelaySeconds?: number;
  maxActiveChannels?: number;
  /** Default user limit for auto-created voice channels (0 = unlimited, max 99) */
  defaultUserLimit?: number;
  /** Default bitrate in bps for auto-created voice channels (8000–384000) */
  bitrate?: number;
  /** Allow channel owners to change the user limit on their temp channel */
  allowUserLimit?: boolean;
  templates?: VoiceChannelTemplate[];
  moderatorRoleId?: string;
  userCanRename?: boolean;
  /** Post an interface message with self-moderation buttons in created channels */
  interfaceMessageEnabled?: boolean;
  /** Auto-transfer channel ownership to the oldest member when the creator leaves */
  ownershipTransferEnabled?: boolean;
  /** Voice channel IDs designated as LFG lobbies — joining auto-creates an LFG post */
  lfgLobbyChannelIds?: string[];
  /** Position of auto-created channels relative to the hub: 'top' or 'bottom' */
  channelPosition?: 'top' | 'bottom';
}

/**
 * Tunnel settings for private voice channels
 */
export interface TunnelSettings {
  enabled: boolean;
  tunnelCategoryId?: string;
  maxActiveTunnels?: number;
  tunnelDurationMinutes?: number;
  autoDeleteTunnel?: boolean;
  requireApprovalRoleId?: string;
  tunnelCreatorRoleId?: string;
  tunnelNotificationChannelId?: string;
  allowNesting?: boolean;
  /** Default max connected servers for new tunnels (0 = unlimited) */
  maxConnectedServersDefault?: number;
  /** Whether bot messages are relayed by default in new tunnels */
  allowBotMessagesByDefault?: boolean;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  announcementChannelId?: string;
  pinnedAnnouncementChannelId?: string;
  memberJoinNotifications?: boolean;
  /** Override channel for member-join trigger posts. Falls back to announcementChannelId. */
  memberJoinChannelId?: string;
  memberLeaveNotifications?: boolean;
  /** Override channel for member-leave trigger posts. Falls back to announcementChannelId. */
  memberLeaveChannelId?: string;
  roleChangeNotifications?: boolean;
  /** Override channel for role-change trigger posts. Falls back to announcementChannelId. */
  roleChangeChannelId?: string;
  eventNotifications?: boolean;
  /** Override channel for event-activity trigger posts. Falls back to announcementChannelId. */
  eventNotificationChannelId?: string;
  systemAlertChannelId?: string;
  moderationAlertChannelId?: string;
  auditLogChannelId?: string;
  enableMentionRolesToNotify?: boolean;
  notificationMentionRoles?: string[];
  excludeBotJoins?: boolean;
  /** Auto-publish (crosspost) messages sent to Discord announcement channels (type 5) */
  autoPublishAnnouncements?: boolean;
}

/**
 * Role synchronization settings
 */
export interface RoleSyncSettings {
  enabled: boolean;
  syncRolesFromApi?: boolean;
  syncRolesFromSheet?: boolean;
  roleMappings?: Record<string, string | string[]>; // Maps org roles to one or more Discord roles
  autoRoleManagement?: boolean;
  removeRolesOnLeave?: boolean;
  syncIntervalMinutes?: number;
  syncOnBotJoin?: boolean;
  requireManualApproval?: boolean;
  approvalRoleId?: string;
  syncErrorNotificationChannelId?: string;
  roleSyncMetadata?: Record<string, unknown>;
  /** Discord role ID auto-assigned to RSI-verified members */
  verifiedRoleId?: string;
  /** Sync Discord nicknames to RSI handles on verification (default: false) */
  syncNicknames?: boolean;
  /**
   * Nickname format template. Variables: {rsiHandle}, {displayName}
   * Examples: "{rsiHandle}", "[{rsiHandle}] {displayName}"
   * Default: "{rsiHandle}"
   */
  nicknameFormat?: string;
}

/**
 * Cross-guild moderation settings
 */
export interface CrossModerationSettings {
  enabled: boolean;
  sharedBanListEnabled?: boolean;
  sharedMuteListEnabled?: boolean;
  autoBanOnSharedList?: boolean;
  propagateTimeouts?: boolean;
  forwardModerationAlerts?: boolean;
  notifyOnSharedAction?: boolean;
  banAppealsChannelId?: string;
  crossGuildAuditLogChannelId?: string;
  escalationRoleId?: string;
  allowedGuildIds?: string[];
}

/**
 * Welcome/goodbye system settings
 */
export interface WelcomeSettings {
  welcomeEnabled: boolean;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  goodbyeEnabled: boolean;
  goodbyeChannelId?: string;
  goodbyeMessage?: string;
  autoRoleIds?: string[];
  welcomeDmEnabled: boolean;
  welcomeDmMessage?: string;
}

/**
 * Audit log settings — controls which Discord events are logged to a channel
 */
export interface AuditLogSettings {
  enabled: boolean;
  logChannelId?: string;
  logMessageEdits: boolean;
  logMessageDeletes: boolean;
  logRoleChanges: boolean;
  logChannelChanges: boolean;
  logMemberJoinLeave: boolean;
  ignoredChannelIds?: string[];
}

/**
 * Ticket system settings
 */
export interface TicketSettings {
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
  /** Auto-escalate tickets after N hours without staff response (0 = disabled) */
  autoEscalateHours?: number;
  /** Auto-delete resolved tickets after N days (0 = disabled) */
  autoDeleteResolvedDays?: number;
  /** Post notification in channel on auto-close */
  notifyOnAutoClose?: boolean;
  /** Post notification in channel on auto-escalate */
  notifyOnAutoEscalate?: boolean;
  /** Channel ID for ticket activity log (create/claim/close/etc.) */
  ticketLogChannelId?: string;
  /** Allow staff to claim tickets */
  claimingEnabled?: boolean;
  /** Require confirmation before closing a ticket */
  twoStepCloseEnabled?: boolean;
  /** Roles that CANNOT open tickets */
  blockedRoleIds?: string[];
  /** Roles REQUIRED to open tickets */
  requiredRoleIds?: string[];
  /** Match mode: 'any' (has any required role) or 'all' (has all required roles) */
  roleMatchMode?: 'any' | 'all';
  /** Enable post-close satisfaction rating (1-5 stars) */
  rateSupportEnabled?: boolean;
  /** Channel name template for new tickets (e.g. ticket-{count}, {user}-{category}) */
  channelNameTemplate?: string;
  /** Create a private Discord text channel per ticket (scoped to opener + support role) */
  ticketChannelEnabled?: boolean;
  /** Category ID under which private ticket channels are created */
  ticketChannelCategoryId?: string;
  /** Quick response categories for canned replies */
  quickResponseCategories?: { id: string; name: string }[];
  /** Quick responses for common ticket replies */
  quickResponses?: {
    id: string;
    name: string;
    content: string;
    categoryId?: string;
    createdBy?: string;
  }[];
  /** Optional support server guild ID used for cross-server support workflows */
  supportServerGuildId?: string;
  /** Optional Discord webhook URL for posting technical ticket alerts to support server */
  supportWebhookUrl?: string;
  /** Optional support server invite URL shown in intake/admin UI */
  supportInviteUrl?: string;
}

/**
 * Recruitment enhancement settings
 */
export interface RecruitmentSettings {
  /** Whether Discord recruitment integration is enabled */
  enabled?: boolean;
  /** Channel where applications are posted */
  applicationChannelId?: string;
  /** Role to assign when an application is accepted */
  acceptRoleId?: string;
  /** Role to assign when an application is denied (optional) */
  denyRoleId?: string;
  /** Role for applicants awaiting review */
  pendingRoleId?: string;
  /** Role to ping when a new application arrives */
  staffPingRoleId?: string;
  /** Channel to create staff discussion threads */
  staffThreadChannelId?: string;
  /** Cooldown in days before re-applying to the same position */
  reapplyCooldownDays?: number;
  /** Require linked Discord account for applications */
  requireDiscordVerification?: boolean;
  /** Automatically assign acceptRoleId on approval */
  autoAssignRole?: boolean;
  /** Message sent to applicant on approval */
  welcomeMessage?: string;
  /** Message sent to applicant on denial */
  deniedMessage?: string;
  /** Message shown when user starts an application (confirmation prompt) */
  confirmationMessage?: string;
  /** Message shown when user completes an application */
  completionMessage?: string;
  /** Whether invite form binding is active */
  inviteFormEnabled?: boolean;
  /** The generated binding code for invite-form flow */
  inviteFormBindingCode?: string;
  /** Discord invite URL used when recruitment is enabled */
  discordInviteUrl?: string;
  /** Auto-resolve applications when Discord roles change */
  autoResolveOnRoleChange?: boolean;
  /** Roles that CANNOT apply (blocked from submitting) */
  restrictedRoleIds?: string[];
  /** Roles REQUIRED to apply (must have at least one / all based on matchMode) */
  requiredRoleIds?: string[];
  /** Match mode for required roles: 'any' = has any, 'all' = has all */
  requiredRoleMatchMode?: 'any' | 'all';
  /** Roles to REMOVE when application is accepted */
  acceptedRemovalRoleIds?: string[];
  /** Roles to REMOVE when application is denied */
  deniedRemovalRoleIds?: string[];
  /** Roles to REMOVE on application submit */
  removeRolesOnSubmit?: string[];
  /** Channel where accepted applications are posted */
  acceptedChannelId?: string;
  /** Channel where denied applications are posted */
  deniedChannelId?: string;
  /** Channel where pending applications are posted (separate from main app channel) */
  pendingChannelId?: string;
  /** Time limit in minutes to complete an application (0 = no limit) */
  applicationTimeLimitMinutes?: number;
  /** Action when applicant leaves the server */
  actionOnApplicantLeave?: 'nothing' | 'withdraw' | 'notify' | 'archive';
  /** Open an ephemeral private channel (applicant + staff role) for each application */
  applicantChannelEnabled?: boolean;
  /** Category under which ephemeral applicant channels are created */
  applicantChannelCategoryId?: string;
}

/**
 * Giveaway settings per guild
 */
export interface GiveawaySettings {
  enabled: boolean;
  maxActivegiveaways?: number;
  defaultDurationMinutes?: number;
}

/**
 * Advanced event settings
 */
export interface AdvancedEventSettings {
  /** Auto-lock signup when event reaches capacity */
  lockWhenFull?: boolean;
  /** Allow a bench/overflow waitlist beyond max capacity */
  benchEnabled?: boolean;
  /** Max bench/overflow slots (0 = unlimited) */
  maxBenchSlots?: number;
  /** Prevent duplicate RSVPs across overlapping events */
  preventDuplicateRsvp?: boolean;
  /** Signup deadline (hours before event start; 0 = no deadline) */
  signupDeadlineHours?: number;
  /** Allow Discord users without a linked platform account to RSVP to events */
  allowDiscordGuests?: boolean;
  /**
   * Discord role IDs that grant guest users member-equivalent access to
   * org-restricted events (ORGANIZATION, ALLIANCE, CROSS_ORG visibility).
   * PRIVATE (invitation-only) events always require a linked platform account.
   * If empty/unset, guests can only join PUBLIC and LISTED events.
   */
  guestMemberRoleIds?: string[];
}

/**
 * DM notification settings per guild
 */
export interface DmNotificationSettings {
  enabled: boolean;
  ticketCreated?: boolean;
  ticketAssigned?: boolean;
  ticketReplied?: boolean;
  ticketClosed?: boolean;
  ticketEscalated?: boolean;
  recruitmentReceived?: boolean;
  recruitmentAccepted?: boolean;
  recruitmentDenied?: boolean;
  eventReminder?: boolean;
  eventCancelled?: boolean;
  lfgPlayerJoined?: boolean;
}

/**
 * Smart LFG ping settings per guild
 */
export interface SmartLfgPingSettings {
  enabled: boolean;
  cooldownHours?: number;
  maxPingsPerPost?: number;
  activityFilter?: string[];
  optInRoleId?: string;
}

/**
 * Team voice channel settings — controls Discord category/text/voice creation for teams
 */
export interface TeamVoiceSettings {
  /** Master toggle — enables/disables the entire team voice feature */
  enabled: boolean;
  /** Allow non-team members (base access role) to see who's in voice */
  allowBaseVisibility?: boolean;
  /** Allow non-team members to listen in but not speak */
  allowListenIn?: boolean;
  /**
   * Enforce push-to-talk for team members in the voice channel.
   * Denies UseVAD permission — may be overridden by other Discord roles
   * with higher priority in the server's role hierarchy.
   */
  enforcePushToTalk?: boolean;
  /** Grant priority speaker to team leaders/officers */
  enablePrioritySpeaker?: boolean;
  /** Auto-create channels when a team is created */
  autoCreateOnTeamCreate?: boolean;
  /** Auto-delete channels when a team is deleted */
  autoDeleteOnTeamDelete?: boolean;
  /** Parent category ID to nest team categories under (optional) */
  parentCategoryId?: string;
  /** Discord role ID for org members who can see channel activity but not join */
  baseAccessRoleId?: string;
}

export interface StatSettings {
  enabled: boolean;
  trackMessages?: boolean;
  trackVoice?: boolean;
  trackInvites?: boolean;
  excludedChannelIds?: string[];
  excludedRoleIds?: string[];
  /** Days to keep engagement data (default 90) */
  retentionDays?: number;
  /** How often stat roles are evaluated in hours (default 6) */
  statRoleEvalIntervalHours?: number;
  /** How often channel counters update in minutes (default 10) */
  counterUpdateIntervalMinutes?: number;
}

/**
 * LFG-specific settings per guild
 */
export interface LfgSettings {
  /** Default game for LFG posts (default: "Star Citizen") */
  defaultGame?: string;
  /** Allowed games for LFG (empty = Star Citizen only) */
  gameFilters?: string[];
  /** Dedicated channel for non-default-game LFG posts */
  otherGamesChannelId?: string;
  /** Category ID where auto-created LFG voice channels are placed */
  lfgVoiceCategoryId?: string;
  /** Role to @mention in the channel when a new LFG post is created */
  lfgMentionRoleId?: string;
  /** Enable public LFG — posts are shared to opted-in users across servers */
  publicLfgEnabled?: boolean;
  /** How public LFG posts are delivered: 'dm' (default) or 'channel' */
  publicLfgDelivery?: 'dm' | 'channel';
  /** Channel ID for public LFG posts when delivery is 'channel' */
  publicLfgChannelId?: string;
  /** Role required to receive public LFG DMs (empty = all members) */
  publicLfgOptInRoleId?: string;
  /**
   * Guild ID allowlist for public LFG broadcasting.
   * When non-empty, LFG posts are only shared with the listed guild IDs.
   * Empty array (default) = broadcast to all connected/public guilds.
   */
  publicLfgGuildAllowList?: string[];
}

/**
 * Discord Guild Settings
 * Stores organization-specific Discord configuration for a guild
 * Respects organization tenant boundaries - each org has isolated settings per guild
 */
@Entity('discord_guild_settings')
@Index(['organizationId', 'guildId'], { unique: true })
@Index(['organizationId'])
@Index(['guildId'])
export class DiscordGuildSettings {
  @PrimaryColumn()
  id!: string; // Format: "org_id:guild_id"

  @Column()
  organizationId!: string;

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

  /**
   * Per-guild bot feature-flag overrides (ARCH-11): a map of feature-flag id →
   * explicit boolean, forming the per-guild layer of the `guildFeatureFlags`
   * resolver. Read/written (sanitized) via `DiscordSettingsService`. Typed
   * generically here to keep the model independent of the bot's flag vocabulary.
   */
  @Column({ type: 'jsonb', nullable: true })
  featureFlags?: Record<string, boolean>;

  // ==================== CONFIGURATION ====================

  /** Server-wide timezone (IANA format, e.g. 'America/New_York') */
  @Column({ type: 'varchar', nullable: true })
  timezone?: string;

  @Column({ default: true })
  settingsEnabled!: boolean;

  @Column('simple-array', { nullable: true })
  adminUserIds?: string[]; // Users who can modify these settings

  @Column('simple-array', { nullable: true })
  serverManagerRoleIds?: string[]; // Discord roles that can modify settings

  @Column('simple-array', { nullable: true })
  starCommsManagerRoleIds?: string[]; // Discord roles that can manage StarComms integrations

  @Column('simple-array', { nullable: true })
  assistantRoleIds?: string[]; // Roles that can create events/activities but not edit others'

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
}
