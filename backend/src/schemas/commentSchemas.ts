import Joi from 'joi';

import { paginationKeys } from './common';

export const commentSchemas = {
  create: Joi.object({
    content: Joi.string().trim().min(1).max(5000).required(),
    resourceType: Joi.string().trim().min(1).max(64).required(),
    resourceId: Joi.string().trim().min(1).max(255).required(),
  }),

  update: Joi.object({
    content: Joi.string().trim().min(1).max(5000).required(),
  }),

  reply: Joi.object({
    content: Joi.string().trim().min(1).max(5000).required(),
  }),

  query: Joi.object({
    resourceType: Joi.string().trim().min(1).max(64).required(),
    resourceId: Joi.string().trim().min(1).max(255).required(),
    ...paginationKeys,
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  param: Joi.object({
    commentId: Joi.string().uuid().required(),
  }),
};
