"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationsV2Schemas = void 0;
const joi_1 = __importDefault(require("joi"));
const ExternalIntegration_1 = require("../models/ExternalIntegration");
const integrationIdSchema = joi_1.default.object({
    integrationId: joi_1.default.string()
        .guid({ version: ['uuidv4', 'uuidv5'] })
        .required(),
});
const starCommsConfigSchema = joi_1.default.object({
    baseUrl: joi_1.default.string()
        .uri({ scheme: ['http', 'https'] })
        .required(),
    shardId: joi_1.default.string().trim().max(120).optional(),
    metricsWindowMinutes: joi_1.default.number().integer().min(1).max(1440).optional(),
    keyReferenceId: joi_1.default.string().trim().max(200).optional(),
    featureFlags: joi_1.default.object().pattern(joi_1.default.string().trim().min(1), joi_1.default.boolean()).optional(),
    requiredPermission: joi_1.default.string().trim().max(200).optional(),
    minRolePriority: joi_1.default.number().integer().min(0).max(1000).optional(),
    sharing: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        whitelist: joi_1.default.array()
            .items(joi_1.default.object({
            type: joi_1.default.string().valid('organization', 'federation').required(),
            targetId: joi_1.default.string().trim().min(1).max(120).required(),
            targetName: joi_1.default.string().trim().max(200).optional(),
        }))
            .required(),
    }).optional(),
}).optional();
const authConfigSchema = joi_1.default.object({
    type: joi_1.default.string().valid('none', 'basic', 'bearer', 'apiKey', 'oauth2').required(),
    username: joi_1.default.string().trim().max(200).optional(),
    password: joi_1.default.string().trim().max(500).optional(),
    token: joi_1.default.string().trim().max(2000).optional(),
    apiKey: joi_1.default.string().trim().max(2000).optional(),
    apiKeyHeader: joi_1.default.string().trim().max(200).optional(),
    oauth2Config: joi_1.default.object({
        clientId: joi_1.default.string().trim().max(300).required(),
        clientSecret: joi_1.default.string().trim().max(1000).required(),
        tokenUrl: joi_1.default.string()
            .uri({ scheme: ['http', 'https'] })
            .required(),
        scopes: joi_1.default.array().items(joi_1.default.string().trim().max(120)).optional(),
    }).optional(),
}).required();
const apiConfigSchema = joi_1.default.object({
    baseUrl: joi_1.default.string()
        .uri({ scheme: ['http', 'https'] })
        .required(),
    endpoints: joi_1.default.object().pattern(joi_1.default.string().trim().min(1), joi_1.default.string().uri({ scheme: ['http', 'https'] })),
    rateLimit: joi_1.default.object({
        requests: joi_1.default.number().integer().min(1).required(),
        perSeconds: joi_1.default.number().integer().min(1).required(),
    }).optional(),
}).optional();
const webhookConfigSchema = joi_1.default.object({
    url: joi_1.default.string()
        .uri({ scheme: ['http', 'https'] })
        .required(),
    method: joi_1.default.string().valid('GET', 'POST', 'PUT', 'PATCH').required(),
    headers: joi_1.default.object()
        .pattern(joi_1.default.string().trim().min(1), joi_1.default.string().trim().max(500))
        .optional(),
    events: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(120)).min(1).required(),
    retryAttempts: joi_1.default.number().integer().min(0).max(10).optional(),
    retryDelay: joi_1.default.number().integer().min(0).max(60000).optional(),
}).optional();
const fieldMappingsSchema = joi_1.default.array()
    .items(joi_1.default.object({
    sourceField: joi_1.default.string().trim().min(1).max(200).required(),
    targetField: joi_1.default.string().trim().min(1).max(200).required(),
    transform: joi_1.default.string().trim().max(2000).optional(),
    default: joi_1.default.any().optional(),
}))
    .optional();
exports.integrationsV2Schemas = {
    listQuery: joi_1.default.object({
        fleetId: joi_1.default.string()
            .guid({ version: ['uuidv4', 'uuidv5'] })
            .required(),
        type: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.IntegrationType))
            .optional(),
        status: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.IntegrationStatus))
            .optional(),
    }),
    createBody: joi_1.default.object({
        fleetId: joi_1.default.string()
            .guid({ version: ['uuidv4', 'uuidv5'] })
            .required(),
        name: joi_1.default.string().trim().min(1).max(200).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        type: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.IntegrationType))
            .required(),
        syncDirection: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.SyncDirection))
            .required(),
        authConfig: authConfigSchema,
        webhookConfig: webhookConfigSchema,
        apiConfig: apiConfigSchema,
        starCommsConfig: starCommsConfigSchema,
        fieldMappings: fieldMappingsSchema,
        autoSync: joi_1.default.boolean().optional(),
        syncIntervalMinutes: joi_1.default.number().integer().min(1).max(10080).optional(),
        syncedCategories: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(120)).optional(),
        notes: joi_1.default.string().trim().max(2000).optional(),
    }),
    updateBody: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: joi_1.default.string().trim().max(2000).optional(),
        status: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.IntegrationStatus))
            .optional(),
        authConfig: authConfigSchema.optional(),
        webhookConfig: webhookConfigSchema,
        apiConfig: apiConfigSchema,
        starCommsConfig: starCommsConfigSchema,
        fieldMappings: fieldMappingsSchema,
        autoSync: joi_1.default.boolean().optional(),
        syncIntervalMinutes: joi_1.default.number().integer().min(1).max(10080).optional(),
        syncedCategories: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(120)).optional(),
        enabled: joi_1.default.boolean().optional(),
        notes: joi_1.default.string().trim().max(2000).optional(),
    }).min(1),
    integrationIdParam: integrationIdSchema,
    syncBody: joi_1.default.object({
        categories: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(120)).optional(),
        fullSync: joi_1.default.boolean().default(false),
        dryRun: joi_1.default.boolean().default(false),
    }),
    logsQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
    starCommsMetricsQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        windowMinutes: joi_1.default.number().integer().min(1).max(1440).optional(),
    }),
};
//# sourceMappingURL=integrationsV2Schemas.js.map