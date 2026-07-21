import Joi from 'joi';

/**
 * Rate Limit validation schemas (v2)
 */

export const rateLimitSchemas = {
  updateConfig: Joi.object({
    endpoints: Joi.object()
      .pattern(
        Joi.string(),
        Joi.object({
          windowMs: Joi.number().integer().min(1000).max(3600000).optional(),
          maxRequests: Joi.number().integer().min(1).max(10000).optional(),
        })
      )
      .required(),
  }),

  reset: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
  }),
};
