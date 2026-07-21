import Joi from 'joi';

/**
 * Organization configuration validation schemas
 * Covers: key-value config, import/export, schema retrieval
 */
export const configSchemas = {
  // Update all config settings
  updateAll: Joi.object({
    settings: Joi.object()
      .pattern(
        Joi.string().trim().min(1).max(100),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
      )
      .required(),
  }),

  // Update a single config key
  updateKey: Joi.object({
    value: Joi.alternatives()
      .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
      .required(),
    description: Joi.string().trim().max(500).optional(),
  }),

  // Import config
  importConfig: Joi.object({
    settings: Joi.object()
      .pattern(
        Joi.string().trim().min(1).max(100),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
      )
      .required(),
    overwrite: Joi.boolean().default(false),
  }),

  // Query params
  query: Joi.object({
    scope: Joi.string().valid('global', 'org', 'user').optional(),
  }),

  // Export query
  exportQuery: Joi.object({
    scope: Joi.string().valid('global', 'org', 'user').optional(),
    format: Joi.string().valid('json', 'yaml').default('json'),
  }),

  // Key param
  param: Joi.object({
    key: Joi.string().trim().min(1).max(100).required(),
  }),
};
