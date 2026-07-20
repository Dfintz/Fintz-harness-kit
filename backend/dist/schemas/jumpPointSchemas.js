"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jumpPointSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.jumpPointSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        channelId: joi_1.default.string().trim().min(1).max(100).required(),
        guildId: joi_1.default.string().trim().min(1).max(100).required(),
        isPublic: joi_1.default.boolean().default(true),
        password: joi_1.default.string().trim().min(4).max(128).optional(),
        contentFilterEnabled: joi_1.default.boolean().default(true),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        rateLimitConfig: joi_1.default.object({
            maxMessagesPerMinute: joi_1.default.number().integer().min(1).max(1000).optional(),
            maxMessagesPerHour: joi_1.default.number().integer().min(1).max(10000).optional(),
        }).optional(),
        contentFilterEnabled: joi_1.default.boolean().optional(),
        allowBotMessages: joi_1.default.boolean().optional(),
        maxConnectedServers: joi_1.default.number().integer().min(0).max(1000).optional(),
    }).min(1),
    activate: joi_1.default.object({
        guildId: joi_1.default.string().trim().min(1).max(100).required(),
        channelId: joi_1.default.string().trim().min(1).max(100).required(),
        password: joi_1.default.string().trim().min(4).max(128).optional(),
    }),
    deactivate: joi_1.default.object({
        guildId: joi_1.default.string().trim().min(1).max(100).required(),
        channelId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    delete: joi_1.default.object({
        guildId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    linkByCode: joi_1.default.object({
        code: joi_1.default.string().trim().alphanum().min(6).max(8).required(),
        guildId: joi_1.default.string().trim().min(1).max(100).required(),
        channelId: joi_1.default.string().trim().min(1).max(100).required(),
        password: joi_1.default.string().trim().min(4).max(128).optional(),
    }),
    ban: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
        username: joi_1.default.string().trim().min(1).max(200).optional(),
        reason: joi_1.default.string().trim().min(1).max(500).required(),
        expiresAt: joi_1.default.date().iso().greater('now').optional(),
    }),
    unban: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    analyticsQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
    query: common_1.pagination.append({
        guildId: joi_1.default.string().trim().min(1).max(100).optional(),
    }),
};
//# sourceMappingURL=jumpPointSchemas.js.map