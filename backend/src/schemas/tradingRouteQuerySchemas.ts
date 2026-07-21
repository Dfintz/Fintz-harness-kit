import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Trading Route list/search queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listTradingRoutes: Pagination and status/profitability filters
 * - searchTradingRoutes: Text search with filters
 * - getTradingRoute: Single route by ID
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string().valid('createdAt', 'profit', 'distance', 'popularity').default('createdAt'),
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
 * Trading route query schemas
 */
export const tradingRouteQuerySchemas = {
  /**
   * GET /api/trading/routes
   * List trading routes with filters
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
    minProfit: Joi.number().min(0).optional(),
    maxDistance: Joi.number().min(0).optional(),
    includeExpired: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
      'number.min': '{#label} must be at least {#limit}',
    }),

  /**
   * GET /api/trading/routes/search
   * Search trading routes by text and filters
   */
  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).optional(),
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
    startLocation: Joi.string().trim().optional(),
    endLocation: Joi.string().trim().optional(),
    minProfit: Joi.number().min(0).optional(),
    maxDistance: Joi.number().min(0).optional(),
    commodity: Joi.string().trim().optional(),
    tags: Joi.custom((value, helpers) => {
      const tags = stringToArray(value);
      if (tags.length === 0 && value !== undefined) {
        return helpers.error('any.invalid');
      }
      return tags;
    }).optional(),
  }).unknown(false),

  /**
   * GET /api/trading/routes/:id
   * Get single trading route by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .pattern(/^route_\d+_[a-f0-9-]+$/)
      .required()
      .messages({ 'string.pattern.base': 'Invalid trading route ID format' }),
  }).unknown(false),

  /**
   * POST /api/trading/routes (bulk)
   * Bulk list trading routes
   */
  bulkQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    creatorId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
    favorited: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /api/trading/routes/:id/profitability
   * Get route profitability metrics
   */
  profitabilityQuery: Joi.object({
    period: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY').default('WEEKLY'),
    includeMetrics: Joi.boolean().optional(),
  }).unknown(false),
};
