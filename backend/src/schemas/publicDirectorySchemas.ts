import Joi from 'joi';

/**
 * Validation schemas for public organization directory
 * Phase 2: Enhanced with advanced filtering and search
 */

// Valid enum values for validation
const primaryFocusValues = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'bounty_hunting',
  'medical',
  'transport',
  'salvage',
  'security',
  'social',
  'piracy',
  'racing',
  'mixed',
];

const activityLevelValues = ['inactive', 'low', 'moderate', 'high', 'very_high'];

// Valid sort field values
const sortByValues = ['memberCount', 'createdAt', 'updatedAt', 'activityLevel'];

export const publicDirectorySchemas = {
  /**
   * Query parameters for directory listing
   * Phase 2: Supports multi-select filters and enhanced sorting
   */
  directoryQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    // Legacy single-value filter (backward compatible)
    primaryFocus: Joi.string()
      .valid(...primaryFocusValues)
      .optional(),
    // Multi-select focus filter (Phase 2)
    primaryFocuses: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...primaryFocusValues)),
        Joi.string().valid(...primaryFocusValues)
      )
      .optional(),
    // Legacy single-value filter (backward compatible)
    activityLevel: Joi.string()
      .valid(...activityLevelValues)
      .optional(),
    // Multi-select activity level filter (Phase 2)
    activityLevels: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...activityLevelValues)),
        Joi.string().valid(...activityLevelValues)
      )
      .optional(),
    isRecruiting: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
    // Size range filters
    minMemberCount: Joi.number().integer().min(0).optional(),
    maxMemberCount: Joi.number().integer().min(0).optional(),
    // Language/timezone filters
    languages: Joi.alternatives()
      .try(Joi.array().items(Joi.string().max(20)), Joi.string().max(100))
      .optional(),
    timezone: Joi.string().max(50).optional(),
    // Full-text search
    search: Joi.string().trim().max(100).optional(),
    // Sort options (Phase 2)
    sortBy: Joi.string()
      .valid(...sortByValues)
      .optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),

  /**
   * Query parameters for federation listing
   * Phase 2: Supports advanced filtering for alliances
   */
  federationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    name: Joi.string().trim().max(100).optional(),
    tags: Joi.alternatives()
      .try(Joi.array().items(Joi.string().max(50)), Joi.string().max(200))
      .optional(),
    minMembers: Joi.number().integer().min(0).optional(),
    maxMembers: Joi.number().integer().min(0).optional(),
    sortBy: Joi.string().valid('memberCount', 'createdAt', 'name').optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),

  /**
   * Update public profile
   */
  updateProfile: Joi.object({
    isPublic: Joi.boolean().optional(),
    tagline: Joi.string().trim().max(200).allow('', null).optional(),
    primaryFocus: Joi.string()
      .valid(...primaryFocusValues)
      .optional(),
    secondaryFocus: Joi.array()
      .items(Joi.string().valid(...primaryFocusValues))
      .max(5)
      .optional(),
    rsiUrl: Joi.string().uri().max(255).allow('', null).optional(),
    discordInvite: Joi.string().max(100).allow('', null).optional(),
    twitterUrl: Joi.string().uri().max(255).allow('', null).optional(),
    youtubeUrl: Joi.string().uri().max(255).allow('', null).optional(),
    twitchUrl: Joi.string().uri().max(255).allow('', null).optional(),
    websiteUrl: Joi.string().uri().max(255).allow('', null).optional(),
    languages: Joi.array().items(Joi.string().max(20)).max(10).optional(),
    timezone: Joi.string().max(50).allow('', null).optional(),
    isRecruiting: Joi.boolean().optional(),
    bannerUrl: Joi.string().uri().max(500).allow('', null).optional(),
    logoUrl: Joi.string().uri().max(500).allow('', null).optional(),
    scstatsVisibility: Joi.object({
      showVerification: Joi.boolean().optional(),
      showSkills: Joi.boolean().optional(),
      showTimezone: Joi.boolean().optional(),
      showAnalytics: Joi.boolean().optional(),
    }).optional(),
  }),

  /**
   * Set verification status (admin only)
   */
  setVerification: Joi.object({
    isVerified: Joi.boolean().required(),
  }),
};
