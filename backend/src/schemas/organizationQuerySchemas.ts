import Joi from 'joi';

import { paginationKeysWith } from './common';

/**
 * Centralized Joi validation schemas for Organization list/search queries
 * Fixes CWE-1287: Improper Type Validation
 *
 * Covers:
 * - listOrganizations: Pagination and type/status filters
 * - searchOrganizations: Search text, filters, pagination
 * - getOrganization: includeHierarchy boolean coercion
 */

// Common pagination helpers
const pagination = {
  ...paginationKeysWith(10),
  sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt', 'memberCount').default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
};

// Helper to parse comma-delimited strings into arrays
const _stringToArray = (value: string) => {
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
 * Organization query schemas
 */
export const organizationQuerySchemas = {
  /**
   * GET /api/organizations
   * Public list with optional pagination
   */
  listQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION').optional(),
    type: Joi.string().valid('MAIN', 'DIVISION', 'SQUAD', 'WINGS', 'OTHER').optional(),
    joinable: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.invalid': 'Invalid {#label} value',
      'number.base': '{#label} must be a number',
      'number.min': '{#label} must be at least {#limit}',
      'number.max': '{#label} must be at most {#limit}',
    }),

  /**
   * GET /api/organizations/search
   * Public search with text filter and pagination
   */
  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).required(),
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION').optional(),
    type: Joi.string().valid('MAIN', 'DIVISION', 'SQUAD', 'WINGS', 'OTHER').optional(),
    joinable: Joi.boolean().optional(),
  })
    .unknown(false)
    .messages({
      'any.required': 'Search query {#label} is required',
    }),

  /**
   * GET /api/organizations/:id
   * Get single organization with optional includeHierarchy boolean
   */
  getQuery: Joi.object({
    includeHierarchy: Joi.boolean().optional(),
  }).unknown(false),

  /**
   * GET /api/organizations/:id/activity
   * Organization activity log with filters and pagination
   */
  activityQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortOrder: pagination.sortOrder,
    action: Joi.string()
      .valid(
        'CREATED',
        'UPDATED',
        'DELETED',
        'MEMBER_ADDED',
        'MEMBER_REMOVED',
        'MEMBER_PROMOTED',
        'MEMBER_DEMOTED',
        'PERMISSION_CHANGED',
        'SETTINGS_CHANGED'
      )
      .optional(),
    severity: Joi.string().valid('INFO', 'WARNING', 'CRITICAL').optional(),
    userId: Joi.string().trim().optional(),
  }).unknown(false),

  /**
   * GET /api/organizations/:id/analytics
   * Organization analytics with period filter
   */
  analyticsQuery: Joi.object({
    period: Joi.string()
      .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')
      .default('MONTHLY'),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }).unknown(false),

  /**
   * GET /api/organizations/:id/members
   * Organization members list with pagination and filters
   */
  membersQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: Joi.string().valid('joinedAt', 'name', 'role').default('joinedAt'),
    sortOrder: pagination.sortOrder,
    role: Joi.string().valid('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'GUEST').optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'PENDING').optional(),
  }).unknown(false),

  /**
   * GET /api/organizations/:id/permissions
   * Organization permissions list
   */
  permissionsQuery: Joi.object({
    page: pagination.page,
    limit: pagination.limit,
    resource: Joi.string()
      .valid('ORGANIZATION', 'FLEET', 'INVENTORY', 'PERMISSIONS', 'SETTINGS')
      .optional(),
  }).unknown(false),
};
