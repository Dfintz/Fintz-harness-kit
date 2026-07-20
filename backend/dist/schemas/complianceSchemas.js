"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.complianceSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.complianceSchemas = {
    licenseExport: joi_1.default.object({
        format: joi_1.default.string().valid('json', 'csv', 'text').default('json'),
        includeDevDependencies: joi_1.default.boolean().default(false),
        filter: joi_1.default.string().valid('all', 'problematic', 'unknown').default('all'),
    }),
    createRetentionPolicy: joi_1.default.object({
        dataType: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({ 'string.empty': 'Data type is required' }),
        retentionDays: joi_1.default.number()
            .integer()
            .min(1)
            .max(3650)
            .required()
            .messages({ 'number.base': 'Retention days must be a number' }),
        action: joi_1.default.string()
            .valid('delete', 'anonymize', 'archive')
            .required()
            .messages({ 'any.only': 'Action must be one of: delete, anonymize, archive' }),
        enabled: joi_1.default.boolean().default(true),
        description: joi_1.default.string().trim().max(500).optional(),
        excludePatterns: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    }),
    updateRetentionPolicy: joi_1.default.object({
        retentionDays: joi_1.default.number().integer().min(1).max(3650).optional(),
        action: joi_1.default.string().valid('delete', 'anonymize', 'archive').optional(),
        enabled: joi_1.default.boolean().optional(),
        description: joi_1.default.string().trim().max(500).optional(),
        excludePatterns: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    }),
    executeRetention: joi_1.default.object({
        dataType: joi_1.default.string().trim().min(1).max(100).optional(),
        dryRun: joi_1.default.boolean().default(true),
        maxRecords: joi_1.default.number().integer().min(1).max(100000).default(10000),
    }),
    retentionQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        dataType: joi_1.default.string().trim().optional(),
        enabled: joi_1.default.boolean().optional(),
    }),
    auditQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        severity: joi_1.default.string().valid('critical', 'high', 'medium', 'low').optional(),
        status: joi_1.default.string().valid('INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED').optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
//# sourceMappingURL=complianceSchemas.js.map