import Joi from 'joi';

/**
 * Centralized Joi validation schemas for Briefing queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listBriefings: Pagination, type/status filters
 * - searchBriefings: Text search with filters
 * - getBriefing: Single briefing by ID
 */

// Common pagination helpers
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'priority', 'title').default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

/**
 * Briefing query schemas
 */
export const briefingQuerySchemas = {
  /**
   * GET /api/briefings
   * List briefings with pagination and filters
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
    type: Joi.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    authorId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    isPublic: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * GET /api/briefings/search
   * Search briefings by text and filters
   */
  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).optional(),
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
    type: Joi.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
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
  }).unknown(false),

  /**
   * GET /api/briefings/:id
   * Get single briefing by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/briefings/organization/:orgId
   * List briefings for organization
   */
  orgIdParam: Joi.object({
    orgId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/briefings/organization/:orgId (with query)
   * Organization briefing list with pagination
   */
  orgBriefingsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
    type: Joi.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
  }).unknown(false),

  /**
   * GET /api/briefings/:id/readers
   * Get list of readers/views for briefing
   */
  readersQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
  }).unknown(false),

  /**
   * GET /api/briefings/:id/attachments
   * Get briefing attachments
   */
  attachmentsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
  }).unknown(false),
};
