"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.communicationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.communicationSchemas = {
    createNotification: joi_1.default.object({
        type: joi_1.default.string().valid('info', 'warning', 'error', 'success', 'announcement').required(),
        title: joi_1.default.string().trim().min(1).max(200).required(),
        message: joi_1.default.string().trim().min(1).max(5000).required(),
        recipientIds: joi_1.default.array().items(joi_1.default.string().uuid().trim()).max(50).optional(),
        recipientEmails: joi_1.default.array().items(joi_1.default.string().email()).max(50).optional(),
        channel: joi_1.default.string().valid('discord', 'email', 'in-app', 'all').default('in-app'),
        priority: joi_1.default.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
        data: joi_1.default.object().optional(),
    }).or('recipientIds', 'recipientEmails'),
    markAsRead: joi_1.default.object({
        notificationIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(100).required(),
    }),
    notificationParam: joi_1.default.object({
        notificationId: joi_1.default.string().uuid().required(),
    }),
    sendBulk: joi_1.default.object({
        type: joi_1.default.string().valid('info', 'warning', 'error', 'success', 'announcement').required(),
        title: joi_1.default.string().trim().min(1).max(200).required(),
        message: joi_1.default.string().trim().min(1).max(5000).required(),
        channel: joi_1.default.string().valid('discord', 'email', 'in-app', 'all').default('in-app'),
        filters: joi_1.default.object({
            roles: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
            organizationId: joi_1.default.string().trim().optional(),
        }).optional(),
    }),
    createTemplate: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        subject: joi_1.default.string().trim().min(1).max(200).required(),
        body: joi_1.default.string().trim().min(1).max(10000).required(),
        type: joi_1.default.string().valid('email', 'discord', 'in-app').required(),
        variables: joi_1.default.array()
            .items(joi_1.default.object({
            name: joi_1.default.string().trim().required(),
            description: joi_1.default.string().trim().optional(),
            defaultValue: joi_1.default.string().trim().optional(),
            required: joi_1.default.boolean().default(false),
        }))
            .optional(),
        description: common_1.description,
        isActive: joi_1.default.boolean().default(true),
    }),
    updateTemplate: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        subject: joi_1.default.string().trim().min(1).max(200).optional(),
        body: joi_1.default.string().trim().min(1).max(10000).optional(),
        type: joi_1.default.string().valid('email', 'discord', 'in-app').optional(),
        variables: joi_1.default.array()
            .items(joi_1.default.object({
            name: joi_1.default.string().trim().required(),
            description: joi_1.default.string().trim().optional(),
            defaultValue: joi_1.default.string().trim().optional(),
            required: joi_1.default.boolean().optional(),
        }))
            .optional(),
        description: common_1.description,
        isActive: joi_1.default.boolean().optional(),
    }),
    renderTemplate: joi_1.default.object({
        templateId: common_1.id,
        variables: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string().valid('info', 'warning', 'error', 'success', 'announcement').optional(),
        channel: joi_1.default.string().valid('discord', 'email', 'in-app').optional(),
        read: joi_1.default.boolean().optional(),
    }),
    digestQuery: joi_1.default.object({
        period: joi_1.default.string().valid('daily', 'weekly', 'monthly').default('daily'),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
//# sourceMappingURL=communicationSchemas.js.map