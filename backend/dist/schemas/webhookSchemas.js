"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchFlushSchema = exports.batchConfigSchema = exports.payloadPreviewSchema = exports.testCustomSchema = exports.deliveryQuerySchema = exports.webhookParamSchema = exports.triggerEventSchema = exports.updateWebhookSchema = exports.createWebhookSchema = exports.webhookSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const webhookTypes = ['discord', 'custom'];
const webhookEventTypes = [
    'fleet.created',
    'fleet.updated',
    'fleet.deleted',
    'fleet.member.joined',
    'fleet.member.left',
    'member.joined',
    'member.left',
    'member.role.changed',
    'activity.created',
    'activity.started',
    'activity.completed',
    'activity.cancelled',
    'activity.participant.joined',
    'activity.participant.left',
    'alert.created',
    'alert.resolved',
    'ship.added',
    'ship.removed',
    'ship.transferred',
];
const discordConfigSchema = joi_1.default.object({
    webhookUrl: joi_1.default.string()
        .uri({ scheme: ['https'] })
        .pattern(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/)
        .required()
        .messages({
        'string.pattern.base': 'Discord webhook URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)',
    }),
    username: joi_1.default.string().trim().min(1).max(80).optional(),
    avatarUrl: joi_1.default.string()
        .uri({ scheme: ['https'] })
        .optional(),
    threadId: joi_1.default.string().trim().optional(),
});
const authenticationSchema = joi_1.default.object({
    type: joi_1.default.string().valid('none', 'basic', 'bearer', 'apiKey').required(),
    username: joi_1.default.string().trim().when('type', {
        is: 'basic',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional(),
    }),
    password: joi_1.default.string().when('type', {
        is: 'basic',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional(),
    }),
    token: joi_1.default.string().when('type', {
        is: 'bearer',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional(),
    }),
    apiKey: joi_1.default.string().when('type', {
        is: 'apiKey',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional(),
    }),
    apiKeyHeader: joi_1.default.string().trim().optional(),
});
const customConfigSchema = joi_1.default.object({
    url: joi_1.default.string()
        .uri({ scheme: ['http', 'https'] })
        .required(),
    method: joi_1.default.string().valid('GET', 'POST', 'PUT', 'PATCH').default('POST'),
    headers: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
    authentication: authenticationSchema.optional(),
});
exports.webhookSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).required(),
        description: common_1.description,
        type: joi_1.default.string()
            .valid(...webhookTypes)
            .required(),
        events: joi_1.default.array()
            .items(joi_1.default.string().valid(...webhookEventTypes))
            .min(1)
            .required()
            .messages({
            'array.min': 'At least one event must be selected',
        }),
        discordConfig: joi_1.default.when('type', {
            is: 'discord',
            then: discordConfigSchema.required(),
            otherwise: joi_1.default.optional(),
        }),
        customConfig: joi_1.default.when('type', {
            is: 'custom',
            then: customConfigSchema.required(),
            otherwise: joi_1.default.optional(),
        }),
        secret: joi_1.default.string().trim().min(40).max(128).optional(),
        maxRetries: joi_1.default.number().integer().min(0).max(10).default(3),
        retryDelayMs: joi_1.default.number().integer().min(100).max(60000).default(1000),
        timeoutMs: joi_1.default.number().integer().min(1000).max(120000).default(30000),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(''),
        events: joi_1.default.array()
            .items(joi_1.default.string().valid(...webhookEventTypes))
            .min(1)
            .optional()
            .messages({
            'array.min': 'At least one event must be selected',
        }),
        discordConfig: discordConfigSchema.optional(),
        customConfig: customConfigSchema.optional(),
        secret: joi_1.default.string().trim().min(40).max(128).optional(),
        maxRetries: joi_1.default.number().integer().min(0).max(10).optional(),
        retryDelayMs: joi_1.default.number().integer().min(100).max(60000).optional(),
        timeoutMs: joi_1.default.number().integer().min(1000).max(120000).optional(),
        enabled: joi_1.default.boolean().optional(),
        notes: joi_1.default.string().trim().max(1000).optional().allow(''),
    }),
    triggerEvent: joi_1.default.object({
        event: joi_1.default.string()
            .valid(...webhookEventTypes)
            .required(),
        data: joi_1.default.object().optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    deliveryQuery: joi_1.default.object({
        ...common_1.paginationKeys,
    }),
    testCustom: joi_1.default.object({
        event: joi_1.default.string()
            .valid(...webhookEventTypes)
            .optional(),
        data: joi_1.default.object().optional(),
        includeSignature: joi_1.default.boolean().optional(),
    }),
    payloadPreview: joi_1.default.object({
        event: joi_1.default.string()
            .valid(...webhookEventTypes)
            .optional(),
        data: joi_1.default.object().optional(),
    }),
    batchConfig: joi_1.default.object({
        maxBatchSize: joi_1.default.number().integer().min(1).max(100).optional(),
        maxWaitTimeMs: joi_1.default.number().integer().min(1000).max(60000).optional(),
        enabled: joi_1.default.boolean().optional(),
    }),
    batchFlush: joi_1.default.object({
        webhookId: joi_1.default.string().uuid().optional(),
    }),
};
exports.createWebhookSchema = exports.webhookSchemas.create;
exports.updateWebhookSchema = exports.webhookSchemas.update;
exports.triggerEventSchema = exports.webhookSchemas.triggerEvent;
exports.webhookParamSchema = exports.webhookSchemas.param;
exports.deliveryQuerySchema = exports.webhookSchemas.deliveryQuery;
exports.testCustomSchema = exports.webhookSchemas.testCustom;
exports.payloadPreviewSchema = exports.webhookSchemas.payloadPreview;
exports.batchConfigSchema = exports.webhookSchemas.batchConfig;
exports.batchFlushSchema = exports.webhookSchemas.batchFlush;
//# sourceMappingURL=webhookSchemas.js.map