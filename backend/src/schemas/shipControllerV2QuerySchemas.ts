import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for v2 Ship API queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listShips: Pagination, status, role, type filters
 * - searchShips: Text search with filters
 * - getShip: Single ship by ID
 * - statistics: Ship statistics queries
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string()
    .valid('name', 'type', 'role', 'status', 'createdAt', 'updatedAt')
    .default('name'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
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
 * v2 Ship API query schemas
 */
export const shipControllerV2QuerySchemas = {
  /**
   * GET /v2/ships
   * List organization ships with filters
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string()
      .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
      .optional(),
    role: Joi.string()
      .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
      .optional(),
    manufacturer: Joi.string().trim().optional(),
    type: Joi.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND', 'SHIP').optional(),
    minCrew: Joi.number().integer().min(0).optional(),
    maxCrew: Joi.number().integer().min(0).optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
      'number.min': '{#label} must be at least {#limit}',
    }),

  /**
   * GET /v2/ships/search
   * Search ships by text and filters
   */
  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).optional(),
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string()
      .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
      .optional(),
    role: Joi.string()
      .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
      .optional(),
    manufacturer: Joi.string().trim().optional(),
    type: Joi.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND', 'SHIP').optional(),
    tags: Joi.custom((value, helpers) => {
      const tags = stringToArray(value);
      if (tags.length === 0 && value !== undefined) {
        return helpers.error('any.invalid');
      }
      return tags;
    }).optional(),
  }).unknown(false),

  /**
   * GET /v2/ships/statistics
   * Ship statistics and metrics
   */
  statisticsQuery: Joi.object({
    groupBy: Joi.string().valid('status', 'role', 'type', 'manufacturer').optional(),
    includeMetrics: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /v2/ships/:id
   * Get single ship by ID
   */
  idParam: Joi.object({
    id: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /v2/ships/catalogue
   * Catalogue reference data (public)
   * Higher limit (500) allowed because catalogue is read-only reference data
   * with ~200+ ships that the frontend needs in a single request.
   */
  catalogueQuery: Joi.object({
    type: Joi.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND').optional(),
    manufacturer: Joi.string().trim().optional(),
    role: Joi.string()
      .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
      .optional(),
    size: Joi.string().trim().optional(),
    search: Joi.string().trim().max(200).optional(),
    isVehicle: Joi.string().valid('true', 'false').optional(),
    status: Joi.string().trim().optional(),
    page: pagination.page,
    limit: Joi.number().integer().min(1).max(500).default(100),
  }).unknown(false),

  /**
   * GET /v2/ships/catalogue/vehicles
   * List vehicle catalogue items
   */
  vehiclesCatalogueQuery: Joi.object({
    page: pagination.page,
    limit: Joi.number().integer().min(1).max(500).default(100),
    manufacturer: Joi.string().trim().optional(),
  }).unknown(false),

  /**
   * GET /v2/ships/catalogue/spacecraft
   * List spacecraft catalogue items
   */
  spacecraftCatalogueQuery: Joi.object({
    page: pagination.page,
    limit: Joi.number().integer().min(1).max(500).default(100),
    manufacturer: Joi.string().trim().optional(),
    role: Joi.string()
      .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
      .optional(),
  }).unknown(false),
};
