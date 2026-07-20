"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobDashboardSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.jobDashboardSchemas = {
    getDashboardOverview: {
        query: joi_1.default.object({
            includeDisabled: joi_1.default.boolean().default(false),
        }).options({ allowUnknown: false }),
    },
    getJobStatus: {
        params: joi_1.default.object({
            jobId: joi_1.default.string().trim().required(),
        }),
    },
    getAllJobStatuses: {
        query: joi_1.default.object({
            category: joi_1.default.string()
                .valid('cleanup', 'sync', 'notification', 'analytics', 'maintenance', 'security', 'integration', 'other')
                .optional(),
        }).options({ allowUnknown: false }),
    },
    getJobExecutionHistory: {
        params: joi_1.default.object({
            jobId: joi_1.default.string().trim().required(),
        }),
        query: joi_1.default.object({
            limit: joi_1.default.number().integer().min(1).max(200).default(50),
        }).options({ allowUnknown: false }),
    },
    getRecentExecutions: {
        query: joi_1.default.object({
            limit: joi_1.default.number().integer().min(1).max(100).default(20),
        }).options({ allowUnknown: false }),
    },
    getActiveAlerts: {},
    getJobAlerts: {
        params: joi_1.default.object({
            jobId: joi_1.default.string().trim().required(),
        }),
    },
    acknowledgeAlert: {
        params: joi_1.default.object({
            alertId: joi_1.default.string().trim().required(),
        }),
        body: joi_1.default.object({
            acknowledgedBy: joi_1.default.string().trim().max(100).optional(),
        }).options({ allowUnknown: false }),
    },
    resolveAlert: {
        params: joi_1.default.object({
            alertId: joi_1.default.string().trim().required(),
        }),
    },
    getJobPerformanceTrends: {
        params: joi_1.default.object({
            jobId: joi_1.default.string().trim().required(),
        }),
        query: joi_1.default.object({
            periodMinutes: joi_1.default.number().integer().min(1).max(1440).default(60),
        }).options({ allowUnknown: false }),
    },
};
//# sourceMappingURL=jobDashboardSchemas.js.map