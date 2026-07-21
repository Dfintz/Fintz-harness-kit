import Joi from 'joi';

import { description, pagination } from './common';

const widgetType = Joi.string()
  .valid('chart', 'table', 'metric', 'list', 'map', 'timeline', 'custom')
  .required();

const position = Joi.object({
  x: Joi.number().integer().min(0).required(),
  y: Joi.number().integer().min(0).required(),
  w: Joi.number().integer().min(1).max(12).required(),
  h: Joi.number().integer().min(1).max(12).required(),
});

export const dashboardSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(200).trim().required(),
    description,
    type: Joi.string().valid('personal', 'organization', 'fleet', 'logistics').default('personal'),
    layout: Joi.string().valid('grid', 'freeform').default('grid'),
    isDefault: Joi.boolean().default(false),
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(200).trim(),
    description,
    type: Joi.string().valid('personal', 'organization', 'fleet', 'logistics'),
    layout: Joi.string().valid('grid', 'freeform'),
    isDefault: Joi.boolean(),
  }).min(1),

  addWidget: Joi.object({
    type: widgetType,
    title: Joi.string().min(1).max(200).trim().required(),
    position,
    config: Joi.object().unknown(true),
    dataSource: Joi.string().max(200).trim(),
  }),

  updateWidget: Joi.object({
    title: Joi.string().min(1).max(200).trim(),
    position,
    config: Joi.object().unknown(true),
    dataSource: Joi.string().max(200).trim(),
  }).min(1),

  share: Joi.object({
    userIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
    permissions: Joi.string().valid('view', 'edit', 'manage').default('view'),
  }),

  query: pagination.keys({
    type: Joi.string().valid('personal', 'organization', 'fleet', 'logistics'),
    scope: Joi.string().valid('own', 'shared', 'all').default('own'),
  }),

  param: Joi.object({
    dashboardId: Joi.string().uuid().required(),
  }),

  widgetParam: Joi.object({
    dashboardId: Joi.string().uuid().required(),
    widgetId: Joi.string().uuid().required(),
  }),
};
