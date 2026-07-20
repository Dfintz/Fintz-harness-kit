"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.federationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const imageUrl = joi_1.default.string()
    .trim()
    .max(500)
    .custom((value, helpers) => {
    if (value.startsWith('/')) {
        return value;
    }
    const { error } = joi_1.default.string().uri().validate(value);
    if (error) {
        return helpers.error('string.uri');
    }
    return value;
}, 'image URL (absolute URI or server-relative path)');
const FEDERATION_ROLES = ['founder', 'leader', 'council', 'member', 'observer'];
const FEDERATION_STATUSES = ['forming', 'active', 'dissolved'];
const VOTING_SYSTEMS = ['majority', 'supermajority', 'unanimous', 'weighted'];
const PROPOSAL_TYPES = [
    'add_member',
    'remove_member',
    'amend_governance',
    'add_treaty',
    'declare_war',
    'dissolve',
    'custom',
];
const PROPOSAL_STATUSES = ['open', 'passed', 'rejected', 'expired'];
const VOTE_CHOICES = ['approve', 'reject', 'abstain'];
const RESOURCE_TYPES = ['fleet', 'intel', 'routes', 'discord', 'infrastructure', 'other'];
const RESOURCE_ACCESS_LEVELS = ['all', 'council', 'leaders'];
const ASSOCIATION_TYPES = ['full_member', 'associate', 'cooperative', 'affiliate'];
const MEMBER_ACTION_DECISION_METHODS = [
    'chairman_decides',
    'majority_vote',
    'unanimous_vote',
];
const TREATY_TYPES = [
    'mutual_defense',
    'trade',
    'resource_sharing',
    'non_aggression',
    'custom',
];
const AMBASSADOR_ROLES = ['council', 'representative', 'observer'];
const AMBASSADOR_PERMISSIONS = [
    'vote',
    'announce',
    'intel',
    'wiki',
    'resources',
    'hr',
    'settings',
    'view',
];
const governanceSchema = joi_1.default.object({
    votingSystem: joi_1.default.string()
        .valid(...VOTING_SYSTEMS)
        .optional(),
    requiredApprovalThreshold: joi_1.default.number().integer().min(1).max(100).optional(),
    councilSize: joi_1.default.number().integer().min(1).max(50).optional(),
    leaderTermDays: joi_1.default.number().integer().min(1).max(3650).optional(),
    amendmentThreshold: joi_1.default.number().integer().min(1).max(100).optional(),
    memberActionRules: joi_1.default.object({
        inviteDecisionMethod: joi_1.default.string()
            .valid(...MEMBER_ACTION_DECISION_METHODS)
            .optional(),
        kickDecisionMethod: joi_1.default.string()
            .valid(...MEMBER_ACTION_DECISION_METHODS)
            .optional(),
        warDeclarationDecisionMethod: joi_1.default.string()
            .valid(...MEMBER_ACTION_DECISION_METHODS)
            .optional(),
    }).optional(),
});
exports.federationSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).required().messages({
            'string.empty': 'Federation name is required',
            'string.min': 'Federation name must be at least 3 characters',
            'any.required': 'Federation name is required',
        }),
        description: joi_1.default.string().trim().min(10).max(2000).required().messages({
            'string.empty': 'Description is required',
            'string.min': 'Description must be at least 10 characters',
            'any.required': 'Description is required',
        }),
        isPublic: joi_1.default.boolean().default(false),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        governance: governanceSchema.optional(),
        logoUrl: imageUrl.optional().allow(null),
        bannerUrl: imageUrl.optional().allow(null),
        discordUrl: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        websiteUrl: joi_1.default.string().uri().trim().max(500).optional().allow(null),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).optional(),
        description: joi_1.default.string().trim().min(10).max(2000).optional(),
        isPublic: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        governance: governanceSchema.optional(),
        logoUrl: imageUrl.optional().allow(null),
        bannerUrl: imageUrl.optional().allow(null),
        discordUrl: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        websiteUrl: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        reviewDate: joi_1.default.string().isoDate().optional().allow(null),
        expiryDate: joi_1.default.string().isoDate().optional().allow(null),
        autoRenew: joi_1.default.boolean().optional(),
    }),
    updateSettings: joi_1.default.object({
        enableTitlesBadges: joi_1.default.boolean().optional(),
        enableFederationFleets: joi_1.default.boolean().optional(),
        enableFederationDynamicTeams: joi_1.default.boolean().optional(),
        allowSelfApplication: joi_1.default.boolean().optional(),
        requireApproval: joi_1.default.boolean().optional(),
        applicationQuestions: joi_1.default.array().items(common_1.applicationQuestionSchema).max(20).optional(),
        enableCentralDiscord: joi_1.default.boolean().optional(),
        autoCreateOrgRoles: joi_1.default.boolean().optional(),
        removeRolesOnOrgLeave: joi_1.default.boolean().optional(),
        removeRolesOnUserLeave: joi_1.default.boolean().optional(),
        conflictResolutionMode: joi_1.default.string().valid('manual', 'primary_org').optional(),
        syncNotificationChannelId: joi_1.default.string().trim().max(100).optional().allow(null, ''),
        kickNonMembers: joi_1.default.boolean().optional(),
    })
        .min(1)
        .messages({
        'object.min': 'At least one setting must be provided',
    }),
    inviteMember: joi_1.default.object({
        targetOrgId: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({ 'any.required': 'Target organization ID is required' }),
        targetOrgName: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .messages({ 'any.required': 'Target organization name is required' }),
        role: joi_1.default.string()
            .valid(...FEDERATION_ROLES)
            .default('member'),
        associationType: joi_1.default.string()
            .valid(...ASSOCIATION_TYPES)
            .default('full_member'),
    }),
    updateMemberRole: joi_1.default.object({
        role: joi_1.default.string()
            .valid(...FEDERATION_ROLES)
            .required()
            .messages({ 'any.required': 'Role is required' }),
    }),
    createProposal: joi_1.default.object({
        type: joi_1.default.string()
            .valid(...PROPOSAL_TYPES)
            .required()
            .messages({ 'any.required': 'Proposal type is required' }),
        title: joi_1.default.string().trim().min(3).max(200).required().messages({
            'string.empty': 'Proposal title is required',
            'any.required': 'Proposal title is required',
        }),
        description: joi_1.default.string().trim().min(10).max(5000).required().messages({
            'string.empty': 'Proposal description is required',
            'any.required': 'Proposal description is required',
        }),
        votingDurationDays: joi_1.default.number().integer().min(1).max(30).default(7),
        metadata: joi_1.default.object().optional(),
    }),
    castVote: joi_1.default.object({
        vote: joi_1.default.string()
            .valid(...VOTE_CHOICES)
            .required()
            .messages({ 'any.required': 'Vote choice is required' }),
        comment: joi_1.default.string().trim().max(1000).optional(),
    }),
    addResource: joi_1.default.object({
        name: joi_1.default.string()
            .trim()
            .min(2)
            .max(200)
            .required()
            .messages({ 'any.required': 'Resource name is required' }),
        type: joi_1.default.string()
            .valid(...RESOURCE_TYPES)
            .required()
            .messages({ 'any.required': 'Resource type is required' }),
        accessLevel: joi_1.default.string()
            .valid(...RESOURCE_ACCESS_LEVELS)
            .default('all'),
        description: joi_1.default.string()
            .trim()
            .min(5)
            .max(2000)
            .required()
            .messages({ 'any.required': 'Resource description is required' }),
    }),
    createTreaty: joi_1.default.object({
        name: joi_1.default.string()
            .trim()
            .min(3)
            .max(200)
            .required()
            .messages({ 'any.required': 'Treaty name is required' }),
        type: joi_1.default.string()
            .valid(...TREATY_TYPES)
            .required()
            .messages({ 'any.required': 'Treaty type is required' }),
        terms: joi_1.default.array()
            .items(joi_1.default.string().trim().min(5).max(1000))
            .min(1)
            .max(50)
            .required()
            .messages({
            'array.min': 'At least one treaty term is required',
            'any.required': 'Treaty terms are required',
        }),
        effectiveDate: joi_1.default.date().iso().optional(),
        expirationDate: joi_1.default.date().iso().greater(joi_1.default.ref('effectiveDate')).optional(),
    }),
    respondToTreaty: joi_1.default.object({
        action: joi_1.default.string()
            .valid('sign', 'reject')
            .required()
            .messages({ 'any.required': 'Action (sign or reject) is required' }),
    }),
    publicDirectoryQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        search: joi_1.default.string().trim().max(200).optional(),
        tags: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)), joi_1.default.string().trim().min(1).max(50))
            .optional(),
        sortBy: joi_1.default.string().valid('name', 'memberCount', 'createdAt').default('memberCount'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        minMembers: joi_1.default.number().integer().min(0).optional(),
        maxMembers: joi_1.default.number().integer().min(0).optional(),
    }),
    federationIdParam: joi_1.default.object({
        id: common_1.uuid,
    }),
    proposalIdParam: joi_1.default.object({
        proposalId: common_1.uuid,
    }),
    memberIdParam: joi_1.default.object({
        memberId: common_1.uuid,
    }),
    resourceIdParam: joi_1.default.object({
        resourceId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    treatyIdParam: joi_1.default.object({
        treatyId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    slugParam: joi_1.default.object({
        slug: joi_1.default.string()
            .trim()
            .min(3)
            .max(120)
            .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .required()
            .messages({
            'string.pattern.base': 'Slug must be lowercase alphanumeric with hyphens only',
            'string.min': 'Slug must be at least 3 characters',
            'any.required': 'Slug parameter is required',
        }),
    }),
    listQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid(...FEDERATION_STATUSES)
            .optional(),
    }),
    searchQuery: joi_1.default.object({
        query: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .messages({ 'any.required': 'Search query is required' }),
        tags: joi_1.default.string().trim().max(500).optional(),
        minMembers: joi_1.default.number().integer().min(0).optional(),
        maxMembers: joi_1.default.number().integer().min(0).optional(),
        ...common_1.paginationKeys,
    }),
    proposalListQuery: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...PROPOSAL_STATUSES)
            .optional(),
        ...common_1.paginationKeys,
    }),
    appointAmbassador: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required().messages({
            'any.required': 'User ID is required',
        }),
        userName: joi_1.default.string().trim().min(1).max(200).required().messages({
            'any.required': 'User name is required',
        }),
        organizationId: joi_1.default.string().trim().min(1).max(100).required().messages({
            'any.required': 'Organization ID is required',
        }),
        organizationName: joi_1.default.string().trim().min(1).max(200).required().messages({
            'any.required': 'Organization name is required',
        }),
        role: joi_1.default.string()
            .valid(...AMBASSADOR_ROLES)
            .default('representative'),
        permissions: joi_1.default.array()
            .items(joi_1.default.string().valid(...AMBASSADOR_PERMISSIONS))
            .max(10)
            .optional()
            .default(['view']),
        title: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        isExternal: joi_1.default.boolean().optional().default(false),
    }),
    updateAmbassador: joi_1.default.object({
        role: joi_1.default.string()
            .valid(...AMBASSADOR_ROLES)
            .optional(),
        permissions: joi_1.default.array()
            .items(joi_1.default.string().valid(...AMBASSADOR_PERMISSIONS))
            .max(10)
            .optional(),
        title: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        isActive: joi_1.default.boolean().optional(),
    })
        .min(1)
        .messages({
        'object.min': 'At least one field must be provided to update',
    }),
    ambassadorIdParam: joi_1.default.object({
        ambId: common_1.uuid,
    }),
    createWikiPage: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(200).required().messages({
            'any.required': 'Wiki page title is required',
        }),
        content: joi_1.default.string().max(100000).optional().default(''),
        parentPageId: joi_1.default.string().uuid().optional().allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        visibility: joi_1.default.string().valid('public', 'members', 'council').default('members'),
    }),
    updateWikiPage: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(200).optional(),
        content: joi_1.default.string().max(100000).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        changeDescription: joi_1.default.string().trim().max(500).optional(),
        isLocked: joi_1.default.boolean().optional(),
        visibility: joi_1.default.string().valid('public', 'members', 'council').optional(),
    }).min(1),
    wikiPageIdParam: joi_1.default.object({
        pageId: common_1.uuid,
    }),
    createFederationAnnouncement: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(256).required().messages({
            'any.required': 'Announcement title is required',
            'string.min': 'Announcement title must be at least 3 characters',
        }),
        content: joi_1.default.string().trim().min(10).max(5000).required().messages({
            'any.required': 'Announcement content is required',
            'string.min': 'Announcement content must be at least 10 characters',
        }),
        targetAudience: joi_1.default.string().valid('all-members', 'council', 'public').default('all-members'),
    }),
    announcementIdParam: joi_1.default.object({
        announcementId: common_1.uuid,
    }),
    postFederationAnnouncementToDiscord: joi_1.default.object({
        channelId: joi_1.default.string().trim().min(1).max(20).required().messages({
            'any.required': 'Discord channel ID is required',
        }),
    }),
    createFederationPoll: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required().messages({
            'any.required': 'Poll title is required',
        }),
        description: joi_1.default.string().trim().max(2000).optional(),
        pollType: joi_1.default.string()
            .valid('single_choice', 'multiple_choice', 'ranked', 'approval')
            .default('single_choice'),
        options: joi_1.default.array()
            .items(joi_1.default.object({
            label: joi_1.default.string().trim().min(1).max(200).required(),
            description: joi_1.default.string().trim().max(500).optional(),
        }))
            .min(2)
            .max(20)
            .required()
            .messages({ 'array.min': 'At least 2 options are required' }),
        votingMode: joi_1.default.string().valid('equal', 'weighted').default('equal'),
        isAnonymous: joi_1.default.boolean().default(false),
        maxSelections: joi_1.default.number().integer().min(1).max(20).default(1),
        endsAt: joi_1.default.string().isoDate().optional(),
    }),
    castFederationVote: joi_1.default.object({
        optionId: joi_1.default.string().trim().min(1).required().messages({
            'any.required': 'Option ID is required',
        }),
    }),
    pollIdParam: joi_1.default.object({
        pollId: common_1.uuid,
    }),
    postFederationPollToDiscord: joi_1.default.object({
        channelId: joi_1.default.string().trim().min(1).max(20).required().messages({
            'any.required': 'Discord channel ID is required',
        }),
    }),
    createFederationTeam: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(100).required().messages({
            'any.required': 'Team name is required',
        }),
        description: joi_1.default.string().trim().max(2000).optional(),
        type: joi_1.default.string()
            .valid('task_force', 'diplomatic_mission', 'joint_operation', 'trade_convoy', 'custom')
            .default('task_force'),
        maxMembers: joi_1.default.number().integer().min(2).max(100).default(20),
        leaderId: joi_1.default.string().trim().max(100).optional(),
        leaderName: joi_1.default.string().trim().max(200).optional(),
        leaderOrgId: joi_1.default.string().trim().max(100).optional(),
    }),
    updateFederationTeam: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(100).optional(),
        description: joi_1.default.string().trim().max(2000).optional().allow(null),
        type: joi_1.default.string()
            .valid('task_force', 'diplomatic_mission', 'joint_operation', 'trade_convoy', 'custom')
            .optional(),
        maxMembers: joi_1.default.number().integer().min(2).max(100).optional(),
        leaderId: joi_1.default.string().trim().max(100).optional().allow(null),
        leaderName: joi_1.default.string().trim().max(200).optional().allow(null),
        leaderOrgId: joi_1.default.string().trim().max(100).optional().allow(null),
        status: joi_1.default.string().valid('active', 'disbanded').optional(),
    }).min(1),
    addTeamMember: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
        userName: joi_1.default.string().trim().min(1).max(200).required(),
        organizationId: joi_1.default.string().trim().min(1).max(100).required(),
        organizationName: joi_1.default.string().trim().min(1).max(200).required(),
        role: joi_1.default.string().trim().max(100).optional().default('member'),
    }),
    teamIdParam: joi_1.default.object({
        teamId: common_1.uuid,
    }),
    memberUserIdParam: joi_1.default.object({
        memberUserId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    submitFederationIntel: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required().messages({
            'any.required': 'Intel title is required',
        }),
        content: joi_1.default.string().trim().min(10).max(10000).required().messages({
            'any.required': 'Intel content is required',
        }),
        classification: joi_1.default.string().valid('open', 'restricted', 'secret').default('open'),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        visibleToTreaties: joi_1.default.array().items(joi_1.default.string().uuid()).max(50).optional(),
    }),
    updateFederationIntel: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        content: joi_1.default.string().trim().min(10).max(10000).optional(),
        classification: joi_1.default.string().valid('open', 'restricted', 'secret').optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        visibleToTreaties: joi_1.default.array().items(joi_1.default.string().uuid()).max(50).optional(),
    }).min(1),
    intelIdParam: joi_1.default.object({
        intelId: common_1.uuid,
    }),
    submitFederationApplication: joi_1.default.object({
        message: joi_1.default.string().max(1000).optional().allow(''),
        formResponses: joi_1.default.object().pattern(joi_1.default.string().uuid(), joi_1.default.string().max(2000)).optional(),
        source: joi_1.default.string().valid('web', 'discord', 'api').optional(),
    }),
    reviewFederationApplication: joi_1.default.object({
        decision: joi_1.default.string().valid('approved', 'rejected').required(),
        note: joi_1.default.string().max(500).optional().allow(''),
    }),
    appIdParam: joi_1.default.object({
        appId: common_1.uuid,
    }),
    setupFederationDiscord: joi_1.default.object({
        guildId: joi_1.default.string().trim().min(1).max(30).required().messages({
            'any.required': 'Discord guild ID is required',
        }),
        guildName: joi_1.default.string().trim().min(1).max(200).required().messages({
            'any.required': 'Discord guild name is required',
        }),
    }),
    resolveDiscordConflict: joi_1.default.object({
        chosenOrgId: joi_1.default.string().trim().min(1).max(100).required().messages({
            'any.required': 'Chosen organization ID is required',
        }),
    }),
    syncDiscordUser: joi_1.default.object({
        discordUserId: joi_1.default.string().trim().min(1).max(30).required().messages({
            'any.required': 'Discord user ID is required',
        }),
    }),
    guildIdParam: joi_1.default.object({
        id: common_1.uuid,
        guildId: joi_1.default.string()
            .regex(/^\d{17,20}$/)
            .required()
            .messages({
            'string.pattern.base': 'Guild ID must be a valid Discord snowflake',
        }),
    }),
};
//# sourceMappingURL=federationSchemas.js.map