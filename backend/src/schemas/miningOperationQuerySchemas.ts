import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Mining Operation list/search queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - getMiningOperations: List operations with filters
 * - getMiningOperationById: Single operation by ID
 * - Operation crew and resource management
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string()
    .valid('name', 'status', 'startDate', 'createdAt', 'efficiency')
    .default('startDate'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

/**
 * Mining Operation query schemas
 */
export const miningOperationQuerySchemas = {
  /**
   * GET /api/mining-operations
   * List mining operations with filters and pagination
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED').optional(),
    zone: Joi.string().trim().optional(),
    miningType: Joi.string().valid('ASTEROID', 'GROUND', 'SUBSURFACE', 'ORBITAL').optional(),
    minCrew: Joi.number().integer().min(0).optional(),
    maxCrew: Joi.number().integer().min(0).optional(),
    myOperationsOnly: Joi.boolean().optional(),
    hasOpenPositions: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * GET /api/mining-operations/:id
   * Get single mining operation by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * POST /api/mining-operations/:id/crew
   * Add crew member to operation
   */
  addCrewBody: Joi.object({
    userId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    role: Joi.string().valid('LEAD', 'PILOT', 'ENGINEER', 'SURVEYOR', 'OPERATOR').required(),
    shipId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
  }).unknown(false),

  /**
   * GET /api/mining-operations/:id/crew
   * List operation crew with pagination
   */
  crewQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    role: Joi.string().valid('LEAD', 'PILOT', 'ENGINEER', 'SURVEYOR', 'OPERATOR').optional(),
  }).unknown(false),

  /**
   * POST /api/mining-operations/:id/resources
   * Record harvested resources
   */
  updateResourcesBody: Joi.object({
    resourceType: Joi.string()
      .valid('QUANTANIUM', 'LABADITE', 'LARANITE', 'BORASE', 'TACONITE', 'AGRICIUM')
      .required(),
    amount: Joi.number().min(0).precision(2).required(),
    purity: Joi.number().min(0).max(100).precision(2).required(),
    timestamp: Joi.date().iso().optional(),
  }).unknown(false),

  /**
   * GET /api/mining-operations/:id/resources
   * Get harvested resources summary
   */
  resourcesQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    resourceType: Joi.string()
      .valid('QUANTANIUM', 'LABADITE', 'LARANITE', 'BORASE', 'TACONITE', 'AGRICIUM')
      .optional(),
  }).unknown(false),

  /**
   * PUT /api/mining-operations/:id/status
   * Update operation status
   */
  updateStatusBody: Joi.object({
    status: Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled').required(),
    notes: Joi.string().trim().max(500).optional(),
  }).unknown(false),

  /**
   * GET /api/mining-operations/:id/statistics
   * Get operation statistics
   */
  statisticsQuery: Joi.object({
    includeResourceBreakdown: Joi.boolean().optional(),
    includeCrewStats: Joi.boolean().optional(),
  }).unknown(false),
};
