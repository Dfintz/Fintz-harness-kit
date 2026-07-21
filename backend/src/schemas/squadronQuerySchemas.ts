import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Squadron management queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - getSquadronMembers: List squadron members with pagination
 * - getSquadronRoster: Detailed roster with filters
 * - Squadron statistics and analytics
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string().valid('joinDate', 'rank', 'name', 'status', 'activity').default('joinDate'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

/**
 * Squadron query schemas
 */
export const squadronQuerySchemas = {
  /**
   * GET /api/squadrons/:squadronId/members
   * List squadron members with filters
   */
  membersQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    role: Joi.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED').optional(),
    search: Joi.string().trim().max(200).optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * GET /api/squadrons/:squadronId/roster
   * Get detailed squadron roster
   */
  rosterQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    includeShips: Joi.boolean().optional(),
    includeRanks: Joi.boolean().optional(),
    filterByShipType: Joi.string()
      .valid('FIGHTER', 'BOMBER', 'EXPLORER', 'TRANSPORT', 'SUPPORT')
      .optional(),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId
   * Get squadron by ID (with optional extended info)
   */
  squadronIdParam: Joi.object({
    squadronId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/members/:memberId
   * Get specific squadron member
   */
  memberIdParam: Joi.object({
    memberId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/users/:userId/squadrons
   * Get squadrons for user
   */
  userIdParam: Joi.object({
    userId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * POST /api/squadrons/:squadronId/members
   * Add member to squadron
   */
  addMemberBody: Joi.object({
    userId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    role: Joi.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').optional(),
    joinDate: Joi.date().iso().optional(),
  }).unknown(false),

  /**
   * PATCH /api/squadrons/:squadronId/members/:userId/role
   * Update member role
   */
  updateRoleBody: Joi.object({
    role: Joi.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').required(),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/stats
   * Get squadron statistics
   */
  statsQuery: Joi.object({
    includeHistorical: Joi.boolean().optional(),
    period: Joi.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR').default('MONTH'),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/stats/roles
   * Get member breakdown by role
   */
  roleStatsQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/stats/ships
   * Get member ships breakdown
   */
  shipStatsQuery: Joi.object({
    groupBy: Joi.string().valid('type', 'manufacturer', 'role').optional(),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/count
   * Get total member count
   */
  countQuery: Joi.object({
    activeOnly: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /api/squadrons/:squadronId/count/active
   * Get active member count
   */
  activeCountQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/users/:userId/squadrons/count
   * Get user's squadron count
   */
  userSquadronCountQuery: Joi.object({}).unknown(false),
};
