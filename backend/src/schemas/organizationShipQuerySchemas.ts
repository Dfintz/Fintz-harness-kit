import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Organization Ship queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listOrgShips: Fleet-scoped ship list with filters
 * - assignShipToFleet: Fleet assignment payload
 * - getOrgShip: Single org ship by ID
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string().valid('name', 'type', 'status', 'createdAt', 'fleet').default('name'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
};

/**
 * Organization Ship query schemas
 */
export const organizationShipQuerySchemas = {
  /**
   * GET /api/organizations/:orgId/ships
   * List organization ships with pagination and filters
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string()
      .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
      .optional(),
    type: Joi.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND').optional(),
    fleetId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .optional(),
    unassigned: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
    }),

  /**
   * GET /api/organizations/:orgId/ships/:shipId
   * Get single ship within organization context
   */
  shipIdParam: Joi.object({
    shipId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/organizations/:orgId/ships/fleet/:fleetId
   * Get ships assigned to specific fleet
   */
  fleetIdParam: Joi.object({
    fleetId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * POST /api/organizations/:orgId/ships/:shipId/assign-fleet
   * Assign ship to fleet
   */
  assignFleetBody: Joi.object({
    fleetId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
    role: Joi.string().valid('LEAD', 'WING', 'SUPPORT', 'SCOUT', 'OTHER').optional(),
  }).unknown(false),

  /**
   * DELETE /api/organizations/:orgId/ships/:shipId/unassign-fleet
   * Unassign ship from fleet
   */
  unassignFleetBody: Joi.object({
    fleetId: Joi.string()
      .trim()
      .uuid({ version: ['uuidv4'] })
      .required(),
  }).unknown(false),

  /**
   * GET /api/organizations/:orgId/ships/:shipId/location
   * Get ship location/deployment info
   */
  locationQuery: Joi.object({
    includeHistory: Joi.boolean().optional(),
  }).unknown(false),
};
