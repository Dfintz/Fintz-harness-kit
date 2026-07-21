import Joi from 'joi';

import { IntegrationStatus, IntegrationType, SyncDirection } from '../models/ExternalIntegration';

const integrationIdSchema = Joi.object({
  integrationId: Joi.string()
    .guid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
});

const starCommsConfigSchema = Joi.object({
  baseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  shardId: Joi.string().trim().max(120).optional(),
  metricsWindowMinutes: Joi.number().integer().min(1).max(1440).optional(),
  keyReferenceId: Joi.string().trim().max(200).optional(),
  featureFlags: Joi.object().pattern(Joi.string().trim().min(1), Joi.boolean()).optional(),
  requiredPermission: Joi.string().trim().max(200).optional(),
  minRolePriority: Joi.number().integer().min(0).max(1000).optional(),
  sharing: Joi.object({
    enabled: Joi.boolean().required(),
    whitelist: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('organization', 'federation').required(),
          targetId: Joi.string().trim().min(1).max(120).required(),
          targetName: Joi.string().trim().max(200).optional(),
        })
      )
      .required(),
  }).optional(),
}).optional();

const authConfigSchema = Joi.object({
  type: Joi.string().valid('none', 'basic', 'bearer', 'apiKey', 'oauth2').required(),
  username: Joi.string().trim().max(200).optional(),
  password: Joi.string().trim().max(500).optional(),
  token: Joi.string().trim().max(2000).optional(),
  apiKey: Joi.string().trim().max(2000).optional(),
  apiKeyHeader: Joi.string().trim().max(200).optional(),
  oauth2Config: Joi.object({
    clientId: Joi.string().trim().max(300).required(),
    clientSecret: Joi.string().trim().max(1000).required(),
    tokenUrl: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    scopes: Joi.array().items(Joi.string().trim().max(120)).optional(),
  }).optional(),
}).required();

const apiConfigSchema = Joi.object({
  baseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  endpoints: Joi.object().pattern(
    Joi.string().trim().min(1),
    Joi.string().uri({ scheme: ['http', 'https'] })
  ),
  rateLimit: Joi.object({
    requests: Joi.number().integer().min(1).required(),
    perSeconds: Joi.number().integer().min(1).required(),
  }).optional(),
}).optional();

const webhookConfigSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH').required(),
  headers: Joi.object()
    .pattern(Joi.string().trim().min(1), Joi.string().trim().max(500))
    .optional(),
  events: Joi.array().items(Joi.string().trim().min(1).max(120)).min(1).required(),
  retryAttempts: Joi.number().integer().min(0).max(10).optional(),
  retryDelay: Joi.number().integer().min(0).max(60000).optional(),
}).optional();

const fieldMappingsSchema = Joi.array()
  .items(
    Joi.object({
      sourceField: Joi.string().trim().min(1).max(200).required(),
      targetField: Joi.string().trim().min(1).max(200).required(),
      transform: Joi.string().trim().max(2000).optional(),
      default: Joi.any().optional(),
    })
  )
  .optional();

export const integrationsV2Schemas = {
  listQuery: Joi.object({
    fleetId: Joi.string()
      .guid({ version: ['uuidv4', 'uuidv5'] })
      .required(),
    type: Joi.string()
      .valid(...Object.values(IntegrationType))
      .optional(),
    status: Joi.string()
      .valid(...Object.values(IntegrationStatus))
      .optional(),
  }),

  createBody: Joi.object({
    fleetId: Joi.string()
      .guid({ version: ['uuidv4', 'uuidv5'] })
      .required(),
    name: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().max(2000).optional(),
    type: Joi.string()
      .valid(...Object.values(IntegrationType))
      .required(),
    syncDirection: Joi.string()
      .valid(...Object.values(SyncDirection))
      .required(),
    authConfig: authConfigSchema,
    webhookConfig: webhookConfigSchema,
    apiConfig: apiConfigSchema,
    starCommsConfig: starCommsConfigSchema,
    fieldMappings: fieldMappingsSchema,
    autoSync: Joi.boolean().optional(),
    syncIntervalMinutes: Joi.number().integer().min(1).max(10080).optional(),
    syncedCategories: Joi.array().items(Joi.string().trim().min(1).max(120)).optional(),
    notes: Joi.string().trim().max(2000).optional(),
  }),

  updateBody: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(2000).optional(),
    status: Joi.string()
      .valid(...Object.values(IntegrationStatus))
      .optional(),
    authConfig: authConfigSchema.optional(),
    webhookConfig: webhookConfigSchema,
    apiConfig: apiConfigSchema,
    starCommsConfig: starCommsConfigSchema,
    fieldMappings: fieldMappingsSchema,
    autoSync: Joi.boolean().optional(),
    syncIntervalMinutes: Joi.number().integer().min(1).max(10080).optional(),
    syncedCategories: Joi.array().items(Joi.string().trim().min(1).max(120)).optional(),
    enabled: Joi.boolean().optional(),
    notes: Joi.string().trim().max(2000).optional(),
  }).min(1),

  integrationIdParam: integrationIdSchema,

  syncBody: Joi.object({
    categories: Joi.array().items(Joi.string().trim().min(1).max(120)).optional(),
    fullSync: Joi.boolean().default(false),
    dryRun: Joi.boolean().default(false),
  }),

  logsQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  starCommsMetricsQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    windowMinutes: Joi.number().integer().min(1).max(1440).optional(),
  }),
};
