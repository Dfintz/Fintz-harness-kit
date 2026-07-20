"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.starCommsSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const ExternalIntegration_1 = require("../models/ExternalIntegration");
const SHARE_TARGET_TYPES = ['federation', 'organization'];
const starCommsSharingSchema = joi_1.default.object({
    enabled: joi_1.default.boolean().required(),
    whitelist: joi_1.default.array()
        .items(joi_1.default.object({
        type: joi_1.default.string()
            .valid(...SHARE_TARGET_TYPES)
            .required(),
        targetId: joi_1.default.alternatives()
            .conditional('type', {
            is: 'federation',
            then: joi_1.default.string().uuid().required(),
            otherwise: joi_1.default.string().trim().min(1).max(100).required(),
        })
            .required(),
        targetName: joi_1.default.string().trim().max(200).optional(),
    }))
        .max(50)
        .default([]),
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
    sharing: starCommsSharingSchema.optional(),
});
exports.starCommsSchemas = {
    federationIdParam: joi_1.default.object({
        federationId: joi_1.default.string().uuid().required(),
    }),
    updateFederationConfigBody: joi_1.default.object({
        fleetId: joi_1.default.string().uuid().optional(),
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        status: joi_1.default.string()
            .valid(...Object.values(ExternalIntegration_1.IntegrationStatus))
            .optional(),
        enabled: joi_1.default.boolean().optional(),
        starCommsConfig: starCommsConfigSchema.required(),
    }).min(1),
};
//# sourceMappingURL=starCommsSchemas.js.map