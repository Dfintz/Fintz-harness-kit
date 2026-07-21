import Joi from 'joi';

/**
 * Centralized Joi validation schemas for v2 Event Conflict API queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - checkConflicts: Body validation for conflict detection
 * - getMyConflicts: User conflict list with pagination
 * - getActivityConflicts: Activity-specific conflicts
 * - getUserConflicts: User-specific conflicts
 * - getConflictsInRange: Date range queries
 */

// Helper to parse comma-delimited strings into arrays
const _stringToArray = (value: string) => {
  if (Array.isArray(value)) {return value;}
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  return [];
};

/**
 * v2 Event Conflict query schemas
 */
export const eventConflictV2QuerySchemas = {
  /**
   * POST /api/v2/events/conflicts/check
   * Check for conflicts in proposed activity dates
   */
  checkConflictsBody: Joi.object({
    activityId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    excludeActivityId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional()
      .description('Exclude this activity from conflict detection'),
    userId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    organizationId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    includeShared: Joi.boolean().optional(),
    options: Joi.object({
      includeTypes: Joi.array().items(Joi.string()).optional(),
      excludeTypes: Joi.array().items(Joi.string()).optional(),
      bufferMinutes: Joi.number().integer().min(0).max(1440).optional(),
    }).optional().description('Additional conflict detection options'),
  })
    .unknown(false)
    .external(async value => {
      if (value.startDate >= value.endDate) {
        throw new Error('startDate must be before endDate');
      }
    }),

  /**
   * GET /api/v2/events/conflicts/me
   * Get conflicts for current user
   */
  myConflictsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    includeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to include'),
    excludeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to exclude'),
  }).unknown(false),

  /**
   * GET /api/v2/events/conflicts/activity/:activityId
   * Get conflicts for specific activity
   */
  activityIdParam: Joi.object({
    activityId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/v2/events/conflicts/activity/:activityId (with query)
   * Activity conflicts list with filters
   */
  activityConflictsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    includeResolved: Joi.boolean().optional(),
    severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    includeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to include'),
    excludeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to exclude'),
    bufferMinutes: Joi.number().integer().min(0).max(1440).optional(),
  }).unknown(false),

  /**
   * GET /api/v2/events/conflicts/user/:userId
   * Get conflicts for specific user
   */
  userIdParam: Joi.object({
    userId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/v2/events/conflicts/user/:userId (with query)
   * User conflicts list with pagination
   */
  userConflictsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    includeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to include'),
    excludeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to exclude'),
  }).unknown(false),

  /**
   * GET /api/v2/events/conflicts/range
   * Get conflicts within date range
   */
  rangeQuery: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    includeResolved: Joi.boolean().optional(),
    bufferMinutes: Joi.number().integer().min(0).max(1440).default(0),
    includeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to include'),
    excludeTypes: Joi.string()
      .optional()
      .custom(_stringToArray)
      .description('Comma-separated activity types to exclude'),
  })
    .unknown(false)
    .external(async value => {
      if (value.startDate >= value.endDate) {
        throw new Error('startDate must be before endDate');
      }
    }),
};
