"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paramSchemas = exports.featureFlagSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.featureFlagSchemas = {
    create: joi_1.default.object({
        id: joi_1.default.string().trim().min(3).max(100).pattern(/^[a-z0-9-]+$/).required()
            .messages({
            'string.pattern.base': 'Flag ID must contain only lowercase letters, numbers, and hyphens'
        }),
        name: joi_1.default.string().trim().min(3).max(200).required(),
        description: joi_1.default.string().trim().min(10).max(1000).required(),
        status: joi_1.default.string().valid('enabled', 'disabled', 'beta', 'percentage').required(),
        scope: joi_1.default.string().valid('global', 'organization', 'user', 'beta_users').required(),
        percentage: joi_1.default.number().integer().min(0).max(100)
            .when('status', {
            is: 'percentage',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        targetOrganizations: joi_1.default.array().items(joi_1.default.string().trim()).min(1)
            .when('scope', {
            is: 'organization',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        targetUsers: joi_1.default.array().items(joi_1.default.string().trim()).min(1)
            .when('scope', {
            is: 'user',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        metadata: joi_1.default.object().optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(200).optional(),
        description: joi_1.default.string().trim().min(10).max(1000).optional(),
        status: joi_1.default.string().valid('enabled', 'disabled', 'beta', 'percentage').optional(),
        scope: joi_1.default.string().valid('global', 'organization', 'user', 'beta_users').optional(),
        percentage: joi_1.default.number().integer().min(0).max(100)
            .when('status', {
            is: 'percentage',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        targetOrganizations: joi_1.default.array().items(joi_1.default.string().trim()).min(1)
            .when('scope', {
            is: 'organization',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        targetUsers: joi_1.default.array().items(joi_1.default.string().trim()).min(1)
            .when('scope', {
            is: 'user',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional()
        }),
        metadata: joi_1.default.object().optional(),
    }).min(1),
    evaluateBatch: joi_1.default.object({
        flagIds: joi_1.default.array().items(joi_1.default.string().trim()).min(1).max(50).required()
            .messages({
            'array.max': 'Cannot evaluate more than 50 flags at once'
        }),
    }),
    analyticsQuery: joi_1.default.object({
        days: joi_1.default.number().integer().min(1).max(90).optional().default(30)
            .messages({
            'number.max': 'Analytics period cannot exceed 90 days'
        }),
    }),
};
exports.paramSchemas = {
    featureFlagId: joi_1.default.object({
        id: joi_1.default.string().trim().required(),
    }),
    flagId: joi_1.default.object({
        flagId: joi_1.default.string().trim().required(),
    }),
};
//# sourceMappingURL=featureFlagSchemas.js.map