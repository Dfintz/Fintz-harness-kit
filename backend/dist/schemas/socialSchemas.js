"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.socialSchemas = {
    setPreferences: joi_1.default.object({
        activityPreferences: joi_1.default.object()
            .pattern(joi_1.default.string(), joi_1.default.number().min(0).max(100))
            .required(),
        experienceLevels: joi_1.default.object()
            .pattern(joi_1.default.string(), joi_1.default.string().valid('beginner', 'intermediate', 'advanced', 'expert'))
            .optional(),
        playstyles: joi_1.default.array()
            .items(joi_1.default.string().valid('casual', 'competitive', 'roleplay', 'exploration', 'social', 'hardcore'))
            .min(1)
            .required(),
        preferredGroupSizeMin: joi_1.default.number().integer().min(1).max(50).optional(),
        preferredGroupSizeMax: joi_1.default.number().integer().min(1).max(50).optional(),
        requiresVoiceChat: joi_1.default.boolean().optional(),
        prefersSilentPlay: joi_1.default.boolean().optional(),
        timezone: joi_1.default.string().trim().max(50).optional(),
        availability: joi_1.default.array()
            .items(joi_1.default.string().valid('weekday_morning', 'weekday_afternoon', 'weekday_evening', 'weekday_night', 'weekend_morning', 'weekend_afternoon', 'weekend_evening', 'weekend_night'))
            .optional(),
        preferredRoles: joi_1.default.array().items(joi_1.default.string().trim().max(50)).optional(),
        languages: joi_1.default.array().items(joi_1.default.string().trim().max(30)).min(1).optional(),
        combatSkill: joi_1.default.number().integer().min(0).max(100).optional(),
        pilotingSkill: joi_1.default.number().integer().min(0).max(100).optional(),
        tradingSkill: joi_1.default.number().integer().min(0).max(100).optional(),
        miningSkill: joi_1.default.number().integer().min(0).max(100).optional(),
        allowCrossOrgMatching: joi_1.default.boolean().optional(),
        onlyMatchWithVerified: joi_1.default.boolean().optional(),
        minReputationScore: joi_1.default.number().integer().min(0).max(100).optional(),
    }),
    findMatchesQuery: joi_1.default.object({
        activityType: joi_1.default.string().trim().max(50).optional(),
        limit: joi_1.default.number().integer().min(1).max(50).default(10),
    }),
    trackJoin: joi_1.default.object({
        sessionId: common_1.id,
        activityType: joi_1.default.string().trim().max(50).optional(),
    }),
    createLfgSession: joi_1.default.object({
        organizationId: joi_1.default.string().trim().optional(),
        activityType: joi_1.default.string().trim().min(1).max(100).required(),
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: common_1.description,
        maxPlayers: joi_1.default.number().integer().min(2).max(50).required(),
        minPlayers: joi_1.default.number().integer().min(1).max(50).optional(),
        scheduledTime: joi_1.default.date().iso().optional(),
        requirements: joi_1.default.object({
            minLevel: joi_1.default.number().integer().min(0).optional(),
            requiredRoles: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
            voiceRequired: joi_1.default.boolean().optional(),
        }).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(30)).optional(),
        metadata: joi_1.default.object().optional(),
        ttlSeconds: joi_1.default.number().integer().min(60).max(86400).optional(),
        notes: common_1.notes,
    }),
    updateLfgSession: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: common_1.description,
        maxPlayers: joi_1.default.number().integer().min(2).max(50).optional(),
        scheduledTime: joi_1.default.date().iso().optional(),
        status: joi_1.default.string().valid('open', 'in_progress', 'completed', 'cancelled').optional(),
        notes: common_1.notes,
    }),
    createGroup: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(100).required(),
        description: common_1.description,
        maxMembers: joi_1.default.number().integer().min(2).max(100).optional(),
        isPrivate: joi_1.default.boolean().default(false),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(30)).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        activityType: joi_1.default.string().trim().optional(),
        status: joi_1.default.string().trim().optional(),
        organizationId: joi_1.default.string().trim().optional(),
        minAvailableSlots: joi_1.default.number().integer().min(1).optional(),
        tags: joi_1.default.string().trim().optional(),
        hostUserId: joi_1.default.string().trim().optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
//# sourceMappingURL=socialSchemas.js.map