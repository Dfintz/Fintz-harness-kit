import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Matchmaking system queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - findMatches: Search available matches with filters
 * - Queue management: Solo, group, org matchmaking
 * - Match statistics and player rating
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string().valid('createdAt', 'rating', 'playerCount', 'waitTime').default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

// Helper to convert comma-delimited strings to arrays
const _stringToArray = (value: string) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value.split(',').map(s => s.trim());
};

/**
 * Matchmaking query schemas
 */
export const matchmakingQuerySchemas = {
  /**
   * GET /api/matchmaking/matches
   * Find available matches with filters
   */
  findMatchesQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .optional(),
    minRating: Joi.number().integer().min(0).optional(),
    maxRating: Joi.number().integer().max(10000).optional(),
    minPlayers: Joi.number().integer().min(1).optional(),
    maxPlayers: Joi.number().integer().min(1).optional(),
    region: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    minWaitTime: Joi.number().integer().min(0).optional(),
    maxWaitTime: Joi.number().integer().optional(),
    includePartyMatches: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * POST /api/matchmaking/queue/solo
   * Join solo matchmaking queue
   */
  joinSoloQueueBody: Joi.object({
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .required(),
    preferredRegion: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    maxWaitTime: Joi.number().integer().min(30).max(600).optional(),
  }).unknown(false),

  /**
   * POST /api/matchmaking/queue/group
   * Join group matchmaking queue
   */
  joinGroupQueueBody: Joi.object({
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .required(),
    groupId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    preferredRegion: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    maxWaitTime: Joi.number().integer().min(30).max(600).optional(),
  }).unknown(false),

  /**
   * POST /api/matchmaking/queue/organization
   * Join organization matchmaking queue
   */
  joinOrgQueueBody: Joi.object({
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .required(),
    organizationId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    preferredRegion: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    maxWaitTime: Joi.number().integer().min(30).max(600).optional(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/queue/status
   * Get current queue status
   */
  queueStatusQuery: Joi.object({
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .optional(),
    region: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
  }).unknown(false),

  /**
   * DELETE /api/matchmaking/queue/leave
   * Leave matchmaking queue
   */
  leaveQueueBody: Joi.object({
    reason: Joi.string().valid('CANCELLED', 'TIMEOUT', 'PLAYER_DISCONNECT').optional(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/player/:playerId/rating
   * Get player matchmaking rating
   */
  playerIdParam: Joi.object({
    playerId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/player/:playerId/stats
   * Get player matchmaking statistics
   */
  playerStatsQuery: Joi.object({
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .optional(),
    period: Joi.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL_TIME').default('MONTH'),
  }).unknown(false),

  /**
   * GET /api/matchmaking/leaderboard
   * Get matchmaking leaderboard
   */
  leaderboardQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    gameMode: Joi.string()
      .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
      .optional(),
    region: Joi.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/matches/:matchId
   * Get match details
   */
  matchIdParam: Joi.object({
    matchId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/matches/:matchId/results
   * Get match results
   */
  matchResultsQuery: Joi.object({}).unknown(false),

  /**
   * POST /api/matchmaking/matches/:matchId/report
   * Report match results/issues
   */
  reportMatchBody: Joi.object({
    result: Joi.string().valid('WIN', 'LOSS', 'DRAW', 'CANCELLED').required(),
    kills: Joi.number().integer().min(0).optional(),
    deaths: Joi.number().integer().min(0).optional(),
    assists: Joi.number().integer().min(0).optional(),
    damageDealt: Joi.number().min(0).optional(),
    notes: Joi.string().trim().max(500).optional(),
  }).unknown(false),

  /**
   * GET /api/matchmaking/matches/:matchId/participants
   * Get match participants
   */
  participantsQuery: Joi.object({
    sortBy: Joi.string().valid('rating', 'kills', 'damage', 'joinTime').optional(),
  }).unknown(false),
};
