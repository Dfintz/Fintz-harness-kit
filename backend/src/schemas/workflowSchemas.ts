import Joi from 'joi';

import { description, paginationKeys } from './common';

/**
 * Workflow & automation validation schemas
 * Covers: workflow CRUD, execution, enable/disable
 */
export const workflowSchemas = {
  // Create workflow
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    type: Joi.string().valid('scheduled', 'event_triggered', 'manual', 'conditional').required(),
    description,
    trigger: Joi.object({
      event: Joi.string().trim().max(100).optional(),
      schedule: Joi.string().trim().max(100).optional(),
      conditions: Joi.array().items(Joi.object()).optional(),
    }).optional(),
    actions: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().trim().min(1).max(100).required(),
          config: Joi.object().optional(),
          order: Joi.number().integer().min(0).optional(),
        })
      )
      .min(1)
      .max(50)
      .required(),
    enabled: Joi.boolean().default(true),
  }),

  // Update workflow
  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description,
    trigger: Joi.object({
      event: Joi.string().trim().max(100).optional(),
      schedule: Joi.string().trim().max(100).optional(),
      conditions: Joi.array().items(Joi.object()).optional(),
    }).optional(),
    actions: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().trim().min(1).max(100).required(),
          config: Joi.object().optional(),
          order: Joi.number().integer().min(0).optional(),
        })
      )
      .min(1)
      .max(50)
      .optional(),
  }).min(1),

  // Execute workflow
  execute: Joi.object({
    parameters: Joi.object().optional(),
    dryRun: Joi.boolean().default(false),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string().valid('scheduled', 'event_triggered', 'manual', 'conditional').optional(),
    status: Joi.string().valid('active', 'inactive', 'error').optional(),
    enabled: Joi.boolean().optional(),
  }),

  // Executions query
  executionsQuery: Joi.object({
    ...paginationKeys,
    status: Joi.string().valid('running', 'completed', 'failed', 'cancelled').optional(),
  }),

  // Workflow ID param
  param: Joi.object({
    workflowId: Joi.string().trim().min(1).max(100).required(),
  }),
};
