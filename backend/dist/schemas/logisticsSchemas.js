"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.logisticsSchemas = {
    createInventoryItem: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        category: joi_1.default.string().trim().required(),
        quantity: joi_1.default.number().integer().min(0).required(),
        unit: joi_1.default.string().trim().required(),
        location: joi_1.default.string().trim().optional(),
        minStock: joi_1.default.number().integer().min(0).optional(),
        maxStock: joi_1.default.number().integer().min(0).optional(),
        cost: joi_1.default.number().min(0).optional(),
        supplierId: common_1.id.optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    updateInventoryItem: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        category: joi_1.default.string().trim().optional(),
        quantity: joi_1.default.number().integer().min(0).optional(),
        unit: joi_1.default.string().trim().optional(),
        location: joi_1.default.string().trim().optional(),
        minStock: joi_1.default.number().integer().min(0).optional(),
        maxStock: joi_1.default.number().integer().min(0).optional(),
        cost: joi_1.default.number().min(0).optional(),
        supplierId: common_1.id.optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    inventoryQuery: joi_1.default.object({
        category: joi_1.default.string().trim().optional(),
        location: joi_1.default.string().trim().optional(),
        lowStock: joi_1.default.boolean().optional(),
        search: joi_1.default.string().trim().optional(),
        ...common_1.paginationKeys,
    }),
    adjustStock: joi_1.default.object({
        adjustment: joi_1.default.number().integer().required(),
        reason: joi_1.default.string().trim().required(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }),
    dashboardQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        organizationId: common_1.id.optional(),
        fleetId: common_1.id.optional(),
        timeRange: joi_1.default.string().valid('day', 'week', 'month', 'quarter', 'year').optional(),
    }),
    createAlert: joi_1.default.object({
        type: joi_1.default.string()
            .valid('low_stock', 'high_stock', 'maintenance_due', 'contract_expiring', 'custom')
            .required(),
        title: joi_1.default.string().trim().min(1).max(200).required(),
        description: joi_1.default.string().trim().max(1000).optional(),
        severity: joi_1.default.string().valid('info', 'warning', 'critical').required(),
        threshold: joi_1.default.number().optional(),
        conditions: joi_1.default.object().optional(),
        recipientIds: joi_1.default.array().items(common_1.id).optional(),
        channels: joi_1.default.array()
            .items(joi_1.default.string().valid('email', 'sms', 'push', 'webhook'))
            .optional(),
    }),
    updateAlert: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(200).optional(),
        description: joi_1.default.string().trim().max(1000).optional(),
        severity: joi_1.default.string().valid('info', 'warning', 'critical').optional(),
        isActive: joi_1.default.boolean().optional(),
        threshold: joi_1.default.number().optional(),
        conditions: joi_1.default.object().optional(),
        recipientIds: joi_1.default.array().items(common_1.id).optional(),
        channels: joi_1.default.array()
            .items(joi_1.default.string().valid('email', 'sms', 'push', 'webhook'))
            .optional(),
    }),
    alertQuery: joi_1.default.object({
        type: joi_1.default.string().optional(),
        severity: joi_1.default.string().valid('info', 'warning', 'critical').optional(),
        isActive: joi_1.default.boolean().optional(),
        isResolved: joi_1.default.boolean().optional(),
        ...common_1.paginationKeys,
    }),
    alertAction: joi_1.default.object({
        action: joi_1.default.string().valid('acknowledge', 'resolve', 'dismiss', 'snooze').required(),
        notes: joi_1.default.string().trim().max(500).optional(),
        snoozeUntil: joi_1.default.date().iso().when('action', {
            is: 'snooze',
            then: joi_1.default.required(),
            otherwise: joi_1.default.forbidden(),
        }),
    }),
    createIntegration: joi_1.default.object({
        type: joi_1.default.string().valid('api', 'webhook', 'sync', 'import', 'export').required(),
        name: joi_1.default.string().trim().min(1).max(200).required(),
        description: joi_1.default.string().trim().max(1000).optional(),
        config: joi_1.default.object({
            endpoint: joi_1.default.string().uri().optional(),
            apiKey: joi_1.default.string().optional(),
            headers: joi_1.default.object().optional(),
            method: joi_1.default.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').optional(),
            payload: joi_1.default.object().optional(),
        }).optional(),
        schedule: joi_1.default.string().optional(),
        isActive: joi_1.default.boolean().default(true),
    }),
    updateIntegration: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: joi_1.default.string().trim().max(1000).optional(),
        config: joi_1.default.object().optional(),
        schedule: joi_1.default.string().optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
    syncRequest: joi_1.default.object({
        direction: joi_1.default.string().valid('import', 'export', 'bidirectional').required(),
        entities: joi_1.default.array()
            .items(joi_1.default.string().valid('users', 'organizations', 'fleets', 'ships', 'inventory', 'cargo'))
            .min(1)
            .required(),
        fullSync: joi_1.default.boolean().default(false),
        dryRun: joi_1.default.boolean().default(false),
    }),
    webhookTest: joi_1.default.object({
        endpoint: joi_1.default.string().uri().required(),
        method: joi_1.default.string().valid('GET', 'POST').default('POST'),
        headers: joi_1.default.object().optional(),
        payload: joi_1.default.object().optional(),
    }),
};
//# sourceMappingURL=logisticsSchemas.js.map