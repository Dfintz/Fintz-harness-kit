"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.monitoringSchemas = {
    trackWebVitals: joi_1.default.object({
        metrics: joi_1.default.array()
            .items(joi_1.default.object({
            name: joi_1.default.string().trim().min(1).max(50).required(),
            value: joi_1.default.number().required(),
            rating: joi_1.default.string().valid('good', 'needs-improvement', 'poor').required(),
            delta: joi_1.default.number().required(),
            id: joi_1.default.string().trim().max(100).required(),
            navigationType: joi_1.default.string().trim().max(50).required(),
            timestamp: joi_1.default.number().integer().required(),
            url: joi_1.default.string().trim().max(2000).required(),
            userAgent: joi_1.default.string().trim().max(500).required(),
        }))
            .min(1)
            .max(100)
            .required(),
    }),
    trackError: joi_1.default.object({
        error: joi_1.default.object({
            name: joi_1.default.string().trim().max(200).required(),
            message: joi_1.default.string().trim().max(5000).required(),
            stack: joi_1.default.string().trim().max(10000).optional(),
        }).required(),
        severity: joi_1.default.string().valid('critical', 'error', 'warning', 'info').default('error'),
        context: joi_1.default.object({
            userId: joi_1.default.string().trim().optional(),
            organizationId: joi_1.default.string().trim().optional(),
            page: joi_1.default.string().trim().max(500).optional(),
            route: joi_1.default.string().trim().max(500).optional(),
            component: joi_1.default.string().trim().max(200).optional(),
            userAgent: joi_1.default.string().trim().max(500).optional(),
            browserInfo: joi_1.default.object({
                name: joi_1.default.string().trim().optional(),
                version: joi_1.default.string().trim().optional(),
                os: joi_1.default.string().trim().optional(),
                platform: joi_1.default.string().trim().optional(),
            }).optional(),
            screenResolution: joi_1.default.string().trim().max(20).optional(),
            additionalData: joi_1.default.object().optional(),
        }).optional(),
        timestamp: joi_1.default.string().isoDate().optional(),
        tags: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
    }),
    reportQuery: joi_1.default.object({
        period: joi_1.default.string().valid('1h', '6h', '24h', '7d', '30d').default('24h'),
        includeHistory: joi_1.default.boolean().default(false),
    }),
    alertConfig: joi_1.default.object({
        metricName: joi_1.default.string().trim().min(1).max(100).required(),
        threshold: joi_1.default.number().required(),
        condition: joi_1.default.string().valid('above', 'below', 'equals').required(),
        severity: joi_1.default.string().valid('critical', 'warning', 'info').default('warning'),
        enabled: joi_1.default.boolean().default(true),
        cooldownMinutes: joi_1.default.number().integer().min(1).max(1440).default(15),
        notificationChannels: joi_1.default.array()
            .items(joi_1.default.string().valid('email', 'discord', 'webhook'))
            .min(1)
            .optional(),
    }),
    metricsQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        metricName: joi_1.default.string().trim().optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        rating: joi_1.default.string().valid('good', 'needs-improvement', 'poor').optional(),
    }),
};
//# sourceMappingURL=monitoringSchemas.js.map