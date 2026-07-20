"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOperationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.adminOperationSchemas = {
    retentionExecuteBody: joi_1.default.object({
        dryRun: joi_1.default.boolean().default(false),
        categories: joi_1.default.array().items(joi_1.default.string().max(100)).optional(),
        olderThanDays: joi_1.default.number().integer().min(1).max(3650).optional(),
    }).optional(),
    integrationRefreshBody: joi_1.default.object({
        services: joi_1.default.array().items(joi_1.default.string().max(100)).optional(),
    }).optional(),
    userActionBody: joi_1.default.object({
        action: joi_1.default.string()
            .valid('suspend', 'unsuspend', 'warn', 'ban', 'unban', 'reset-password', 'force-logout')
            .required(),
        reason: joi_1.default.string().max(500).optional(),
        duration: joi_1.default.number().integer().min(1).optional(),
    }),
    shipDataImportBody: joi_1.default.object({
        csvContent: joi_1.default.string().max(10_000_000).required(),
        isVehicle: joi_1.default.boolean().default(false),
    }),
    externalCatalogSyncBody: joi_1.default.object({
        sources: joi_1.default.array().items(joi_1.default.string().valid('scmdb', 'sc-craft')).min(1).max(2).optional(),
        sampleSize: joi_1.default.number().integer().min(1).max(100).default(25),
    }).optional(),
    deletionRequestParams: joi_1.default.object({
        requestId: joi_1.default.string().uuid().required(),
    }),
    deletionRequestApproveBody: joi_1.default.object({
        reason: joi_1.default.string().max(500).optional(),
    }).optional(),
    deletionRequestRejectBody: joi_1.default.object({
        reason: joi_1.default.string().max(500).required(),
    }),
    anomalyAcknowledgeBody: joi_1.default.object({
        notes: joi_1.default.string().max(1000).optional(),
    }).optional(),
    anomalyParams: joi_1.default.object({
        id: joi_1.default.string().required(),
    }),
    jobIdParams: joi_1.default.object({
        jobId: joi_1.default.string().max(100).required(),
    }),
};
//# sourceMappingURL=adminOperationSchemas.js.map