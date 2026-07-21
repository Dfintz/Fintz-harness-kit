import Joi from 'joi';

import { paginationKeys, paginationKeysWith } from './common';

/**
 * Validation schemas for RSI Crawler API endpoints
 */

/**
 * Query parameters for listing organizations
 */
export const listOrganizationsSchema = Joi.object({
  ...paginationKeys,
});

/**
 * Path parameters for organization SID
 */
export const orgSidSchema = Joi.object({
  sid: Joi.string().trim().uppercase().min(1).max(20).required(),
});

/**
 * Path parameters for user handle
 */
export const userHandleSchema = Joi.object({
  handle: Joi.string().trim().min(1).max(50).required(),
});

/**
 * Query parameters for organization members
 */
export const getOrganizationMembersSchema = Joi.object({
  ...paginationKeysWith(100, 500),
  force: Joi.boolean().default(false),
});

/**
 * Query parameters for get organization
 */
export const getOrganizationSchema = Joi.object({
  force: Joi.boolean().default(false),
});

/**
 * Request body for refresh organization
 */
export const refreshOrganizationSchema = Joi.object({
  includeMembers: Joi.boolean().default(true),
});
