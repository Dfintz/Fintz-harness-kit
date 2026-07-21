import Joi from 'joi';

/**
 * Extended Joi validation schemas for Activity search/list queries
 * Fixes CWE-1287: Improper Type Validation
 * Extends existing activityQuerySchemas with additional search endpoints
 *
 * Covers:
 * - searchActivities: Text search with comprehensive filters
 * - getMyActivities: User activity list with pagination
 * - getStatistics: Activity statistics/metrics
 */

// Common pagination helpers
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid('name', 'startDate', 'createdAt', 'participantCount', 'status')
    .default('startDate'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
};

/**
 * Activity extended query schemas
 */
export const activityExtendedQuerySchemas = {
  /**
   * GET /api/activities?page=1&limit=20
   * Search activities with filters and text search
   */
  searchQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    q: Joi.string().trim().max(200).optional(),
    status: Joi.string()
      .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
      .optional(),
    type: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'recruitment', 'job_listing')
      .optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
    minParticipants: Joi.number().integer().min(0).optional(),
    maxParticipants: Joi.number().integer().min(0).optional(),
    startDateFrom: Joi.date().iso().optional(),
    startDateTo: Joi.date().iso().optional(),
    visibility: Joi.string().valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed').optional(),
    tags: Joi.string()
      .custom((value, helpers) => {
        if (!value) {return undefined;}
        const tags = Array.isArray(value)
          ? value
          : (value as string).split(',').map((t: string) => t.trim());
        if (!Array.isArray(tags) || tags.length === 0) {
          return helpers.error('any.invalid');
        }
        return tags;
      })
      .optional(),
    includeExpired: Joi.boolean().optional(),
    myActivitiesOnly: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'date.base': '{#label} must be valid ISO date',
    }),

  /**
   * GET /api/activities/my/activities
   * Get current user's activities with pagination
   */
  myActivitiesQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string()
      .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
      .optional(),
    type: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'recruitment', 'job_listing')
      .optional(),
    role: Joi.string().valid('OWNER', 'ORGANIZER', 'LEAD', 'PARTICIPANT', 'BACKUP').optional(),
    includeExpired: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /api/activities/statistics/overview
   * Activity statistics with optional grouping
   */
  statisticsQuery: Joi.object({
    groupBy: Joi.string().valid('type', 'status', 'difficulty', 'month').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }).unknown(false),

  /**
   * POST /api/activities/:id/join
   * Join activity (no query validation, body validated separately)
   */
  joinActivityBody: Joi.object({
    notes: Joi.string().trim().max(500).optional(),
    preferredRole: Joi.string().valid('LEAD', 'PARTICIPANT', 'BACKUP', 'SUPPORT').optional(),
  }).unknown(false),

  /**
   * POST /api/activities/:id/invite-org
   * Invite organization to activity
   */
  inviteOrgBody: Joi.object({
    organizationId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    message: Joi.string().trim().max(500).optional(),
  }).unknown(false),

  /**
   * GET /api/activities/:id/participants
   * List activity participants
   */
  participantsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    status: Joi.string().valid('CONFIRMED', 'PENDING', 'DECLINED', 'STANDBY').optional(),
    role: Joi.string().valid('LEAD', 'PARTICIPANT', 'BACKUP', 'SUPPORT').optional(),
  }).unknown(false),
};
