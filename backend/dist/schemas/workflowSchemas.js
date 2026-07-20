"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.workflowSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        type: joi_1.default.string().valid('scheduled', 'event_triggered', 'manual', 'conditional').required(),
        description: common_1.description,
        trigger: joi_1.default.object({
            event: joi_1.default.string().trim().max(100).optional(),
            schedule: joi_1.default.string().trim().max(100).optional(),
            conditions: joi_1.default.array().items(joi_1.default.object()).optional(),
        }).optional(),
        actions: joi_1.default.array()
            .items(joi_1.default.object({
            type: joi_1.default.string().trim().min(1).max(100).required(),
            config: joi_1.default.object().optional(),
            order: joi_1.default.number().integer().min(0).optional(),
        }))
            .min(1)
            .max(50)
            .required(),
        enabled: joi_1.default.boolean().default(true),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: common_1.description,
        trigger: joi_1.default.object({
            event: joi_1.default.string().trim().max(100).optional(),
            schedule: joi_1.default.string().trim().max(100).optional(),
            conditions: joi_1.default.array().items(joi_1.default.object()).optional(),
        }).optional(),
        actions: joi_1.default.array()
            .items(joi_1.default.object({
            type: joi_1.default.string().trim().min(1).max(100).required(),
            config: joi_1.default.object().optional(),
            order: joi_1.default.number().integer().min(0).optional(),
        }))
            .min(1)
            .max(50)
            .optional(),
    }).min(1),
    execute: joi_1.default.object({
        parameters: joi_1.default.object().optional(),
        dryRun: joi_1.default.boolean().default(false),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string().valid('scheduled', 'event_triggered', 'manual', 'conditional').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'error').optional(),
        enabled: joi_1.default.boolean().optional(),
    }),
    executionsQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string().valid('running', 'completed', 'failed', 'cancelled').optional(),
    }),
    param: joi_1.default.object({
        workflowId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
};
//# sourceMappingURL=workflowSchemas.js.map