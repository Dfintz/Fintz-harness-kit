import Joi from 'joi';

import { pagination } from './common';

/**
 * Export validation schemas (v2)
 */

export const exportSchemas = {
  create: Joi.object({
    type: Joi.string().trim().valid('full', 'fleet', 'profile', 'activity').default('full'),
    format: Joi.string().trim().valid('json', 'csv').default('json'),
    filters: Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    }).optional(),
  }),

  query: pagination,

  attendanceCorrelation: Joi.object({
    activityId: Joi.string().trim().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    format: Joi.string().trim().valid('json', 'csv').default('json'),
  }),
};
