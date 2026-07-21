import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Centralized Joi validation schemas for v2 Directory API queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listOrganizations: Public org list with comprehensive filters
 * - listFederations: Public federation/alliance list
 * - getOrganization: Single org details
 * - getOrganizationSeoMeta: SEO metadata
 * - Search endpoints with text queries
 */

// Common pagination helpers
const pagination = {
  ...paginationKeys,
  sortBy: Joi.string()
    .valid('name', 'memberCount', 'createdAt', 'updatedAt', 'activityLevel')
    .default('memberCount'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

// Helper to parse comma-delimited strings into arrays
const stringToArray = (value: string) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  return [];
};

/**
 * v2 Directory query schemas
 */
export const directoryV2QuerySchemas = {
  /**
   * GET /api/v2/directory/organizations
   * List public organizations with filtering
   */
  listOrganizationsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    search: Joi.string().trim().max(200).optional(),
    primaryFocus: Joi.string()
      .valid(
        'PVP',
        'PVE',
        'EXPLORATION',
        'MINING',
        'TRADING',
        'INDUSTRIAL',
        'ROLEPLAY',
        'RACING',
        'OTHER'
      )
      .optional(),
    primaryFocuses: Joi.string()
      .custom((value, helpers) => {
        const focuses = stringToArray(value);
        const validFocuses = [
          'PVP',
          'PVE',
          'EXPLORATION',
          'MINING',
          'TRADING',
          'INDUSTRIAL',
          'ROLEPLAY',
          'RACING',
          'OTHER',
        ];
        if (focuses.length > 0 && !focuses.every(f => validFocuses.includes(f))) {
          return helpers.error('any.invalid');
        }
        return focuses;
      })
      .optional(),
    activityLevel: Joi.string().valid('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH').optional(),
    activityLevels: Joi.string()
      .custom((value, helpers) => {
        const levels = stringToArray(value);
        const validLevels = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
        if (levels.length > 0 && !levels.every(l => validLevels.includes(l))) {
          return helpers.error('any.invalid');
        }
        return levels;
      })
      .optional(),
    isRecruiting: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
    minMemberCount: Joi.number().integer().min(0).optional(),
    maxMemberCount: Joi.number().integer().min(0).optional(),
    languages: Joi.string()
      .custom((value, helpers) => {
        const langs = stringToArray(value);
        if (langs.length > 0) {
          // ISO 639-1 language codes validation
          const iso639 = ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'ru', 'pt', 'pl'];
          if (!langs.every(l => iso639.includes(l.toLowerCase()))) {
            return helpers.error('any.invalid');
          }
        }
        return langs;
      })
      .optional(),
    timezone: Joi.string().trim().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
    }),

  /**
   * GET /api/v2/directory/organizations/stats
   * Get directory statistics (no query params)
   */
  statsQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/v2/directory/organizations/:organizationId
   * Get single organization
   */
  organizationIdParam: Joi.object({
    organizationId: Joi.string().trim().min(1).max(255).required(),
  }).unknown(false),

  /**
   * GET /api/v2/directory/organizations/:organizationId/seo
   * Get SEO metadata
   */
  seoMetaQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/v2/directory/seo/html
   * Render crawler-targeted HTML with injected SEO metadata
   */
  seoHtmlQuery: Joi.object({
    path: Joi.string().trim().min(1).max(2048).required(),
  }).unknown(false),

  /**
   * GET /api/v2/directory/federations
   * List public federations/alliances
   */
  listFederationsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: Joi.string()
      .valid('name', 'memberCount', 'createdAt', 'updatedAt')
      .default('memberCount'),
    sortOrder: pagination.sortOrder,
    search: Joi.string().trim().max(200).optional(),
    name: Joi.string().trim().max(200).optional(),
    tags: Joi.string()
      .custom((value, helpers) => {
        const tags = stringToArray(value);
        if (tags.length === 0 && value !== undefined) {
          return helpers.error('any.invalid');
        }
        return tags;
      })
      .optional(),
    minMembers: Joi.number().integer().min(0).optional(),
    maxMembers: Joi.number().integer().min(0).optional(),
  }).unknown(false),

  /**
   * GET /api/v2/directory/federations/stats
   * Get federation statistics
   */
  federationStatsQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/v2/directory/search
   * Global directory search (if exists)
   */
  globalSearchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).required(),
    page: pagination.page,
    limit: pagination.limit,
    type: Joi.string().valid('organization', 'federation', 'user').optional(),
  }).unknown(false),
};
