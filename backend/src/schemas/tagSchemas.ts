import Joi from 'joi';

export const tagSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    color: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .default('#6366f1'),
    description: Joi.string().trim().max(500).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    color: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    description: Joi.string().trim().max(500).allow('').optional(),
  }).min(1),

  apply: Joi.object({
    resourceType: Joi.string().trim().min(1).max(64).required(),
    resourceId: Joi.string().trim().min(1).max(255).required(),
  }),

  remove: Joi.object({
    resourceType: Joi.string().trim().min(1).max(64).required(),
    resourceId: Joi.string().trim().min(1).max(255).required(),
  }),

  query: Joi.object({
    search: Joi.string().trim().max(200).optional(),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),

  param: Joi.object({
    tagId: Joi.string().uuid().required(),
  }),
};
