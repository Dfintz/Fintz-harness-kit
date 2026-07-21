import Joi from 'joi';

/**
 * Integration status domain validation schemas
 * Covers: health dashboard queries, specific integration lookups
 */

export const integrationSchemas = {
  // GET /admin/integrations/health/:name — validate integration name param
  integrationName: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({ 'string.empty': 'Integration name is required' }),
  }),
};
