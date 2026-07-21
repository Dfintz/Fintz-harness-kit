import Joi from 'joi';

import { description, paginationKeys } from './common';

/**
 * Report management validation schemas
 * Covers: report CRUD, generation, scheduling, templates
 */
export const reportSchemas = {
  // Create report
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    type: Joi.string()
      .valid('fleet_summary', 'member_activity', 'financial', 'operations', 'custom')
      .required(),
    description,
    parameters: Joi.object().optional(),
    templateId: Joi.string().trim().max(100).optional(),
  }),

  // Update report
  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description,
    parameters: Joi.object().optional(),
    status: Joi.string().valid('draft', 'active', 'archived').optional(),
  }).min(1),

  // Generate report
  generate: Joi.object({
    format: Joi.string().valid('json', 'csv', 'pdf').default('json'),
    dateRange: Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    }).optional(),
    filters: Joi.object().optional(),
  }),

  // Schedule report
  schedule: Joi.object({
    schedule: Joi.string().trim().min(1).max(100).required(),
    recipients: Joi.array().items(Joi.string().trim().max(255)).min(1).max(50).required(),
    format: Joi.string().valid('json', 'csv', 'pdf').default('pdf'),
    timezone: Joi.string().trim().max(50).default('UTC'),
  }),

  // Download query
  downloadQuery: Joi.object({
    format: Joi.string().valid('pdf', 'csv', 'xlsx', 'json').default('pdf'),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string()
      .valid('fleet_summary', 'member_activity', 'financial', 'operations', 'custom')
      .optional(),
    status: Joi.string().valid('draft', 'active', 'archived', 'generated').optional(),
  }),

  // Report ID param
  param: Joi.object({
    reportId: Joi.string().trim().min(1).max(100).required(),
  }),
};
