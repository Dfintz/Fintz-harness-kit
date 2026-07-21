import Joi from 'joi';

/**
 * Discord-related validation schemas
 */

const _guildId = Joi.string().regex(/^\d+$/).required().messages({
  'string.pattern.base': 'Guild ID must be a valid Discord ID',
});

const optionalGuildId = Joi.string().regex(/^\d+$/).messages({
  'string.pattern.base': 'Guild ID must be a valid Discord ID',
});

const userId = Joi.string().regex(/^\d+$/).required().messages({
  'string.pattern.base': 'User ID must be a valid Discord ID',
});

const roleIdItem = Joi.string().regex(/^\d+$/).messages({
  'string.pattern.base': 'Role ID must be a valid Discord ID',
});

const roleId = roleIdItem.required();

const roleIdOrRoleIdArray = Joi.alternatives().try(
  roleId,
  Joi.array().items(roleIdItem).min(1).max(20)
);

const channelId = Joi.string().regex(/^\d+$/).optional().allow(null);

const requiredChannelId = Joi.string().regex(/^\d+$/).required().messages({
  'string.pattern.base': 'Channel ID must be a valid Discord ID',
});

const ianaTimezonePattern = /^(?:UTC|GMT|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;

export const discordSettingsSchemas = {
  // Event settings
  eventSettings: Joi.object({
    eventAnnouncementChannelId: channelId,
    eventNotificationRoleId: roleId.optional().allow(null),
    eventNotificationRoleIds: Joi.array().items(roleIdItem).optional(),
    enableEventMentions: Joi.boolean().optional(),
    autoDeleteEventMessages: Joi.boolean().optional(),
    eventMessageRetentionDays: Joi.number().integer().min(1).max(365).optional(),
    allowEventRsvp: Joi.boolean().optional(),
    remindersEnabled: Joi.boolean().optional(),
    reminderHoursBefore: Joi.array().items(Joi.number().integer().min(1)).optional(),
    eventCreationRoleId: roleId.optional().allow(null),
    maxMirrorsPerActivity: Joi.number().integer().min(0).max(50).optional(),
    tempRolesEnabled: Joi.boolean().optional(),
    tempRoleColor: Joi.number().integer().min(0).max(0xffffff).optional(),
    createDiscordEvent: Joi.boolean().optional(),
    eventVoiceCategoryId: channelId,
    cleanupMode: Joi.string().valid('afterEnd', 'afterComplete').optional(),
    cleanupHoursAfterEnd: Joi.number().integer().min(1).max(8760).optional(),
    createEventThread: Joi.boolean().optional(),
    autoPublishAnnouncements: Joi.boolean().optional(),
    archiveChannelId: channelId,
    archiveAfterHours: Joi.number().integer().min(1).max(8760).optional(),
    allowedRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    bannedRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
  }),

  // Voice channel settings
  voiceChannelSettings: Joi.object({
    parentCategoryId: channelId,
    hubChannelId: channelId,
    hubChannelIds: Joi.array().items(channelId).optional(),
    channelNameTemplate: Joi.string().max(100).optional(),
    autoCreateChannels: Joi.boolean().optional(),
    autoDeleteEmptyChannels: Joi.boolean().optional(),
    deleteEmptyChannelDelayMinutes: Joi.number().integer().min(0).max(1440).optional(),
    deleteEmptyChannelDelaySeconds: Joi.number().integer().min(0).max(86400).optional(),
    maxActiveChannels: Joi.number().integer().min(0).max(500).optional(),
    defaultUserLimit: Joi.number().integer().min(0).max(99).optional(),
    bitrate: Joi.number().integer().min(8000).max(384000).optional(),
    allowUserLimit: Joi.boolean().optional(),
    channelPosition: Joi.string().valid('top', 'bottom').optional(),
    interfaceMessageEnabled: Joi.boolean().optional(),
    ownershipTransferEnabled: Joi.boolean().optional(),
    templates: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().max(100).required(),
          description: Joi.string().max(500).optional(),
          categoryId: channelId,
          bitrate: Joi.number().min(8000).max(384000).optional(),
          userLimit: Joi.number().integer().min(0).max(99).optional(),
          parentChannelId: channelId,
          tags: Joi.array().items(Joi.string()).optional(),
          enabled: Joi.boolean().required(),
        })
      )
      .optional(),
    moderatorRoleId: roleId.optional().allow(null),
    userCanRename: Joi.boolean().optional(),
  }),

  // Tunnel settings
  tunnelSettings: Joi.object({
    enabled: Joi.boolean().required(),
    tunnelCategoryId: channelId,
    maxActiveTunnels: Joi.number().integer().min(1).max(100).optional(),
    tunnelDurationMinutes: Joi.number().integer().min(5).max(1440).optional(),
    autoDeleteTunnel: Joi.boolean().optional(),
    requireApprovalRoleId: roleId.optional().allow(null),
    tunnelCreatorRoleId: roleId.optional().allow(null),
    tunnelNotificationChannelId: channelId,
    allowNesting: Joi.boolean().optional(),
  }),

  // Notification preferences
  notificationPreferences: Joi.object({
    announcementChannelId: channelId,
    pinnedAnnouncementChannelId: channelId,
    memberJoinNotifications: Joi.boolean().optional(),
    memberJoinChannelId: channelId,
    memberLeaveNotifications: Joi.boolean().optional(),
    memberLeaveChannelId: channelId,
    roleChangeNotifications: Joi.boolean().optional(),
    roleChangeChannelId: channelId,
    eventNotifications: Joi.boolean().optional(),
    eventNotificationChannelId: channelId,
    systemAlertChannelId: channelId,
    moderationAlertChannelId: channelId,
    auditLogChannelId: channelId,
    enableMentionRolesToNotify: Joi.boolean().optional(),
    notificationMentionRoles: Joi.array().items(roleIdItem).optional(),
    autoPublishAnnouncements: Joi.boolean().optional(),
  }),

  // Role sync settings
  roleSyncSettings: Joi.object({
    enabled: Joi.boolean().required(),
    syncRolesFromApi: Joi.boolean().optional(),
    syncRolesFromSheet: Joi.boolean().optional(),
    roleMappings: Joi.object().pattern(Joi.string(), roleIdOrRoleIdArray).optional(),
    autoRoleManagement: Joi.boolean().optional(),
    removeRolesOnLeave: Joi.boolean().optional(),
    syncIntervalMinutes: Joi.number().integer().min(5).max(1440).optional(),
    syncOnBotJoin: Joi.boolean().optional(),
    requireManualApproval: Joi.boolean().optional(),
    approvalRoleId: roleId.optional().allow(null),
    verifiedRoleId: roleId.optional().allow(null),
    syncErrorNotificationChannelId: channelId,
    roleSyncMetadata: Joi.object()
      .pattern(
        Joi.string().regex(/^(?!(__proto__|constructor|prototype)$)/),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.allow(null))
      )
      .max(50)
      .optional(),
  }),

  // Admin/Server manager management
  adminManagement: Joi.object({
    userId: userId.required(),
  }),

  serverManagerManagement: Joi.object({
    roleId: roleId.required(),
  }),

  starCommsManagerManagement: Joi.object({
    roleId: roleId.required(),
  }),

  // Cross-guild moderation settings
  crossModerationSettings: Joi.object({
    enabled: Joi.boolean().required(),
    sharedBanListEnabled: Joi.boolean().optional(),
    sharedMuteListEnabled: Joi.boolean().optional(),
    autoBanOnSharedList: Joi.boolean().optional(),
    propagateTimeouts: Joi.boolean().optional(),
    forwardModerationAlerts: Joi.boolean().optional(),
    notifyOnSharedAction: Joi.boolean().optional(),
    banAppealsChannelId: channelId,
    crossGuildAuditLogChannelId: channelId,
    escalationRoleId: roleId.optional().allow(null),
    allowedGuildIds: Joi.array().items(optionalGuildId).optional(),
  }),

  // Team voice settings
  teamVoiceSettings: Joi.object({
    enabled: Joi.boolean().required(),
    allowBaseVisibility: Joi.boolean().optional(),
    allowListenIn: Joi.boolean().optional(),
    enforcePushToTalk: Joi.boolean().optional(),
    enablePrioritySpeaker: Joi.boolean().optional(),
    autoCreateOnTeamCreate: Joi.boolean().optional(),
    autoDeleteOnTeamDelete: Joi.boolean().optional(),
    parentCategoryId: channelId,
    baseAccessRoleId: Joi.string().regex(/^\d+$/).optional().allow(null).messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
  }),

  // Ticket system settings
  ticketSettings: Joi.object({
    enabled: Joi.boolean().required(),
    defaultCategoryId: channelId,
    transcriptChannelId: channelId,
    supportRoleId: roleId.optional().allow(null),
    escalationRoleId: roleId.optional().allow(null),
    formChannelId: channelId,
    autoCloseHours: Joi.number().integer().min(1).max(168).optional(),
    maxOpenTicketsPerUser: Joi.number().integer().min(1).max(20).optional(),
    mentionSupportRoleOnCreate: Joi.boolean().optional(),
    notifyOnClose: Joi.boolean().optional(),
    allowMemberClose: Joi.boolean().optional(),
    blockedRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    requiredRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    roleMatchMode: Joi.string().valid('any', 'all').optional(),
    rateSupportEnabled: Joi.boolean().optional(),
    channelNameTemplate: Joi.string().max(100).optional().allow('', null),
    ticketChannelEnabled: Joi.boolean().optional(),
    ticketChannelCategoryId: Joi.string()
      .regex(/^\d+$/)
      .optional()
      .allow('', null)
      .messages({ 'string.pattern.base': 'Category ID must be a valid Discord snowflake' }),
    quickResponseCategories: Joi.array()
      .items(Joi.object({ id: Joi.string().required(), name: Joi.string().max(100).required() }))
      .optional(),
    quickResponses: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().max(100).required(),
          content: Joi.string().max(2000).required(),
          categoryId: Joi.string().optional().allow(''),
        })
      )
      .optional(),
    supportServerGuildId: Joi.string()
      .regex(/^\d+$/)
      .optional()
      .allow('', null)
      .messages({ 'string.pattern.base': 'Support server guild ID must be a valid Discord ID' }),
    supportWebhookUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .optional()
      .allow('', null),
    supportInviteUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .optional()
      .allow('', null),
  }),

  // LFG settings
  lfgSettings: Joi.object({
    lfgChannelId: channelId,
    lfgVoiceCategoryId: channelId,
    autoPostEnabled: Joi.boolean().optional(),
    autoLfgVoiceChannelScope: Joi.string().valid('all', 'selected').optional(),
    autoLfgAllowedVoiceChannelIds: Joi.array()
      .items(
        Joi.string().regex(/^\d+$/).messages({
          'string.pattern.base': 'Channel ID must be a valid Discord ID',
        })
      )
      .max(100)
      .optional(),
    smartPingEnabled: Joi.boolean().optional(),
    pingCooldownMinutes: Joi.number().integer().min(1).max(1440).optional(),
    crossOrgEnabled: Joi.boolean().optional(),
    crossOrgAllowList: Joi.array()
      .items(
        Joi.string()
          .max(100)
          .messages({ 'string.max': 'Each organization ID must be at most 100 characters' })
      )
      .max(50)
      .optional(),
    crossOrgBlockList: Joi.array()
      .items(
        Joi.string()
          .max(100)
          .messages({ 'string.max': 'Each organization ID must be at most 100 characters' })
      )
      .max(50)
      .optional(),
    crossOrgManualAllowTags: Joi.array()
      .items(
        Joi.string()
          .trim()
          .uppercase()
          .max(20)
          .pattern(/^[A-Z0-9_-]+$/)
          .messages({
            'string.max': 'RSI tag must be at most 20 characters',
            'string.pattern.base':
              'RSI tag must contain only letters, numbers, hyphens, or underscores',
          })
      )
      .max(50)
      .optional(),
    crossOrgManualBlockTags: Joi.array()
      .items(
        Joi.string()
          .trim()
          .uppercase()
          .max(20)
          .pattern(/^[A-Z0-9_-]+$/)
          .messages({
            'string.max': 'RSI tag must be at most 20 characters',
            'string.pattern.base':
              'RSI tag must contain only letters, numbers, hyphens, or underscores',
          })
      )
      .max(50)
      .optional(),
    region: Joi.string().max(50).optional().allow(''),
    language: Joi.string().max(50).optional().allow(''),
    roleFilterMappings: Joi.alternatives()
      .try(
        Joi.object().pattern(
          Joi.string()
            .regex(/^(?!(__proto__|constructor|prototype)$)/)
            .max(100),
          Joi.string().regex(/^\d+$/)
        ),
        Joi.string().max(2000).allow('')
      )
      .optional(),
    defaultGame: Joi.string().max(100).optional().allow(''),
    gameFilters: Joi.alternatives()
      .try(Joi.string().max(500).allow(''), Joi.array().items(Joi.string().trim().max(50)).max(20))
      .optional(),
    otherGamesChannelId: channelId,
    publicLfgEnabled: Joi.boolean().optional(),
    publicLfgDelivery: Joi.string().valid('dm', 'channel').optional(),
    publicLfgChannelId: channelId,
    publicLfgOptInRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    lfgMentionRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    publicLfgGuildAllowList: Joi.array()
      .items(
        Joi.string()
          .regex(/^\d{17,20}$/)
          .messages({ 'string.pattern.base': 'Each entry must be a valid Discord guild ID' })
      )
      .max(50)
      .optional(),
  }),

  // Recruitment settings
  recruitmentSettings: Joi.object({
    enabled: Joi.boolean().required(),
    applicationChannelId: channelId,
    acceptRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    denyRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    pendingRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    staffPingRoleId: Joi.string().regex(/^\d+$/).optional().allow(null, '').messages({
      'string.pattern.base': 'Role ID must be a valid Discord ID',
    }),
    staffThreadChannelId: channelId,
    reapplyCooldownDays: Joi.number().integer().min(0).max(365).optional(),
    requireDiscordVerification: Joi.boolean().optional(),
    autoAssignRole: Joi.boolean().optional(),
    welcomeMessage: Joi.string().max(2000).optional().allow(''),
    deniedMessage: Joi.string().max(2000).optional().allow(''),
    confirmationMessage: Joi.string().max(2000).optional().allow(''),
    completionMessage: Joi.string().max(2000).optional().allow(''),
    inviteFormEnabled: Joi.boolean().optional(),
    inviteFormBindingCode: Joi.string().max(50).optional().allow('', null),
    discordInviteUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .regex(/^https:\/\/(discord\.gg|discord\.com)\//i)
      .max(200)
      .optional()
      .allow(null, '')
      .messages({
        'string.pattern.base':
          'Invite URL must be a valid Discord invite link (https://discord.gg/... or https://discord.com/...)',
      }),
    autoResolveOnRoleChange: Joi.boolean().optional(),
    restrictedRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    requiredRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    requiredRoleMatchMode: Joi.string().valid('any', 'all').optional(),
    acceptedRemovalRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    deniedRemovalRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    removeRolesOnSubmit: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    acceptedChannelId: channelId,
    deniedChannelId: channelId,
    pendingChannelId: channelId,
    applicationTimeLimitMinutes: Joi.number().integer().min(0).max(525600).optional().allow(null),
    actionOnApplicantLeave: Joi.string()
      .valid('nothing', 'withdraw', 'notify', 'archive')
      .optional(),
    applicantChannelEnabled: Joi.boolean().optional(),
    applicantChannelCategoryId: channelId,
  }),

  // Welcome settings
  welcomeSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    welcomeChannelId: channelId,
    welcomeMessage: Joi.string().max(2000).optional().allow('', null),
    welcomeCardEnabled: Joi.boolean().optional(),
    welcomeCardBackgroundUrl: Joi.string().uri().max(500).optional().allow(''),
    welcomeDmEnabled: Joi.boolean().optional(),
    welcomeDmMessage: Joi.string().max(2000).optional().allow('', null),
    autoRoleIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
    goodbyeChannelId: channelId,
    goodbyeMessage: Joi.string().max(2000).optional().allow('', null),
  }),

  // Audit log settings
  auditLogSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    logChannelId: channelId,
    logMessageEdits: Joi.boolean().optional(),
    logMessageDeletes: Joi.boolean().optional(),
    logRoleChanges: Joi.boolean().optional(),
    logChannelChanges: Joi.boolean().optional(),
    logMemberJoinLeave: Joi.boolean().optional(),
    ignoredChannelIds: Joi.array().items(Joi.string().regex(/^\d+$/)).optional(),
  }),

  assistantRoles: Joi.object({
    assistantRoleIds: Joi.array()
      .items(
        Joi.string()
          .regex(/^\d{17,20}$/)
          .messages({ 'string.pattern.base': 'Each role ID must be a valid Discord snowflake' })
      )
      .max(25)
      .required(),
  }),

  // Server timezone (IANA format, e.g. 'America/New_York'). Empty string clears it.
  timezone: Joi.object({
    timezone: Joi.string()
      .trim()
      .max(64)
      .pattern(ianaTimezonePattern)
      .allow('')
      .required()
      .messages({
        'string.pattern.base':
          'Timezone must be a valid IANA identifier (e.g. America/New_York, UTC)',
      }),
  }),

  // Ticket quick response (POST body)
  quickResponseCreate: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    content: Joi.string().trim().min(1).max(2000).required(),
    categoryId: Joi.string().trim().max(100).optional().allow('', null),
  }),

  // Ticket quick response category (POST body)
  quickResponseCategoryCreate: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }),

  // Voice channel template (POST body) — fields accepted by the create endpoint
  voiceTemplateCreate: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).optional().allow(''),
    bitrate: Joi.number().integer().min(8000).max(384000).optional(),
    userLimit: Joi.number().integer().min(0).max(99).optional(),
    nameTemplate: Joi.string().trim().max(100).optional().allow(''),
    autoDelete: Joi.boolean().optional(),
  }),

  // RSI status panel deploy (POST body)
  rsiStatusPanelDeploy: Joi.object({
    channelId: requiredChannelId,
  }),

  // RSI status channel assignment (PATCH body)
  rsiStatusChannelAssign: Joi.object({
    channelId: requiredChannelId,
  }),

  // User-scoped Discord notification preferences (PATCH body)
  userPreferences: Joi.object({
    dmEnabled: Joi.boolean().optional(),
    lfgPingOptIn: Joi.boolean().optional(),
    eventReminderOptIn: Joi.boolean().optional(),
    ticketDmOptIn: Joi.boolean().optional(),
    recruitmentDmOptIn: Joi.boolean().optional(),
    moderationAlertOptIn: Joi.boolean().optional(),
    botResponseViaDm: Joi.boolean().optional(),
    timezone: Joi.string()
      .trim()
      .max(64)
      .pattern(ianaTimezonePattern)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base':
          'Timezone must be a valid IANA identifier (e.g. America/New_York, UTC)',
      }),
  }).min(1),

  // Stat tracking settings
  statSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    trackMessages: Joi.boolean().optional(),
    trackVoice: Joi.boolean().optional(),
    trackInvites: Joi.boolean().optional(),
    excludedChannelIds: Joi.array()
      .items(Joi.string().regex(/^\d{17,20}$/))
      .max(100)
      .optional(),
    excludedRoleIds: Joi.array()
      .items(Joi.string().regex(/^\d{17,20}$/))
      .max(100)
      .optional(),
    retentionDays: Joi.number().integer().min(1).max(3650).optional(),
    statRoleEvalIntervalHours: Joi.number().integer().min(1).max(168).optional(),
    counterUpdateIntervalMinutes: Joi.number().integer().min(1).max(1440).optional(),
  }).min(1),

  // DM notification settings
  dmNotificationSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    ticketCreated: Joi.boolean().optional(),
    ticketAssigned: Joi.boolean().optional(),
    ticketReplied: Joi.boolean().optional(),
    ticketClosed: Joi.boolean().optional(),
    ticketEscalated: Joi.boolean().optional(),
    recruitmentReceived: Joi.boolean().optional(),
    recruitmentAccepted: Joi.boolean().optional(),
    recruitmentDenied: Joi.boolean().optional(),
    eventReminder: Joi.boolean().optional(),
    eventCancelled: Joi.boolean().optional(),
    lfgPlayerJoined: Joi.boolean().optional(),
  }).min(1),

  // Smart LFG ping settings
  smartLfgPingSettings: Joi.object({
    enabled: Joi.boolean().optional(),
    cooldownHours: Joi.number().integer().min(0).max(168).optional(),
    maxPingsPerPost: Joi.number().integer().min(0).max(50).optional(),
    activityFilter: Joi.array().items(Joi.string().trim().max(50)).max(50).optional(),
    optInRoleId: Joi.string()
      .regex(/^\d{17,20}$/)
      .optional()
      .allow(''),
  }).min(1),

  // Giveaway settings
  giveawaySettings: Joi.object({
    enabled: Joi.boolean().optional(),
    maxActivegiveaways: Joi.number().integer().min(0).max(100).optional(),
    defaultDurationMinutes: Joi.number().integer().min(1).max(43200).optional(),
  }).min(1),

  // Advanced event settings
  advancedEventSettings: Joi.object({
    lockWhenFull: Joi.boolean().optional(),
    benchEnabled: Joi.boolean().optional(),
    maxBenchSlots: Joi.number().integer().min(0).max(1000).optional(),
    preventDuplicateRsvp: Joi.boolean().optional(),
    signupDeadlineHours: Joi.number().integer().min(0).max(720).optional(),
  }).min(1),
};
