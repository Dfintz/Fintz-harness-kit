import Joi from 'joi';

/**
 * API Key validation schemas
 */
export const apiKeySchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    scopes: Joi.array()
      .items(
        Joi.string().valid(
          'read:activities',
          'write:activities',
          'read:fleet',
          'read:profile',
          '*'
        )
      )
      .min(1)
      .max(10)
      .required(),
    expiresInDays: Joi.number().integer().min(1).max(365).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    scopes: Joi.array()
      .items(
        Joi.string().valid(
          'read:activities',
          'write:activities',
          'read:fleet',
          'read:profile',
          '*'
        )
      )
      .min(1)
      .max(10)
      .optional(),
  }),
};
