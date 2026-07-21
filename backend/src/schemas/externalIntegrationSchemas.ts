import Joi from 'joi';

import { description, id, paginationKeys } from './common';

/**
 * External integration validation schemas
 * Covers: external service integrations, sync operations, webhooks
 */

export const externalIntegrationSchemas = {
  // Create integration
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    type: Joi.string().valid('webhook', 'api', 'rss', 'custom').required(),
    fleetId: id,
    config: Joi.object({
      url: Joi.string().uri().required(),
      method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').default('GET'),
      headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
      authType: Joi.string().valid('none', 'basic', 'bearer', 'api_key').default('none'),
      authToken: Joi.string().trim().max(500).optional(),
      syncInterval: Joi.number().integer().min(5).max(1440).optional(), // minutes
    }).required(),
    description,
    enabled: Joi.boolean().default(true),
  }),

  // Update integration
  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    config: Joi.object({
      url: Joi.string().uri().optional(),
      method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').optional(),
      headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
      authType: Joi.string().valid('none', 'basic', 'bearer', 'api_key').optional(),
      authToken: Joi.string().trim().max(500).optional(),
      syncInterval: Joi.number().integer().min(5).max(1440).optional(),
    }).optional(),
    description,
    enabled: Joi.boolean().optional(),
  }),

  // Sync request
  sync: Joi.object({
    categories: Joi.array().items(Joi.string().trim()).optional(),
    fullSync: Joi.boolean().default(false),
    dryRun: Joi.boolean().default(false),
  }),

  // Webhook payload
  webhook: Joi.object({
    event: Joi.string().trim().min(1).max(100).required(),
    data: Joi.object().required(),
  }),

  // Query params
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string().valid('webhook', 'api', 'rss', 'custom').optional(),
    enabled: Joi.boolean().optional(),
    fleetId: Joi.string().trim().optional(),
  }),

  param: Joi.object({ id }),
};
