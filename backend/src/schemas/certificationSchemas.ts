import Joi from 'joi';

const certificationStatuses = ['active', 'revoked', 'expired'];

export const certificationSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().max(2000).optional(),
    requirements: Joi.string().trim().max(5000).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(2000).allow('').optional(),
    requirements: Joi.string().trim().max(5000).allow('').optional(),
  }).min(1),

  award: Joi.object({
    userId: Joi.string().uuid().required(),
  }),

  revoke: Joi.object({
    userId: Joi.string().uuid().required(),
    reason: Joi.string().trim().min(1).max(1000).required(),
  }),

  query: Joi.object({
    status: Joi.string()
      .valid(...certificationStatuses)
      .optional(),
    search: Joi.string().trim().max(200).optional(),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),

  param: Joi.object({
    certificationId: Joi.string().uuid().required(),
  }),
};
