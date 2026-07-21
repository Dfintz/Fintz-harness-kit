import Joi from 'joi';

/**
 * Validation schemas for admin legal hold management endpoints
 */
export const legalHoldSchemas = {
  /**
   * POST /api/v2/admin/legal-holds
   * Create a new legal hold
   */
  create: Joi.object({
    userId: Joi.string().uuid().required().messages({
      'string.guid': 'userId must be a valid UUID',
      'any.required': 'userId is required',
    }),
    reason: Joi.string().trim().min(10).max(500).required().messages({
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason must not exceed 500 characters',
      'any.required': 'reason is required',
    }),
    holdUntil: Joi.date().iso().optional().min('now').messages({
      'date.min': 'holdUntil must be a future date',
      'date.format': 'holdUntil must be a valid ISO date string',
    }),
  }),

  /**
   * POST /api/v2/admin/legal-holds/:id/release
   * Release an active legal hold
   */
  release: Joi.object({
    reason: Joi.string().trim().min(10).max(500).required().messages({
      'string.min': 'Release reason must be at least 10 characters',
      'string.max': 'Release reason must not exceed 500 characters',
      'any.required': 'Release reason is required',
    }),
  }),

  /**
   * Params schema for :id routes
   */
  idParam: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Legal hold ID must be a valid UUID',
    }),
  }),
};
