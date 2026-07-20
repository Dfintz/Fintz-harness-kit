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
    nameTemplate?: string;
    autoDelete?: boolean;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface EventSettings {
    eventAnnouncementChannelId?: string;
    eventNotificationRoleId?: string;
    eventNotificationRoleIds?: string[];
    enableEventMentions?: boolean;
    autoDeleteEventMessages?: boolean;
    eventMessageRetentionDays?: number;
    allowEventRsvp?: boolean;
    remindersEnabled?: boolean;
    reminderHoursBefore?: number[];
    eventCreationRoleId?: string;
    maxMirrorsPerActivity?: number;
    tempRolesEnabled?: boolean;
    tempRoleColor?: number;
    archiveChannelId?: string;
    archiveAfterHours?: number;
    allowedRoleIds?: string[];
    bannedRoleIds?: string[];
    createDiscordEvent?: boolean;
    eventVoiceCategoryId?: string;
    cleanupMode?: 'afterEnd' | 'afterComplete';
    cleanupHoursAfterEnd?: number;
    createEventThread?: boolean;
    autoPublishAnnouncements?: boolean;
}
export interface VoiceChannelSettings {
    parentCategoryId?: string;
    hubChannelId?: string;
    hubChannelIds?: string[];
    channelNameTemplate?: string;
    autoCreateChannels?: boolean;
    autoDeleteEmptyChannels?: boolean;
    deleteEmptyChannelDelayMinutes?: number;
    deleteEmptyChannelDelaySeconds?: number;
    maxActiveChannels?: number;
    defaultUserLimit?: number;
    bitrate?: number;
    allowUserLimit?: boolean;
    templates?: VoiceChannelTemplate[];
    moderatorRoleId?: string;
    userCanRename?: boolean;
    interfaceMessageEnabled?: boolean;
    ownershipTransferEnabled?: boolean;
    lfgLobbyChannelIds?: string[];
    channelPosition?: 'top' | 'bottom';
}
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
    maxConnectedServersDefault?: number;
    allowBotMessagesByDefault?: boolean;
}
export interface NotificationPreferences {
    announcementChannelId?: string;
    pinnedAnnouncementChannelId?: string;
    memberJoinNotifications?: boolean;
    memberJoinChannelId?: string;
    memberLeaveNotifications?: boolean;
    memberLeaveChannelId?: string;
    roleChangeNotifications?: boolean;
    roleChangeChannelId?: string;
    eventNotifications?: boolean;
    eventNotificationChannelId?: string;
    systemAlertChannelId?: string;
    moderationAlertChannelId?: string;
    auditLogChannelId?: string;
    enableMentionRolesToNotify?: boolean;
    notificationMentionRoles?: string[];
    excludeBotJoins?: boolean;
    autoPublishAnnouncements?: boolean;
}
export interface RoleSyncSettings {
    enabled: boolean;
    syncRolesFromApi?: boolean;
    syncRolesFromSheet?: boolean;
    roleMappings?: Record<string, string | string[]>;
    autoRoleManagement?: boolean;
    removeRolesOnLeave?: boolean;
    syncIntervalMinutes?: number;
    syncOnBotJoin?: boolean;
    requireManualApproval?: boolean;
    approvalRoleId?: string;
    syncErrorNotificationChannelId?: string;
    roleSyncMetadata?: Record<string, unknown>;
    verifiedRoleId?: string;
    syncNicknames?: boolean;
    nicknameFormat?: string;
}
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
    autoEscalateHours?: number;
    autoDeleteResolvedDays?: number;
    notifyOnAutoClose?: boolean;
    notifyOnAutoEscalate?: boolean;
    ticketLogChannelId?: string;
    claimingEnabled?: boolean;
    twoStepCloseEnabled?: boolean;
    blockedRoleIds?: string[];
    requiredRoleIds?: string[];
    roleMatchMode?: 'any' | 'all';
    rateSupportEnabled?: boolean;
    channelNameTemplate?: string;
    ticketChannelEnabled?: boolean;
    ticketChannelCategoryId?: string;
    quickResponseCategories?: {
        id: string;
        name: string;
    }[];
    quickResponses?: {
        id: string;
        name: string;
        content: string;
        categoryId?: string;
        createdBy?: string;
    }[];
    supportServerGuildId?: string;
    supportWebhookUrl?: string;
    supportInviteUrl?: string;
}
export interface RecruitmentSettings {
    enabled?: boolean;
    applicationChannelId?: string;
    acceptRoleId?: string;
    denyRoleId?: string;
    pendingRoleId?: string;
    staffPingRoleId?: string;
    staffThreadChannelId?: string;
    reapplyCooldownDays?: number;
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
    applicantChannelEnabled?: boolean;
    applicantChannelCategoryId?: string;
}
export interface GiveawaySettings {
    enabled: boolean;
    maxActivegiveaways?: number;
    defaultDurationMinutes?: number;
}
export interface AdvancedEventSettings {
    lockWhenFull?: boolean;
    benchEnabled?: boolean;
    maxBenchSlots?: number;
    preventDuplicateRsvp?: boolean;
    signupDeadlineHours?: number;
    allowDiscordGuests?: boolean;
    guestMemberRoleIds?: string[];
}
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
export interface SmartLfgPingSettings {
    enabled: boolean;
    cooldownHours?: number;
    maxPingsPerPost?: number;
    activityFilter?: string[];
    optInRoleId?: string;
}
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
export interface StatSettings {
    enabled: boolean;
    trackMessages?: boolean;
    trackVoice?: boolean;
    trackInvites?: boolean;
    excludedChannelIds?: string[];
    excludedRoleIds?: string[];
    retentionDays?: number;
    statRoleEvalIntervalHours?: number;
    counterUpdateIntervalMinutes?: number;
}
export interface LfgSettings {
    defaultGame?: string;
    gameFilters?: string[];
    otherGamesChannelId?: string;
    lfgVoiceCategoryId?: string;
    lfgMentionRoleId?: string;
    publicLfgEnabled?: boolean;
    publicLfgDelivery?: 'dm' | 'channel';
    publicLfgChannelId?: string;
    publicLfgOptInRoleId?: string;
    publicLfgGuildAllowList?: string[];
}
export declare class DiscordGuildSettings {
    id: string;
    organizationId: string;
    guildId: string;
    guildName?: string;
    guildIconUrl?: string;
    eventSettings?: EventSettings;
    voiceChannelSettings?: VoiceChannelSettings;
    tunnelSettings?: TunnelSettings;
    notificationPreferences?: NotificationPreferences;
    roleSyncSettings?: RoleSyncSettings;
    crossModerationSettings?: CrossModerationSettings;
    ticketSettings?: TicketSettings;
    statSettings?: StatSettings;
    dmNotificationSettings?: DmNotificationSettings;
    smartLfgPingSettings?: SmartLfgPingSettings;
    recruitmentSettings?: RecruitmentSettings;
    giveawaySettings?: GiveawaySettings;
    advancedEventSettings?: AdvancedEventSettings;
    teamVoiceSettings?: TeamVoiceSettings;
    roleGatingSettings?: Record<string, unknown>;
    lfgNetworkSettings?: Record<string, unknown>;
    lfgSettings?: LfgSettings;
    welcomeSettings?: WelcomeSettings;
    auditLogSettings?: AuditLogSettings;
    featureFlags?: Record<string, boolean>;
    timezone?: string;
    settingsEnabled: boolean;
    adminUserIds?: string[];
    serverManagerRoleIds?: string[];
    starCommsManagerRoleIds?: string[];
    assistantRoleIds?: string[];
    metadata?: Record<string, unknown>;
    lastModifiedBy?: string;
    createdAt: Date;
    updatedAt: Date;
    lastSyncedAt?: Date;
    syncErrorCount: number;
    lastSyncError?: string;
    toDTO(): {
        id: string;
        organizationId: string;
        guildId: string;
        guildName: string | undefined;
        guildIconUrl: string | undefined;
        eventSettings: EventSettings | undefined;
        voiceChannelSettings: VoiceChannelSettings | undefined;
        tunnelSettings: TunnelSettings | undefined;
        notificationPreferences: NotificationPreferences | undefined;
        roleSyncSettings: RoleSyncSettings | undefined;
        crossModerationSettings: CrossModerationSettings | undefined;
        ticketSettings: TicketSettings | undefined;
        statSettings: StatSettings | undefined;
        dmNotificationSettings: DmNotificationSettings | undefined;
        smartLfgPingSettings: SmartLfgPingSettings | undefined;
        recruitmentSettings: RecruitmentSettings | undefined;
        giveawaySettings: GiveawaySettings | undefined;
        advancedEventSettings: AdvancedEventSettings | undefined;
        teamVoiceSettings: TeamVoiceSettings | undefined;
        roleGatingSettings: Record<string, unknown> | undefined;
        lfgNetworkSettings: Record<string, unknown> | undefined;
        lfgSettings: LfgSettings | undefined;
        welcomeSettings: WelcomeSettings | undefined;
        auditLogSettings: AuditLogSettings | undefined;
        timezone: string | undefined;
        settingsEnabled: boolean;
        adminUserIds: string[] | undefined;
        serverManagerRoleIds: string[] | undefined;
        starCommsManagerRoleIds: string[] | undefined;
        assistantRoleIds: string[] | undefined;
        createdAt: Date;
        updatedAt: Date;
        lastSyncedAt: Date | undefined;
    };
}
//# sourceMappingURL=DiscordGuildSettings.d.ts.map