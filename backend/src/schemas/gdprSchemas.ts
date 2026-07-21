import Joi from 'joi';

/**
 * GDPR Validation Schemas
 *
 * Validation for GDPR-related endpoints including consent and export requests
 */

export const gdprSchemas = {
  // Request data export
  requestExport: Joi.object({
    // Currently no body parameters required
    // User ID comes from authenticated session
  }),

  // Get export request status (query params)
  exportRequestQuery: Joi.object({
    token: Joi.string()
      .trim()
      .min(1)
      .when('$isDownload', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'string.empty': 'Download token is required',
        'any.required': 'Download token is required',
      }),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),

  // Export request ID parameter
  exportRequestId: Joi.object({
    requestId: Joi.string().uuid().required().messages({
      'string.empty': 'Export request ID is required',
      'string.guid': 'Invalid export request ID format',
      'any.required': 'Export request ID is required',
    }),
  }),

  // Admin: list GDPR requests query params
  adminRequestsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};
