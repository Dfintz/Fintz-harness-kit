import Joi from 'joi';

import { pagination } from './common';

const resourceType = Joi.string().max(50).trim();
const resourceId = Joi.string().uuid();

export const archiveSchemas = {
  create: Joi.object({
    resourceType: resourceType.required(),
    resourceId: resourceId.required(),
    reason: Joi.string().max(500).trim(),
  }),

  bulk: Joi.object({
    records: Joi.array()
      .items(
        Joi.object({
          resourceType: resourceType.required(),
          resourceId: resourceId.required(),
        })
      )
      .min(1)
      .max(100)
      .required(),
    reason: Joi.string().max(500).trim(),
  }),

  query: pagination.keys({
    type: resourceType,
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  }),

  search: pagination.keys({
    q: Joi.string().max(200).trim(),
    type: resourceType,
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  }),

  param: Joi.object({
    archiveId: Joi.string().uuid().required(),
  }),
};
