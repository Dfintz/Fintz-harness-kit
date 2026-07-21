import Joi from 'joi';

/**
 * Centralized Joi validation schemas for v2 Relationship API queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - getRelationship: Single relationship by ID
 * - Relationship history, timeline, analytics
 * - Sentiment trend and interaction tracking
 */

/**
 * v2 Relationship query schemas
 */
export const relationshipV2QuerySchemas = {
  /**
   * GET /api/v2/relationships/:id
   * Get single relationship by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/v2/relationships/:id/history
   * Get relationship history with pagination
   */
  historyQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    changeType: Joi.string()
      .valid(
        'TRUST_CHANGED',
        'SENTIMENT_RECORDED',
        'STATUS_CHANGED',
        'NOTE_ADDED',
        'INTERACTION_RECORDED'
      )
      .optional(),
  }).unknown(false),

  /**
   * GET /api/v2/relationships/:id/timeline
   * Get relationship timeline with optional filtering
   */
  timelineQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    includeInteractions: Joi.boolean().optional(),
    includeTrustChanges: Joi.boolean().optional(),
  })
    .unknown(false)
    .external((value: { startDate?: Date; endDate?: Date }) => {
      if (value.startDate && value.endDate && value.startDate >= value.endDate) {
        throw new Error('startDate must be before endDate');
      }
    }),

  /**
   * GET /api/v2/relationships/:id/analytics
   * Get relationship analytics
   */
  analyticsQuery: Joi.object({
    period: Joi.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL').default('MONTH'),
    includeMetrics: Joi.boolean().optional(),
    includeProjections: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /api/v2/relationships/:id/sentiment-trend
   * Get sentiment trend over time
   */
  sentimentTrendQuery: Joi.object({
    granularity: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY').default('WEEKLY'),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  })
    .unknown(false)
    .external((value: { startDate?: Date; endDate?: Date }) => {
      if (value.startDate && value.endDate && value.startDate >= value.endDate) {
        throw new Error('startDate must be before endDate');
      }
    }),

  /**
   * PUT /api/v2/relationships/:id
   * Update relationship
   */
  updateBody: Joi.object({
    type: Joi.string()
      .valid(
        // Positive
        'allied',
        'partnership',
        'cooperative',
        'affiliated',
        'trading_partner',
        // Neutral
        'neutral',
        'observer',
        'interested',
        // Negative
        'competitive',
        'rival',
        'hostile',
        'war',
        // Special
        'parent',
        'subsidiary',
        'merger_pending',
        'under_negotiation'
      )
      .optional(),
    status: Joi.string()
      .valid('active', 'pending', 'suspended', 'terminated', 'expired')
      .optional(),
    description: Joi.string().trim().max(1000).optional().allow(''),
    notes: Joi.string().trim().max(1000).optional().allow(''),
    tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
    contactName: Joi.string().trim().max(200).optional().allow(''),
    contactRole: Joi.string().trim().max(200).optional().allow(''),
    contactEmail: Joi.string().trim().email({ tlds: false }).max(254).optional().allow(''),
    communicationChannels: Joi.array().items(Joi.string().trim().max(100)).optional(),
    reviewDate: Joi.string().isoDate().optional().allow(null, ''),
    expiryDate: Joi.string().isoDate().optional().allow(null, ''),
    isPublic: Joi.boolean().optional(),
    autoRenew: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * DELETE /api/v2/relationships/:id
   * Terminate relationship
   */
  terminateBody: Joi.object({
    reason: Joi.string()
      .valid('MUTUAL_AGREEMENT', 'USER_REQUEST', 'CONFLICT_RESOLUTION', 'OTHER')
      .required(),
    notes: Joi.string().trim().max(500).optional(),
  }).unknown(false),

  /**
   * GET /api/v2/relationships
   * List relationships with filters
   */
  listQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string()
      .valid('active', 'pending', 'suspended', 'terminated', 'expired')
      .optional(),
    type: Joi.string()
      .valid(
        'allied',
        'partnership',
        'cooperative',
        'affiliated',
        'trading_partner',
        'neutral',
        'observer',
        'interested',
        'competitive',
        'rival',
        'hostile',
        'war',
        'parent',
        'subsidiary',
        'merger_pending',
        'under_negotiation'
      )
      .optional(),
    minTrustScore: Joi.number().min(-100).max(100).optional(),
    maxTrustScore: Joi.number().min(-100).max(100).optional(),
  }).unknown(false),

  /**
   * GET /api/v2/relationships/types
   * Get relationship type metadata
   */
  typesQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/v2/relationships/sentiments
   * Get available sentiment options
   */
  sentimentsQuery: Joi.object({}).unknown(false),

  /**
   * GET /api/v2/relationships/change-types
   * Get relationship change types
   */
  changeTypesQuery: Joi.object({}).unknown(false),
};
