import Joi from 'joi';

import { description, pagination } from './common';

const type = Joi.string().max(50).trim();
const reason = Joi.string().max(2000).trim();
const comment = Joi.string().max(2000).trim();
const resourceId = Joi.string().uuid();
const userId = Joi.string().uuid();

export const approvalSchemas = {
  create: Joi.object({
    type: type.required(),
    resourceId: resourceId.required(),
    description,
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    metadata: Joi.object().unknown(true),
  }),

  approve: Joi.object({
    comment,
    conditions: Joi.array().items(Joi.string().max(500)).max(10),
  }),

  reject: Joi.object({
    reason: reason.required(),
    comment,
  }),

  delegate: Joi.object({
    userId: userId.required(),
    comment,
  }),

  query: pagination.keys({
    status: Joi.string().valid('pending', 'approved', 'rejected', 'delegated', 'expired'),
    type,
    assignedTo: userId,
    requestedBy: userId,
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().greater(Joi.ref('dateFrom')),
  }),

  param: Joi.object({
    approvalId: Joi.string().uuid().required(),
  }),
};
