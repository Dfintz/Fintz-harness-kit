"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsSchema = exports.trackJoinSchema = exports.findMatchesSchema = exports.setPreferencesSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const UserGameplayPreferences_1 = require("../models/UserGameplayPreferences");
exports.setPreferencesSchema = joi_1.default.object({
    activityPreferences: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.number().min(0).max(100)).required(),
    experienceLevels: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string().valid(...Object.values(UserGameplayPreferences_1.ExperienceLevel))).optional(),
    playstyles: joi_1.default.array()
        .items(joi_1.default.string().valid(...Object.values(UserGameplayPreferences_1.Playstyle)))
        .min(1)
        .required(),
    preferredGroupSizeMin: joi_1.default.number().min(1).max(50).optional(),
    preferredGroupSizeMax: joi_1.default.number().min(1).max(50).optional(),
    requiresVoiceChat: joi_1.default.boolean().optional(),
    prefersSilentPlay: joi_1.default.boolean().optional(),
    timezone: joi_1.default.string().optional(),
    availability: joi_1.default.array()
        .items(joi_1.default.string().valid(...Object.values(UserGameplayPreferences_1.Availability)))
        .optional(),
    preferredRoles: joi_1.default.array().items(joi_1.default.string()).optional(),
    languages: joi_1.default.array().items(joi_1.default.string()).min(1).optional(),
    combatSkill: joi_1.default.number().min(0).max(100).optional(),
    pilotingSkill: joi_1.default.number().min(0).max(100).optional(),
    tradingSkill: joi_1.default.number().min(0).max(100).optional(),
    miningSkill: joi_1.default.number().min(0).max(100).optional(),
    allowCrossOrgMatching: joi_1.default.boolean().optional(),
    onlyMatchWithVerified: joi_1.default.boolean().optional(),
    minReputationScore: joi_1.default.number().min(0).max(100).optional()
}).custom((value, helpers) => {
    if (value.preferredGroupSizeMin && value.preferredGroupSizeMax) {
        if (value.preferredGroupSizeMin > value.preferredGroupSizeMax) {
            return helpers.error('custom.groupSize', {
                message: 'preferredGroupSizeMin must be less than or equal to preferredGroupSizeMax'
            });
        }
    }
    return value;
});
exports.findMatchesSchema = joi_1.default.object({
    activityType: joi_1.default.string().optional(),
    limit: joi_1.default.number().min(1).max(50).optional()
});
exports.trackJoinSchema = joi_1.default.object({
    sessionId: joi_1.default.string().required(),
    matchScore: joi_1.default.number().min(0).max(100).optional()
});
exports.getAnalyticsSchema = joi_1.default.object({
    days: joi_1.default.number().min(1).max(90).optional()
});
//# sourceMappingURL=matchmaking.schema.js.map