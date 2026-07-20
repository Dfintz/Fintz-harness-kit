"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalIntegrationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.externalIntegrationSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        type: joi_1.default.string().valid('webhook', 'api', 'rss', 'custom').required(),
        fleetId: common_1.id,
        config: joi_1.default.object({
            url: joi_1.default.string().uri().required(),
            method: joi_1.default.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').default('GET'),
            headers: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
            authType: joi_1.default.string().valid('none', 'basic', 'bearer', 'api_key').default('none'),
            authToken: joi_1.default.string().trim().max(500).optional(),
            syncInterval: joi_1.default.number().integer().min(5).max(1440).optional(),
        }).required(),
        description: common_1.description,
        enabled: joi_1.default.boolean().default(true),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        config: joi_1.default.object({
            url: joi_1.default.string().uri().optional(),
            method: joi_1.default.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').optional(),
            headers: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
            authType: joi_1.default.string().valid('none', 'basic', 'bearer', 'api_key').optional(),
            authToken: joi_1.default.string().trim().max(500).optional(),
            syncInterval: joi_1.default.number().integer().min(5).max(1440).optional(),
        }).optional(),
        description: common_1.description,
        enabled: joi_1.default.boolean().optional(),
    }),
    sync: joi_1.default.object({
        categories: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        fullSync: joi_1.default.boolean().default(false),
        dryRun: joi_1.default.boolean().default(false),
    }),
    webhook: joi_1.default.object({
        event: joi_1.default.string().trim().min(1).max(100).required(),
        data: joi_1.default.object().required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string().valid('webhook', 'api', 'rss', 'custom').optional(),
        enabled: joi_1.default.boolean().optional(),
        fleetId: joi_1.default.string().trim().optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
//# sourceMappingURL=externalIntegrationSchemas.js.map