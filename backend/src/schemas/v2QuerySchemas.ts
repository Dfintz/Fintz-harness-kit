/**
 * API v2 Query Parameter Validation Schemas
 * Joi schemas for validating standardized query parameters
 */

import Joi from 'joi';

/**
 * Standard pagination query parameters
 * Supports both offset-based and page-based pagination
 */
export const paginationQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  page: Joi.number().integer().min(1).optional(),
});

/**
 * Sort query parameter
 * Format: fieldName (ascending) or -fieldName (descending)
 */
export const sortQuerySchema = Joi.object({
  sort: Joi.string()
    .pattern(/^[+-]?[a-zA-Z_][a-zA-Z0-9_]*$/)
    .optional(),
});

/**
 * Search query parameter
 */
export const searchQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).optional(),
});

/**
 * Fields selection query parameter
 * Format: comma-separated field names
 */
export const fieldsQuerySchema = Joi.object({
  fields: Joi.string()
    .pattern(/^[a-zA-Z_][a-zA-Z0-9_]*(,[a-zA-Z_][a-zA-Z0-9_]*)*$/)
    .optional(),
});

/**
 * Combined standard query parameters for list endpoints
 */
export const standardListQuerySchema = paginationQuerySchema
  .concat(sortQuerySchema)
  .concat(searchQuerySchema)
  .concat(fieldsQuerySchema);

/**
 * Fleet list query parameters
 */
export const fleetListQuerySchema = standardListQuerySchema.keys({
  'filter[status]': Joi.string().valid('active', 'inactive', 'archived').optional(),
  'filter[name]': Joi.string().trim().max(100).optional(),
});

/**
 * Ship list query parameters
 */
export const shipListQuerySchema = standardListQuerySchema.keys({
  'filter[manufacturer]': Joi.string().trim().max(100).optional(),
  'filter[size]': Joi.string().valid('small', 'medium', 'large', 'capital').optional(),
  'filter[role]': Joi.string().trim().max(50).optional(),
  'filter[status]': Joi.string().valid('flight_ready', 'in_concept', 'in_production').optional(),
});

/**
 * Activity list query parameters
 */
export const activityListQuerySchema = standardListQuerySchema.keys({
  'filter[status]': Joi.string()
    .valid(
      'draft',
      'open',
      'recruiting',
      'ready',
      'active',
      'paused',
      'completed',
      'cancelled',
      'archived'
    )
    .optional(),
  'filter[type]': Joi.string()
    .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
    .optional(),
  'filter[visibility]': Joi.string().valid('public', 'organization', 'private').optional(),
});

/**
 * Trading route list query parameters
 */
export const tradingRouteListQuerySchema = standardListQuerySchema.keys({
  'filter[status]': Joi.string().valid('active', 'inactive', 'deprecated').optional(),
  minProfit: Joi.number().integer().min(0).optional(),
  maxDistance: Joi.number().integer().min(0).optional(),
  cargoCapacity: Joi.number().integer().min(0).optional(),
});

/**
 * User list query parameters
 */
export const userListQuerySchema = standardListQuerySchema.keys({
  'filter[role]': Joi.string().valid('user', 'admin', 'moderator').optional(),
  'filter[status]': Joi.string().valid('active', 'inactive', 'suspended').optional(),
});

/**
 * Organization list query parameters
 */
export const organizationListQuerySchema = standardListQuerySchema.keys({
  'filter[status]': Joi.string().valid('active', 'inactive', 'pending').optional(),
  'filter[type]': Joi.string().trim().max(50).optional(),
});

/**
 * Helper to validate query parameters
 */
export function validateQueryParams(
  query: Record<string, unknown>,
  schema: Joi.ObjectSchema
): { value: Record<string, unknown>; error?: Joi.ValidationError } {
  return schema.validate(query, {
    allowUnknown: true, // Allow filter[*] patterns
    stripUnknown: false,
  });
}
