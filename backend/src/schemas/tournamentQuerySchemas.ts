import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Tournament list/search queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - getTournaments: List tournaments with filters
 * - getTournamentById: Single tournament by ID
 * - Tournament registration and match updates
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string()
    .valid('name', 'startDate', 'createdAt', 'status', 'participantCount')
    .default('startDate'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

/**
 * Tournament query schemas
 */
export const tournamentQuerySchemas = {
  /**
   * GET /api/tournaments
   * List tournaments with filters and pagination
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string()
      .valid('PLANNING', 'REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
      .optional(),
    type: Joi.string()
      .valid('DEATHMATCH', 'RACING', 'DOGFIGHTING', 'TEAM_COMBAT', 'OTHER')
      .optional(),
    difficulty: Joi.string()
      .valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'HARDCORE')
      .optional(),
    minParticipants: Joi.number().integer().min(0).optional(),
    maxParticipants: Joi.number().integer().min(0).optional(),
    myTournamentsOnly: Joi.boolean().optional(),
    isRegistered: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * GET /api/tournaments/:id
   * Get single tournament by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/tournaments/:id/matches
   * Get tournament matches with pagination
   */
  matchesQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
    round: Joi.number().integer().min(1).optional(),
  }).unknown(false),

  /**
   * POST /api/tournaments/:id/register
   * Register for tournament
   */
  registerBody: Joi.object({
    teamId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    shipIds: Joi.array()
      .items(
        Joi.string()
          .trim()
          .uuid({ version: ['uuidv4'] })
      )
      .optional(),
    notes: Joi.string().trim().max(500).optional(),
  }).unknown(false),

  /**
   * GET /api/tournaments/:id/standings
   * Get tournament standings/leaderboard
   */
  standingsQuery: Joi.object({
    sortBy: Joi.string().valid('wins', 'points', 'killDeathRatio', 'lastUpdated').default('points'),
    sortOrder: pagination.sortOrder,
  }).unknown(false),

  /**
   * GET /api/tournaments/:id/participants
   * List tournament participants
   */
  participantsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    status: Joi.string().valid('REGISTERED', 'ACTIVE', 'ELIMINATED', 'WITHDRAWN').optional(),
  }).unknown(false),
};
