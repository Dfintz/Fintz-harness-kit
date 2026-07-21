import Joi from 'joi';

import { applicationQuestionSchema, paginationKeys, uuid } from './common';

/**
 * Image URL validator: accepts a full absolute URI (https://...) or a
 * server-relative path (/api/v2/images/download/..., /uploads/...) so
 * that locally-stored images pass validation.
 */
const imageUrl = Joi.string()
  .trim()
  .max(500)
  .custom((value: string, helpers) => {
    if (value.startsWith('/')) {
      return value;
    }
    // Delegate to Joi's built-in URI check for absolute URLs
    const { error } = Joi.string().uri().validate(value);
    if (error) {
      return helpers.error('string.uri');
    }
    return value;
  }, 'image URL (absolute URI or server-relative path)');

/**
 * Federation Validation Schemas
 *
 * Validation for federation (alliance) creation, management,
 * governance, proposals, resources, treaties, and public directory.
 */

// ─── Reusable constants ────────────────────────────────────────

const FEDERATION_ROLES = ['founder', 'leader', 'council', 'member', 'observer'] as const;
const FEDERATION_STATUSES = ['forming', 'active', 'dissolved'] as const;
const VOTING_SYSTEMS = ['majority', 'supermajority', 'unanimous', 'weighted'] as const;
const PROPOSAL_TYPES = [
  'add_member',
  'remove_member',
  'amend_governance',
  'add_treaty',
  'declare_war',
  'dissolve',
  'custom',
] as const;
const PROPOSAL_STATUSES = ['open', 'passed', 'rejected', 'expired'] as const;
const VOTE_CHOICES = ['approve', 'reject', 'abstain'] as const;
const RESOURCE_TYPES = ['fleet', 'intel', 'routes', 'discord', 'infrastructure', 'other'] as const;
const RESOURCE_ACCESS_LEVELS = ['all', 'council', 'leaders'] as const;
const ASSOCIATION_TYPES = ['full_member', 'associate', 'cooperative', 'affiliate'] as const;
const MEMBER_ACTION_DECISION_METHODS = [
  'chairman_decides',
  'majority_vote',
  'unanimous_vote',
] as const;
const TREATY_TYPES = [
  'mutual_defense',
  'trade',
  'resource_sharing',
  'non_aggression',
  'custom',
] as const;

const AMBASSADOR_ROLES = ['council', 'representative', 'observer'] as const;
const AMBASSADOR_PERMISSIONS = [
  'vote',
  'announce',
  'intel',
  'wiki',
  'resources',
  'hr',
  'settings',
  'view',
] as const;

// ─── Sub-schemas ───────────────────────────────────────────────

const governanceSchema = Joi.object({
  votingSystem: Joi.string()
    .valid(...VOTING_SYSTEMS)
    .optional(),
  requiredApprovalThreshold: Joi.number().integer().min(1).max(100).optional(),
  councilSize: Joi.number().integer().min(1).max(50).optional(),
  leaderTermDays: Joi.number().integer().min(1).max(3650).optional(),
  amendmentThreshold: Joi.number().integer().min(1).max(100).optional(),
  memberActionRules: Joi.object({
    inviteDecisionMethod: Joi.string()
      .valid(...MEMBER_ACTION_DECISION_METHODS)
      .optional(),
    kickDecisionMethod: Joi.string()
      .valid(...MEMBER_ACTION_DECISION_METHODS)
      .optional(),
    warDeclarationDecisionMethod: Joi.string()
      .valid(...MEMBER_ACTION_DECISION_METHODS)
      .optional(),
  }).optional(),
});

// ─── Exported Schema Object ───────────────────────────────────

export const federationSchemas = {
  // ── Federation CRUD ──────────────────────────────────────────

  /** POST /federations */
  create: Joi.object({
    name: Joi.string().trim().min(3).max(100).required().messages({
      'string.empty': 'Federation name is required',
      'string.min': 'Federation name must be at least 3 characters',
      'any.required': 'Federation name is required',
    }),
    description: Joi.string().trim().min(10).max(2000).required().messages({
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 10 characters',
      'any.required': 'Description is required',
    }),
    isPublic: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    governance: governanceSchema.optional(),
    logoUrl: imageUrl.optional().allow(null),
    bannerUrl: imageUrl.optional().allow(null),
    discordUrl: Joi.string().uri().trim().max(500).optional().allow(null),
    websiteUrl: Joi.string().uri().trim().max(500).optional().allow(null),
  }),

  /** PUT /federations/:id */
  update: Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    description: Joi.string().trim().min(10).max(2000).optional(),
    isPublic: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    governance: governanceSchema.optional(),
    logoUrl: imageUrl.optional().allow(null),
    bannerUrl: imageUrl.optional().allow(null),
    discordUrl: Joi.string().uri().trim().max(500).optional().allow(null),
    websiteUrl: Joi.string().uri().trim().max(500).optional().allow(null),
    reviewDate: Joi.string().isoDate().optional().allow(null),
    expiryDate: Joi.string().isoDate().optional().allow(null),
    autoRenew: Joi.boolean().optional(),
  }),

  /** PUT /federations/:id/settings */
  updateSettings: Joi.object({
    enableTitlesBadges: Joi.boolean().optional(),
    enableFederationFleets: Joi.boolean().optional(),
    enableFederationDynamicTeams: Joi.boolean().optional(),
    allowSelfApplication: Joi.boolean().optional(),
    requireApproval: Joi.boolean().optional(),
    applicationQuestions: Joi.array().items(applicationQuestionSchema).max(20).optional(),
    enableCentralDiscord: Joi.boolean().optional(),
    autoCreateOrgRoles: Joi.boolean().optional(),
    removeRolesOnOrgLeave: Joi.boolean().optional(),
    removeRolesOnUserLeave: Joi.boolean().optional(),
    conflictResolutionMode: Joi.string().valid('manual', 'primary_org').optional(),
    syncNotificationChannelId: Joi.string().trim().max(100).optional().allow(null, ''),
    kickNonMembers: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one setting must be provided',
    }),

  // ── Member Management ────────────────────────────────────────

  /** POST /federations/:id/members/invite */
  inviteMember: Joi.object({
    targetOrgId: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({ 'any.required': 'Target organization ID is required' }),
    targetOrgName: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .messages({ 'any.required': 'Target organization name is required' }),
    role: Joi.string()
      .valid(...FEDERATION_ROLES)
      .default('member'),
    associationType: Joi.string()
      .valid(...ASSOCIATION_TYPES)
      .default('full_member'),
  }),

  /** PUT /federations/:id/members/:memberId/role */
  updateMemberRole: Joi.object({
    role: Joi.string()
      .valid(...FEDERATION_ROLES)
      .required()
      .messages({ 'any.required': 'Role is required' }),
  }),

  // ── Proposals & Voting ───────────────────────────────────────

  /** POST /federations/:id/proposals */
  createProposal: Joi.object({
    type: Joi.string()
      .valid(...PROPOSAL_TYPES)
      .required()
      .messages({ 'any.required': 'Proposal type is required' }),
    title: Joi.string().trim().min(3).max(200).required().messages({
      'string.empty': 'Proposal title is required',
      'any.required': 'Proposal title is required',
    }),
    description: Joi.string().trim().min(10).max(5000).required().messages({
      'string.empty': 'Proposal description is required',
      'any.required': 'Proposal description is required',
    }),
    votingDurationDays: Joi.number().integer().min(1).max(30).default(7),
    metadata: Joi.object().optional(),
  }),

  /** POST /federations/:id/proposals/:proposalId/vote */
  castVote: Joi.object({
    vote: Joi.string()
      .valid(...VOTE_CHOICES)
      .required()
      .messages({ 'any.required': 'Vote choice is required' }),
    comment: Joi.string().trim().max(1000).optional(),
  }),

  // ── Shared Resources ─────────────────────────────────────────

  /** POST /federations/:id/resources */
  addResource: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .required()
      .messages({ 'any.required': 'Resource name is required' }),
    type: Joi.string()
      .valid(...RESOURCE_TYPES)
      .required()
      .messages({ 'any.required': 'Resource type is required' }),
    accessLevel: Joi.string()
      .valid(...RESOURCE_ACCESS_LEVELS)
      .default('all'),
    description: Joi.string()
      .trim()
      .min(5)
      .max(2000)
      .required()
      .messages({ 'any.required': 'Resource description is required' }),
  }),

  // ── Treaties ─────────────────────────────────────────────────

  /** POST /federations/:id/treaties — creates a proposal */
  createTreaty: Joi.object({
    name: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .required()
      .messages({ 'any.required': 'Treaty name is required' }),
    type: Joi.string()
      .valid(...TREATY_TYPES)
      .required()
      .messages({ 'any.required': 'Treaty type is required' }),
    terms: Joi.array()
      .items(Joi.string().trim().min(5).max(1000))
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one treaty term is required',
        'any.required': 'Treaty terms are required',
      }),
    effectiveDate: Joi.date().iso().optional(),
    expirationDate: Joi.date().iso().greater(Joi.ref('effectiveDate')).optional(),
  }),

  /** POST /federations/:id/treaties/:treatyId/respond */
  respondToTreaty: Joi.object({
    action: Joi.string()
      .valid('sign', 'reject')
      .required()
      .messages({ 'any.required': 'Action (sign or reject) is required' }),
  }),

  // ── Public Directory Query ───────────────────────────────────

  /** GET /federations/public */
  publicDirectoryQuery: Joi.object({
    ...paginationKeys,
    search: Joi.string().trim().max(200).optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim().min(1).max(50)),
        Joi.string().trim().min(1).max(50)
      )
      .optional(),
    sortBy: Joi.string().valid('name', 'memberCount', 'createdAt').default('memberCount'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    minMembers: Joi.number().integer().min(0).optional(),
    maxMembers: Joi.number().integer().min(0).optional(),
  }),

  // ── Path / Query param validators ────────────────────────────

  /** :id param */
  federationIdParam: Joi.object({
    id: uuid,
  }),

  /** :proposalId param */
  proposalIdParam: Joi.object({
    proposalId: uuid,
  }),

  /** :memberId param */
  memberIdParam: Joi.object({
    memberId: uuid,
  }),

  /** :resourceId param */
  resourceIdParam: Joi.object({
    resourceId: Joi.string().trim().min(1).max(100).required(),
  }),

  /** :treatyId param */
  treatyIdParam: Joi.object({
    treatyId: Joi.string().trim().min(1).max(100).required(),
  }),

  /** :slug param — alphanumeric, hyphens, 3-120 chars */
  slugParam: Joi.object({
    slug: Joi.string()
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

  /** GET /federations (org-scoped list) */
  listQuery: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid(...FEDERATION_STATUSES)
      .optional(),
  }),

  /** GET /federations/search */
  searchQuery: Joi.object({
    query: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .messages({ 'any.required': 'Search query is required' }),
    tags: Joi.string().trim().max(500).optional(),
    minMembers: Joi.number().integer().min(0).optional(),
    maxMembers: Joi.number().integer().min(0).optional(),
    ...paginationKeys,
  }),

  /** GET /federations/:id/proposals */
  proposalListQuery: Joi.object({
    status: Joi.string()
      .valid(...PROPOSAL_STATUSES)
      .optional(),
    ...paginationKeys,
  }),

  // ── Ambassador Management ───────────────────────────────────

  /** POST /federations/:id/ambassadors — appoint an ambassador */
  appointAmbassador: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required().messages({
      'any.required': 'User ID is required',
    }),
    userName: Joi.string().trim().min(1).max(200).required().messages({
      'any.required': 'User name is required',
    }),
    organizationId: Joi.string().trim().min(1).max(100).required().messages({
      'any.required': 'Organization ID is required',
    }),
    organizationName: Joi.string().trim().min(1).max(200).required().messages({
      'any.required': 'Organization name is required',
    }),
    role: Joi.string()
      .valid(...AMBASSADOR_ROLES)
      .default('representative'),
    permissions: Joi.array()
      .items(Joi.string().valid(...AMBASSADOR_PERMISSIONS))
      .max(10)
      .optional()
      .default(['view']),
    title: Joi.string().trim().max(200).optional().allow(null, ''),
    isExternal: Joi.boolean().optional().default(false),
  }),

  /** PUT /federations/:id/ambassadors/:ambId — update ambassador */
  updateAmbassador: Joi.object({
    role: Joi.string()
      .valid(...AMBASSADOR_ROLES)
      .optional(),
    permissions: Joi.array()
      .items(Joi.string().valid(...AMBASSADOR_PERMISSIONS))
      .max(10)
      .optional(),
    title: Joi.string().trim().max(200).optional().allow(null, ''),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided to update',
    }),

  /** :ambId param */
  ambassadorIdParam: Joi.object({
    ambId: uuid,
  }),

  // ── Federation Wiki ──────────────────────────────────────────

  /** POST /federations/:id/wiki — create wiki page */
  createWikiPage: Joi.object({
    title: Joi.string().trim().min(1).max(200).required().messages({
      'any.required': 'Wiki page title is required',
    }),
    content: Joi.string().max(100000).optional().default(''),
    parentPageId: Joi.string().uuid().optional().allow(null),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    visibility: Joi.string().valid('public', 'members', 'council').default('members'),
  }),

  /** PUT /federations/:id/wiki/:pageId — update wiki page */
  updateWikiPage: Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    content: Joi.string().max(100000).optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    changeDescription: Joi.string().trim().max(500).optional(),
    isLocked: Joi.boolean().optional(),
    visibility: Joi.string().valid('public', 'members', 'council').optional(),
  }).min(1),

  /** :pageId param */
  wikiPageIdParam: Joi.object({
    pageId: uuid,
  }),

  // ── Federation Announcements ─────────────────────────────────

  /** POST /federations/:id/announcements — create announcement */
  createFederationAnnouncement: Joi.object({
    title: Joi.string().trim().min(3).max(256).required().messages({
      'any.required': 'Announcement title is required',
      'string.min': 'Announcement title must be at least 3 characters',
    }),
    content: Joi.string().trim().min(10).max(5000).required().messages({
      'any.required': 'Announcement content is required',
      'string.min': 'Announcement content must be at least 10 characters',
    }),
    targetAudience: Joi.string().valid('all-members', 'council', 'public').default('all-members'),
  }),

  /** :announcementId param */
  announcementIdParam: Joi.object({
    announcementId: uuid,
  }),

  /** POST /federations/:id/announcements/:announcementId/post */
  postFederationAnnouncementToDiscord: Joi.object({
    channelId: Joi.string().trim().min(1).max(20).required().messages({
      'any.required': 'Discord channel ID is required',
    }),
  }),

  // ── Federation Polls ─────────────────────────────────────────

  /** POST /federations/:id/polls — create poll */
  createFederationPoll: Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
      'any.required': 'Poll title is required',
    }),
    description: Joi.string().trim().max(2000).optional(),
    pollType: Joi.string()
      .valid('single_choice', 'multiple_choice', 'ranked', 'approval')
      .default('single_choice'),
    options: Joi.array()
      .items(
        Joi.object({
          label: Joi.string().trim().min(1).max(200).required(),
          description: Joi.string().trim().max(500).optional(),
        })
      )
      .min(2)
      .max(20)
      .required()
      .messages({ 'array.min': 'At least 2 options are required' }),
    votingMode: Joi.string().valid('equal', 'weighted').default('equal'),
    isAnonymous: Joi.boolean().default(false),
    maxSelections: Joi.number().integer().min(1).max(20).default(1),
    endsAt: Joi.string().isoDate().optional(),
  }),

  /** POST /federations/:id/polls/:pollId/vote — cast vote */
  castFederationVote: Joi.object({
    optionId: Joi.string().trim().min(1).required().messages({
      'any.required': 'Option ID is required',
    }),
  }),

  /** :pollId param */
  pollIdParam: Joi.object({
    pollId: uuid,
  }),

  /** POST /federations/:id/polls/:pollId/post */
  postFederationPollToDiscord: Joi.object({
    channelId: Joi.string().trim().min(1).max(20).required().messages({
      'any.required': 'Discord channel ID is required',
    }),
  }),

  // ── Federation Teams ─────────────────────────────────────────

  /** POST /federations/:id/teams — create team */
  createFederationTeam: Joi.object({
    name: Joi.string().trim().min(2).max(100).required().messages({
      'any.required': 'Team name is required',
    }),
    description: Joi.string().trim().max(2000).optional(),
    type: Joi.string()
      .valid('task_force', 'diplomatic_mission', 'joint_operation', 'trade_convoy', 'custom')
      .default('task_force'),
    maxMembers: Joi.number().integer().min(2).max(100).default(20),
    leaderId: Joi.string().trim().max(100).optional(),
    leaderName: Joi.string().trim().max(200).optional(),
    leaderOrgId: Joi.string().trim().max(100).optional(),
  }),

  /** PUT /federations/:id/teams/:teamId — update team */
  updateFederationTeam: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().trim().max(2000).optional().allow(null),
    type: Joi.string()
      .valid('task_force', 'diplomatic_mission', 'joint_operation', 'trade_convoy', 'custom')
      .optional(),
    maxMembers: Joi.number().integer().min(2).max(100).optional(),
    leaderId: Joi.string().trim().max(100).optional().allow(null),
    leaderName: Joi.string().trim().max(200).optional().allow(null),
    leaderOrgId: Joi.string().trim().max(100).optional().allow(null),
    status: Joi.string().valid('active', 'disbanded').optional(),
  }).min(1),

  /** POST /federations/:id/teams/:teamId/members — add member */
  addTeamMember: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
    userName: Joi.string().trim().min(1).max(200).required(),
    organizationId: Joi.string().trim().min(1).max(100).required(),
    organizationName: Joi.string().trim().min(1).max(200).required(),
    role: Joi.string().trim().max(100).optional().default('member'),
  }),

  /** :teamId param */
  teamIdParam: Joi.object({
    teamId: uuid,
  }),

  /** :memberUserId param */
  memberUserIdParam: Joi.object({
    memberUserId: Joi.string().trim().min(1).max(100).required(),
  }),

  // ── Federation Intel ─────────────────────────────────────────

  /** POST /federations/:id/intel — submit intel */
  submitFederationIntel: Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
      'any.required': 'Intel title is required',
    }),
    content: Joi.string().trim().min(10).max(10000).required().messages({
      'any.required': 'Intel content is required',
    }),
    classification: Joi.string().valid('open', 'restricted', 'secret').default('open'),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    visibleToTreaties: Joi.array().items(Joi.string().uuid()).max(50).optional(),
  }),

  /** PUT /federations/:id/intel/:intelId — update intel */
  updateFederationIntel: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    content: Joi.string().trim().min(10).max(10000).optional(),
    classification: Joi.string().valid('open', 'restricted', 'secret').optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    visibleToTreaties: Joi.array().items(Joi.string().uuid()).max(50).optional(),
  }).min(1),

  /** :intelId param */
  intelIdParam: Joi.object({
    intelId: uuid,
  }),

  // ── Federation Applications ──────────────────────────────────

  /** POST /federations/:id/applications — submit application */
  submitFederationApplication: Joi.object({
    message: Joi.string().max(1000).optional().allow(''),
    formResponses: Joi.object().pattern(Joi.string().uuid(), Joi.string().max(2000)).optional(),
    source: Joi.string().valid('web', 'discord', 'api').optional(),
  }),

  /** PUT /federations/:id/applications/:appId/review */
  reviewFederationApplication: Joi.object({
    decision: Joi.string().valid('approved', 'rejected').required(),
    note: Joi.string().max(500).optional().allow(''),
  }),

  /** :appId param */
  appIdParam: Joi.object({
    appId: uuid,
  }),

  // ── Federation Discord ──────────────────────────────────

  /** POST /federations/:id/discord/setup */
  setupFederationDiscord: Joi.object({
    guildId: Joi.string().trim().min(1).max(30).required().messages({
      'any.required': 'Discord guild ID is required',
    }),
    guildName: Joi.string().trim().min(1).max(200).required().messages({
      'any.required': 'Discord guild name is required',
    }),
  }),

  /** POST /federations/:id/discord/conflicts/:discordUserId/resolve */
  resolveDiscordConflict: Joi.object({
    chosenOrgId: Joi.string().trim().min(1).max(100).required().messages({
      'any.required': 'Chosen organization ID is required',
    }),
  }),

  /** POST /federations/:id/discord/sync-user */
  syncDiscordUser: Joi.object({
    discordUserId: Joi.string().trim().min(1).max(30).required().messages({
      'any.required': 'Discord user ID is required',
    }),
  }),

  // ── Federation Discord Guild Settings ───────────────────

  /** :guildId param (Discord snowflake) */
  guildIdParam: Joi.object({
    id: uuid,
    guildId: Joi.string()
      .regex(/^\d{17,20}$/)
      .required()
      .messages({
        'string.pattern.base': 'Guild ID must be a valid Discord snowflake',
      }),
  }),
};
