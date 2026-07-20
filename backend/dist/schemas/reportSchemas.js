"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.reportSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        type: joi_1.default.string()
            .valid('fleet_summary', 'member_activity', 'financial', 'operations', 'custom')
            .required(),
        description: common_1.description,
        parameters: joi_1.default.object().optional(),
        templateId: joi_1.default.string().trim().max(100).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: common_1.description,
        parameters: joi_1.default.object().optional(),
        status: joi_1.default.string().valid('draft', 'active', 'archived').optional(),
    }).min(1),
    generate: joi_1.default.object({
        format: joi_1.default.string().valid('json', 'csv', 'pdf').default('json'),
        dateRange: joi_1.default.object({
            startDate: joi_1.default.date().iso().required(),
            endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).required(),
        }).optional(),
        filters: joi_1.default.object().optional(),
    }),
    schedule: joi_1.default.object({
        schedule: joi_1.default.string().trim().min(1).max(100).required(),
        recipients: joi_1.default.array().items(joi_1.default.string().trim().max(255)).min(1).max(50).required(),
        format: joi_1.default.string().valid('json', 'csv', 'pdf').default('pdf'),
        timezone: joi_1.default.string().trim().max(50).default('UTC'),
    }),
    downloadQuery: joi_1.default.object({
        format: joi_1.default.string().valid('pdf', 'csv', 'xlsx', 'json').default('pdf'),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string()
            .valid('fleet_summary', 'member_activity', 'financial', 'operations', 'custom')
            .optional(),
        status: joi_1.default.string().valid('draft', 'active', 'archived', 'generated').optional(),
    }),
    param: joi_1.default.object({
        reportId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
};
//# sourceMappingURL=reportSchemas.js.map