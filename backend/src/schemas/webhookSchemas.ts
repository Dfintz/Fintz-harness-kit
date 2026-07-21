import Joi from 'joi';

import { description, id, paginationKeys } from './common';

/**
 * Webhook validation schemas
 */

// Webhook types enum values
const webhookTypes = ['discord', 'custom'];

// Webhook event types
const webhookEventTypes = [
  // Fleet events
  'fleet.created',
  'fleet.updated',
  'fleet.deleted',
  'fleet.member.joined',
  'fleet.member.left',

  // Member events
  'member.joined',
  'member.left',
  'member.role.changed',

  // Activity events
  'activity.created',
  'activity.started',
  'activity.completed',
  'activity.cancelled',
  'activity.participant.joined',
  'activity.participant.left',

  // Alert events
  'alert.created',
  'alert.resolved',

  // Ship events
  'ship.added',
  'ship.removed',
  'ship.transferred',
];

// Discord webhook configuration schema
const discordConfigSchema = Joi.object({
  webhookUrl: Joi.string()
    .uri({ scheme: ['https'] })
    .pattern(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/)
    .required()
    .messages({
      'string.pattern.base':
        'Discord webhook URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)',
    }),
  username: Joi.string().trim().min(1).max(80).optional(),
  avatarUrl: Joi.string()
    .uri({ scheme: ['https'] })
    .optional(),
  threadId: Joi.string().trim().optional(),
});

// Custom webhook authentication schema
const authenticationSchema = Joi.object({
  type: Joi.string().valid('none', 'basic', 'bearer', 'apiKey').required(),
  username: Joi.string().trim().when('type', {
    is: 'basic',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  password: Joi.string().when('type', {
    is: 'basic',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  token: Joi.string().when('type', {
    is: 'bearer',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  apiKey: Joi.string().when('type', {
    is: 'apiKey',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  apiKeyHeader: Joi.string().trim().optional(),
});

// Custom webhook configuration schema
const customConfigSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH').default('POST'),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  authentication: authenticationSchema.optional(),
});

export const webhookSchemas = {
  /**
   * Schema for creating a new webhook
   */
  create: Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    description,
    type: Joi.string()
      .valid(...webhookTypes)
      .required(),
    events: Joi.array()
      .items(Joi.string().valid(...webhookEventTypes))
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one event must be selected',
      }),

    // Discord configuration (required when type is 'discord')
    discordConfig: Joi.when('type', {
      is: 'discord',
      then: discordConfigSchema.required(),
      otherwise: Joi.optional(),
    }),

    // Custom webhook configuration (required when type is 'custom')
    customConfig: Joi.when('type', {
      is: 'custom',
      then: customConfigSchema.required(),
      otherwise: Joi.optional(),
    }),

    // Optional secret for HMAC signature (auto-generated for custom if not provided)
    // Minimum 40 characters for better security (64 chars recommended)
    secret: Joi.string().trim().min(40).max(128).optional(),

    // Retry configuration
    maxRetries: Joi.number().integer().min(0).max(10).default(3),
    retryDelayMs: Joi.number().integer().min(100).max(60000).default(1000),
    timeoutMs: Joi.number().integer().min(1000).max(120000).default(30000),

    notes: Joi.string().trim().max(1000).optional(),
  }),

  /**
   * Schema for updating an existing webhook
   */
  update: Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    description: Joi.string().trim().max(1000).optional().allow(''),
    events: Joi.array()
      .items(Joi.string().valid(...webhookEventTypes))
      .min(1)
      .optional()
      .messages({
        'array.min': 'At least one event must be selected',
      }),
    discordConfig: discordConfigSchema.optional(),
    customConfig: customConfigSchema.optional(),
    secret: Joi.string().trim().min(40).max(128).optional(),
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    retryDelayMs: Joi.number().integer().min(100).max(60000).optional(),
    timeoutMs: Joi.number().integer().min(1000).max(120000).optional(),
    enabled: Joi.boolean().optional(),
    notes: Joi.string().trim().max(1000).optional().allow(''),
  }),

  /**
   * Schema for triggering an event
   */
  triggerEvent: Joi.object({
    event: Joi.string()
      .valid(...webhookEventTypes)
      .required(),
    data: Joi.object().optional(),
  }),

  /**
   * Schema for ID parameter
   */
  param: Joi.object({
    id,
  }),

  /**
   * Schema for delivery history query
   */
  deliveryQuery: Joi.object({
    ...paginationKeys,
  }),

  /**
   * Schema for custom webhook test
   */
  testCustom: Joi.object({
    event: Joi.string()
      .valid(...webhookEventTypes)
      .optional(),
    data: Joi.object().optional(),
    includeSignature: Joi.boolean().optional(),
  }),

  /**
   * Schema for payload preview
   */
  payloadPreview: Joi.object({
    event: Joi.string()
      .valid(...webhookEventTypes)
      .optional(),
    data: Joi.object().optional(),
  }),

  /**
   * Schema for batch configuration
   */
  batchConfig: Joi.object({
    maxBatchSize: Joi.number().integer().min(1).max(100).optional(),
    maxWaitTimeMs: Joi.number().integer().min(1000).max(60000).optional(),
    enabled: Joi.boolean().optional(),
  }),

  /**
   * Schema for batch flush
   */
  batchFlush: Joi.object({
    webhookId: Joi.string().uuid().optional(),
  }),
};

// Export individual schemas for convenience
export const createWebhookSchema = webhookSchemas.create;
export const updateWebhookSchema = webhookSchemas.update;
export const triggerEventSchema = webhookSchemas.triggerEvent;
export const webhookParamSchema = webhookSchemas.param;
export const deliveryQuerySchema = webhookSchemas.deliveryQuery;
export const testCustomSchema = webhookSchemas.testCustom;
export const payloadPreviewSchema = webhookSchemas.payloadPreview;
export const batchConfigSchema = webhookSchemas.batchConfig;
export const batchFlushSchema = webhookSchemas.batchFlush;
