"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordSettingsSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const _guildId = joi_1.default.string().regex(/^\d+$/).required().messages({
    'string.pattern.base': 'Guild ID must be a valid Discord ID',
});
const optionalGuildId = joi_1.default.string().regex(/^\d+$/).messages({
    'string.pattern.base': 'Guild ID must be a valid Discord ID',
});
const userId = joi_1.default.string().regex(/^\d+$/).required().messages({
    'string.pattern.base': 'User ID must be a valid Discord ID',
});
const roleIdItem = joi_1.default.string().regex(/^\d+$/).messages({
    'string.pattern.base': 'Role ID must be a valid Discord ID',
});
const roleId = roleIdItem.required();
const roleIdOrRoleIdArray = joi_1.default.alternatives().try(roleId, joi_1.default.array().items(roleIdItem).min(1).max(20));
const channelId = joi_1.default.string().regex(/^\d+$/).optional().allow(null);
const requiredChannelId = joi_1.default.string().regex(/^\d+$/).required().messages({
    'string.pattern.base': 'Channel ID must be a valid Discord ID',
});
const ianaTimezonePattern = /^(?:UTC|GMT|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;
exports.discordSettingsSchemas = {
    eventSettings: joi_1.default.object({
        eventAnnouncementChannelId: channelId,
        eventNotificationRoleId: roleId.optional().allow(null),
        eventNotificationRoleIds: joi_1.default.array().items(roleIdItem).optional(),
        enableEventMentions: joi_1.default.boolean().optional(),
        autoDeleteEventMessages: joi_1.default.boolean().optional(),
        eventMessageRetentionDays: joi_1.default.number().integer().min(1).max(365).optional(),
        allowEventRsvp: joi_1.default.boolean().optional(),
        remindersEnabled: joi_1.default.boolean().optional(),
        reminderHoursBefore: joi_1.default.array().items(joi_1.default.number().integer().min(1)).optional(),
        eventCreationRoleId: roleId.optional().allow(null),
        maxMirrorsPerActivity: joi_1.default.number().integer().min(0).max(50).optional(),
        tempRolesEnabled: joi_1.default.boolean().optional(),
        tempRoleColor: joi_1.default.number().integer().min(0).max(0xffffff).optional(),
        createDiscordEvent: joi_1.default.boolean().optional(),
        eventVoiceCategoryId: channelId,
        cleanupMode: joi_1.default.string().valid('afterEnd', 'afterComplete').optional(),
        cleanupHoursAfterEnd: joi_1.default.number().integer().min(1).max(8760).optional(),
        createEventThread: joi_1.default.boolean().optional(),
        autoPublishAnnouncements: joi_1.default.boolean().optional(),
        archiveChannelId: channelId,
        archiveAfterHours: joi_1.default.number().integer().min(1).max(8760).optional(),
        allowedRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        bannedRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
    }),
    voiceChannelSettings: joi_1.default.object({
        parentCategoryId: channelId,
        hubChannelId: channelId,
        hubChannelIds: joi_1.default.array().items(channelId).optional(),
        channelNameTemplate: joi_1.default.string().max(100).optional(),
        autoCreateChannels: joi_1.default.boolean().optional(),
        autoDeleteEmptyChannels: joi_1.default.boolean().optional(),
        deleteEmptyChannelDelayMinutes: joi_1.default.number().integer().min(0).max(1440).optional(),
        deleteEmptyChannelDelaySeconds: joi_1.default.number().integer().min(0).max(86400).optional(),
        maxActiveChannels: joi_1.default.number().integer().min(0).max(500).optional(),
        defaultUserLimit: joi_1.default.number().integer().min(0).max(99).optional(),
        bitrate: joi_1.default.number().integer().min(8000).max(384000).optional(),
        allowUserLimit: joi_1.default.boolean().optional(),
        channelPosition: joi_1.default.string().valid('top', 'bottom').optional(),
        interfaceMessageEnabled: joi_1.default.boolean().optional(),
        ownershipTransferEnabled: joi_1.default.boolean().optional(),
        templates: joi_1.default.array()
            .items(joi_1.default.object({
            id: joi_1.default.string().required(),
            name: joi_1.default.string().max(100).required(),
            description: joi_1.default.string().max(500).optional(),
            categoryId: channelId,
            bitrate: joi_1.default.number().min(8000).max(384000).optional(),
            userLimit: joi_1.default.number().integer().min(0).max(99).optional(),
            parentChannelId: channelId,
            tags: joi_1.default.array().items(joi_1.default.string()).optional(),
            enabled: joi_1.default.boolean().required(),
        }))
            .optional(),
        moderatorRoleId: roleId.optional().allow(null),
        userCanRename: joi_1.default.boolean().optional(),
    }),
    tunnelSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        tunnelCategoryId: channelId,
        maxActiveTunnels: joi_1.default.number().integer().min(1).max(100).optional(),
        tunnelDurationMinutes: joi_1.default.number().integer().min(5).max(1440).optional(),
        autoDeleteTunnel: joi_1.default.boolean().optional(),
        requireApprovalRoleId: roleId.optional().allow(null),
        tunnelCreatorRoleId: roleId.optional().allow(null),
        tunnelNotificationChannelId: channelId,
        allowNesting: joi_1.default.boolean().optional(),
    }),
    notificationPreferences: joi_1.default.object({
        announcementChannelId: channelId,
        pinnedAnnouncementChannelId: channelId,
        memberJoinNotifications: joi_1.default.boolean().optional(),
        memberJoinChannelId: channelId,
        memberLeaveNotifications: joi_1.default.boolean().optional(),
        memberLeaveChannelId: channelId,
        roleChangeNotifications: joi_1.default.boolean().optional(),
        roleChangeChannelId: channelId,
        eventNotifications: joi_1.default.boolean().optional(),
        eventNotificationChannelId: channelId,
        systemAlertChannelId: channelId,
        moderationAlertChannelId: channelId,
        auditLogChannelId: channelId,
        enableMentionRolesToNotify: joi_1.default.boolean().optional(),
        notificationMentionRoles: joi_1.default.array().items(roleIdItem).optional(),
        autoPublishAnnouncements: joi_1.default.boolean().optional(),
    }),
    roleSyncSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        syncRolesFromApi: joi_1.default.boolean().optional(),
        syncRolesFromSheet: joi_1.default.boolean().optional(),
        roleMappings: joi_1.default.object().pattern(joi_1.default.string(), roleIdOrRoleIdArray).optional(),
        autoRoleManagement: joi_1.default.boolean().optional(),
        removeRolesOnLeave: joi_1.default.boolean().optional(),
        syncIntervalMinutes: joi_1.default.number().integer().min(5).max(1440).optional(),
        syncOnBotJoin: joi_1.default.boolean().optional(),
        requireManualApproval: joi_1.default.boolean().optional(),
        approvalRoleId: roleId.optional().allow(null),
        verifiedRoleId: roleId.optional().allow(null),
        syncErrorNotificationChannelId: channelId,
        roleSyncMetadata: joi_1.default.object()
            .pattern(joi_1.default.string().regex(/^(?!(__proto__|constructor|prototype)$)/), joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.number(), joi_1.default.boolean(), joi_1.default.allow(null)))
            .max(50)
            .optional(),
    }),
    adminManagement: joi_1.default.object({
        userId: userId.required(),
    }),
    serverManagerManagement: joi_1.default.object({
        roleId: roleId.required(),
    }),
    starCommsManagerManagement: joi_1.default.object({
        roleId: roleId.required(),
    }),
    crossModerationSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        sharedBanListEnabled: joi_1.default.boolean().optional(),
        sharedMuteListEnabled: joi_1.default.boolean().optional(),
        autoBanOnSharedList: joi_1.default.boolean().optional(),
        propagateTimeouts: joi_1.default.boolean().optional(),
        forwardModerationAlerts: joi_1.default.boolean().optional(),
        notifyOnSharedAction: joi_1.default.boolean().optional(),
        banAppealsChannelId: channelId,
        crossGuildAuditLogChannelId: channelId,
        escalationRoleId: roleId.optional().allow(null),
        allowedGuildIds: joi_1.default.array().items(optionalGuildId).optional(),
    }),
    teamVoiceSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        allowBaseVisibility: joi_1.default.boolean().optional(),
        allowListenIn: joi_1.default.boolean().optional(),
        enforcePushToTalk: joi_1.default.boolean().optional(),
        enablePrioritySpeaker: joi_1.default.boolean().optional(),
        autoCreateOnTeamCreate: joi_1.default.boolean().optional(),
        autoDeleteOnTeamDelete: joi_1.default.boolean().optional(),
        parentCategoryId: channelId,
        baseAccessRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null).messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
    }),
    ticketSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        defaultCategoryId: channelId,
        transcriptChannelId: channelId,
        supportRoleId: roleId.optional().allow(null),
        escalationRoleId: roleId.optional().allow(null),
        formChannelId: channelId,
        autoCloseHours: joi_1.default.number().integer().min(1).max(168).optional(),
        maxOpenTicketsPerUser: joi_1.default.number().integer().min(1).max(20).optional(),
        mentionSupportRoleOnCreate: joi_1.default.boolean().optional(),
        notifyOnClose: joi_1.default.boolean().optional(),
        allowMemberClose: joi_1.default.boolean().optional(),
        blockedRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        requiredRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        roleMatchMode: joi_1.default.string().valid('any', 'all').optional(),
        rateSupportEnabled: joi_1.default.boolean().optional(),
        channelNameTemplate: joi_1.default.string().max(100).optional().allow('', null),
        ticketChannelEnabled: joi_1.default.boolean().optional(),
        ticketChannelCategoryId: joi_1.default.string()
            .regex(/^\d+$/)
            .optional()
            .allow('', null)
            .messages({ 'string.pattern.base': 'Category ID must be a valid Discord snowflake' }),
        quickResponseCategories: joi_1.default.array()
            .items(joi_1.default.object({ id: joi_1.default.string().required(), name: joi_1.default.string().max(100).required() }))
            .optional(),
        quickResponses: joi_1.default.array()
            .items(joi_1.default.object({
            id: joi_1.default.string().required(),
            name: joi_1.default.string().max(100).required(),
            content: joi_1.default.string().max(2000).required(),
            categoryId: joi_1.default.string().optional().allow(''),
        }))
            .optional(),
        supportServerGuildId: joi_1.default.string()
            .regex(/^\d+$/)
            .optional()
            .allow('', null)
            .messages({ 'string.pattern.base': 'Support server guild ID must be a valid Discord ID' }),
        supportWebhookUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .optional()
            .allow('', null),
        supportInviteUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .optional()
            .allow('', null),
    }),
    lfgSettings: joi_1.default.object({
        lfgChannelId: channelId,
        lfgVoiceCategoryId: channelId,
        autoPostEnabled: joi_1.default.boolean().optional(),
        autoLfgVoiceChannelScope: joi_1.default.string().valid('all', 'selected').optional(),
        autoLfgAllowedVoiceChannelIds: joi_1.default.array()
            .items(joi_1.default.string().regex(/^\d+$/).messages({
            'string.pattern.base': 'Channel ID must be a valid Discord ID',
        }))
            .max(100)
            .optional(),
        smartPingEnabled: joi_1.default.boolean().optional(),
        pingCooldownMinutes: joi_1.default.number().integer().min(1).max(1440).optional(),
        crossOrgEnabled: joi_1.default.boolean().optional(),
        crossOrgAllowList: joi_1.default.array()
            .items(joi_1.default.string()
            .max(100)
            .messages({ 'string.max': 'Each organization ID must be at most 100 characters' }))
            .max(50)
            .optional(),
        crossOrgBlockList: joi_1.default.array()
            .items(joi_1.default.string()
            .max(100)
            .messages({ 'string.max': 'Each organization ID must be at most 100 characters' }))
            .max(50)
            .optional(),
        crossOrgManualAllowTags: joi_1.default.array()
            .items(joi_1.default.string()
            .trim()
            .uppercase()
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/)
            .messages({
            'string.max': 'RSI tag must be at most 20 characters',
            'string.pattern.base': 'RSI tag must contain only letters, numbers, hyphens, or underscores',
        }))
            .max(50)
            .optional(),
        crossOrgManualBlockTags: joi_1.default.array()
            .items(joi_1.default.string()
            .trim()
            .uppercase()
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/)
            .messages({
            'string.max': 'RSI tag must be at most 20 characters',
            'string.pattern.base': 'RSI tag must contain only letters, numbers, hyphens, or underscores',
        }))
            .max(50)
            .optional(),
        region: joi_1.default.string().max(50).optional().allow(''),
        language: joi_1.default.string().max(50).optional().allow(''),
        roleFilterMappings: joi_1.default.alternatives()
            .try(joi_1.default.object().pattern(joi_1.default.string()
            .regex(/^(?!(__proto__|constructor|prototype)$)/)
            .max(100), joi_1.default.string().regex(/^\d+$/)), joi_1.default.string().max(2000).allow(''))
            .optional(),
        defaultGame: joi_1.default.string().max(100).optional().allow(''),
        gameFilters: joi_1.default.alternatives()
            .try(joi_1.default.string().max(500).allow(''), joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20))
            .optional(),
        otherGamesChannelId: channelId,
        publicLfgEnabled: joi_1.default.boolean().optional(),
        publicLfgDelivery: joi_1.default.string().valid('dm', 'channel').optional(),
        publicLfgChannelId: channelId,
        publicLfgOptInRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        lfgMentionRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        publicLfgGuildAllowList: joi_1.default.array()
            .items(joi_1.default.string()
            .regex(/^\d{17,20}$/)
            .messages({ 'string.pattern.base': 'Each entry must be a valid Discord guild ID' }))
            .max(50)
            .optional(),
    }),
    recruitmentSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        applicationChannelId: channelId,
        acceptRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        denyRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        pendingRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        staffPingRoleId: joi_1.default.string().regex(/^\d+$/).optional().allow(null, '').messages({
            'string.pattern.base': 'Role ID must be a valid Discord ID',
        }),
        staffThreadChannelId: channelId,
        reapplyCooldownDays: joi_1.default.number().integer().min(0).max(365).optional(),
        requireDiscordVerification: joi_1.default.boolean().optional(),
        autoAssignRole: joi_1.default.boolean().optional(),
        welcomeMessage: joi_1.default.string().max(2000).optional().allow(''),
        deniedMessage: joi_1.default.string().max(2000).optional().allow(''),
        confirmationMessage: joi_1.default.string().max(2000).optional().allow(''),
        completionMessage: joi_1.default.string().max(2000).optional().allow(''),
        inviteFormEnabled: joi_1.default.boolean().optional(),
        inviteFormBindingCode: joi_1.default.string().max(50).optional().allow('', null),
        discordInviteUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .regex(/^https:\/\/(discord\.gg|discord\.com)\//i)
            .max(200)
            .optional()
            .allow(null, '')
            .messages({
            'string.pattern.base': 'Invite URL must be a valid Discord invite link (https://discord.gg/... or https://discord.com/...)',
        }),
        autoResolveOnRoleChange: joi_1.default.boolean().optional(),
        restrictedRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        requiredRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        requiredRoleMatchMode: joi_1.default.string().valid('any', 'all').optional(),
        acceptedRemovalRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        deniedRemovalRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        removeRolesOnSubmit: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        acceptedChannelId: channelId,
        deniedChannelId: channelId,
        pendingChannelId: channelId,
        applicationTimeLimitMinutes: joi_1.default.number().integer().min(0).max(525600).optional().allow(null),
        actionOnApplicantLeave: joi_1.default.string()
            .valid('nothing', 'withdraw', 'notify', 'archive')
            .optional(),
        applicantChannelEnabled: joi_1.default.boolean().optional(),
        applicantChannelCategoryId: channelId,
    }),
    welcomeSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        welcomeChannelId: channelId,
        welcomeMessage: joi_1.default.string().max(2000).optional().allow('', null),
        welcomeCardEnabled: joi_1.default.boolean().optional(),
        welcomeCardBackgroundUrl: joi_1.default.string().uri().max(500).optional().allow(''),
        welcomeDmEnabled: joi_1.default.boolean().optional(),
        welcomeDmMessage: joi_1.default.string().max(2000).optional().allow('', null),
        autoRoleIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
        goodbyeChannelId: channelId,
        goodbyeMessage: joi_1.default.string().max(2000).optional().allow('', null),
    }),
    auditLogSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        logChannelId: channelId,
        logMessageEdits: joi_1.default.boolean().optional(),
        logMessageDeletes: joi_1.default.boolean().optional(),
        logRoleChanges: joi_1.default.boolean().optional(),
        logChannelChanges: joi_1.default.boolean().optional(),
        logMemberJoinLeave: joi_1.default.boolean().optional(),
        ignoredChannelIds: joi_1.default.array().items(joi_1.default.string().regex(/^\d+$/)).optional(),
    }),
    assistantRoles: joi_1.default.object({
        assistantRoleIds: joi_1.default.array()
            .items(joi_1.default.string()
            .regex(/^\d{17,20}$/)
            .messages({ 'string.pattern.base': 'Each role ID must be a valid Discord snowflake' }))
            .max(25)
            .required(),
    }),
    timezone: joi_1.default.object({
        timezone: joi_1.default.string()
            .trim()
            .max(64)
            .pattern(ianaTimezonePattern)
            .allow('')
            .required()
            .messages({
            'string.pattern.base': 'Timezone must be a valid IANA identifier (e.g. America/New_York, UTC)',
        }),
    }),
    quickResponseCreate: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        content: joi_1.default.string().trim().min(1).max(2000).required(),
        categoryId: joi_1.default.string().trim().max(100).optional().allow('', null),
    }),
    quickResponseCategoryCreate: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    voiceTemplateCreate: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        description: joi_1.default.string().trim().max(500).optional().allow(''),
        bitrate: joi_1.default.number().integer().min(8000).max(384000).optional(),
        userLimit: joi_1.default.number().integer().min(0).max(99).optional(),
        nameTemplate: joi_1.default.string().trim().max(100).optional().allow(''),
        autoDelete: joi_1.default.boolean().optional(),
    }),
    rsiStatusPanelDeploy: joi_1.default.object({
        channelId: requiredChannelId,
    }),
    rsiStatusChannelAssign: joi_1.default.object({
        channelId: requiredChannelId,
    }),
    userPreferences: joi_1.default.object({
        dmEnabled: joi_1.default.boolean().optional(),
        lfgPingOptIn: joi_1.default.boolean().optional(),
        eventReminderOptIn: joi_1.default.boolean().optional(),
        ticketDmOptIn: joi_1.default.boolean().optional(),
        recruitmentDmOptIn: joi_1.default.boolean().optional(),
        moderationAlertOptIn: joi_1.default.boolean().optional(),
        botResponseViaDm: joi_1.default.boolean().optional(),
        timezone: joi_1.default.string()
            .trim()
            .max(64)
            .pattern(ianaTimezonePattern)
            .allow('')
            .optional()
            .messages({
            'string.pattern.base': 'Timezone must be a valid IANA identifier (e.g. America/New_York, UTC)',
        }),
    }).min(1),
    statSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        trackMessages: joi_1.default.boolean().optional(),
        trackVoice: joi_1.default.boolean().optional(),
        trackInvites: joi_1.default.boolean().optional(),
        excludedChannelIds: joi_1.default.array()
            .items(joi_1.default.string().regex(/^\d{17,20}$/))
            .max(100)
            .optional(),
        excludedRoleIds: joi_1.default.array()
            .items(joi_1.default.string().regex(/^\d{17,20}$/))
            .max(100)
            .optional(),
        retentionDays: joi_1.default.number().integer().min(1).max(3650).optional(),
        statRoleEvalIntervalHours: joi_1.default.number().integer().min(1).max(168).optional(),
        counterUpdateIntervalMinutes: joi_1.default.number().integer().min(1).max(1440).optional(),
    }).min(1),
    dmNotificationSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        ticketCreated: joi_1.default.boolean().optional(),
        ticketAssigned: joi_1.default.boolean().optional(),
        ticketReplied: joi_1.default.boolean().optional(),
        ticketClosed: joi_1.default.boolean().optional(),
        ticketEscalated: joi_1.default.boolean().optional(),
        recruitmentReceived: joi_1.default.boolean().optional(),
        recruitmentAccepted: joi_1.default.boolean().optional(),
        recruitmentDenied: joi_1.default.boolean().optional(),
        eventReminder: joi_1.default.boolean().optional(),
        eventCancelled: joi_1.default.boolean().optional(),
        lfgPlayerJoined: joi_1.default.boolean().optional(),
    }).min(1),
    smartLfgPingSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        cooldownHours: joi_1.default.number().integer().min(0).max(168).optional(),
        maxPingsPerPost: joi_1.default.number().integer().min(0).max(50).optional(),
        activityFilter: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(50).optional(),
        optInRoleId: joi_1.default.string()
            .regex(/^\d{17,20}$/)
            .optional()
            .allow(''),
    }).min(1),
    giveawaySettings: joi_1.default.object({
        enabled: joi_1.default.boolean().optional(),
        maxActivegiveaways: joi_1.default.number().integer().min(0).max(100).optional(),
        defaultDurationMinutes: joi_1.default.number().integer().min(1).max(43200).optional(),
    }).min(1),
    advancedEventSettings: joi_1.default.object({
        lockWhenFull: joi_1.default.boolean().optional(),
        benchEnabled: joi_1.default.boolean().optional(),
        maxBenchSlots: joi_1.default.number().integer().min(0).max(1000).optional(),
        preventDuplicateRsvp: joi_1.default.boolean().optional(),
        signupDeadlineHours: joi_1.default.number().integer().min(0).max(720).optional(),
    }).min(1),
};
//# sourceMappingURL=discordSchemas.js.map