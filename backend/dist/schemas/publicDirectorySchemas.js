"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicDirectorySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const primaryFocusValues = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'bounty_hunting',
    'medical',
    'transport',
    'salvage',
    'security',
    'social',
    'piracy',
    'racing',
    'mixed',
];
const activityLevelValues = ['inactive', 'low', 'moderate', 'high', 'very_high'];
const sortByValues = ['memberCount', 'createdAt', 'updatedAt', 'activityLevel'];
exports.publicDirectorySchemas = {
    directoryQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).default(20).optional(),
        primaryFocus: joi_1.default.string()
            .valid(...primaryFocusValues)
            .optional(),
        primaryFocuses: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...primaryFocusValues)), joi_1.default.string().valid(...primaryFocusValues))
            .optional(),
        activityLevel: joi_1.default.string()
            .valid(...activityLevelValues)
            .optional(),
        activityLevels: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...activityLevelValues)), joi_1.default.string().valid(...activityLevelValues))
            .optional(),
        isRecruiting: joi_1.default.boolean().optional(),
        isVerified: joi_1.default.boolean().optional(),
        minMemberCount: joi_1.default.number().integer().min(0).optional(),
        maxMemberCount: joi_1.default.number().integer().min(0).optional(),
        languages: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().max(20)), joi_1.default.string().max(100))
            .optional(),
        timezone: joi_1.default.string().max(50).optional(),
        search: joi_1.default.string().trim().max(100).optional(),
        sortBy: joi_1.default.string()
            .valid(...sortByValues)
            .optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
    federationQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).default(20).optional(),
        name: joi_1.default.string().trim().max(100).optional(),
        tags: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().max(50)), joi_1.default.string().max(200))
            .optional(),
        minMembers: joi_1.default.number().integer().min(0).optional(),
        maxMembers: joi_1.default.number().integer().min(0).optional(),
        sortBy: joi_1.default.string().valid('memberCount', 'createdAt', 'name').optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
    updateProfile: joi_1.default.object({
        isPublic: joi_1.default.boolean().optional(),
        tagline: joi_1.default.string().trim().max(200).allow('', null).optional(),
        primaryFocus: joi_1.default.string()
            .valid(...primaryFocusValues)
            .optional(),
        secondaryFocus: joi_1.default.array()
            .items(joi_1.default.string().valid(...primaryFocusValues))
            .max(5)
            .optional(),
        rsiUrl: joi_1.default.string().uri().max(255).allow('', null).optional(),
        discordInvite: joi_1.default.string().max(100).allow('', null).optional(),
        twitterUrl: joi_1.default.string().uri().max(255).allow('', null).optional(),
        youtubeUrl: joi_1.default.string().uri().max(255).allow('', null).optional(),
        twitchUrl: joi_1.default.string().uri().max(255).allow('', null).optional(),
        websiteUrl: joi_1.default.string().uri().max(255).allow('', null).optional(),
        languages: joi_1.default.array().items(joi_1.default.string().max(20)).max(10).optional(),
        timezone: joi_1.default.string().max(50).allow('', null).optional(),
        isRecruiting: joi_1.default.boolean().optional(),
        bannerUrl: joi_1.default.string().uri().max(500).allow('', null).optional(),
        logoUrl: joi_1.default.string().uri().max(500).allow('', null).optional(),
        scstatsVisibility: joi_1.default.object({
            showVerification: joi_1.default.boolean().optional(),
            showSkills: joi_1.default.boolean().optional(),
            showTimezone: joi_1.default.boolean().optional(),
            showAnalytics: joi_1.default.boolean().optional(),
        }).optional(),
    }),
    setVerification: joi_1.default.object({
        isVerified: joi_1.default.boolean().required(),
    }),
};
//# sourceMappingURL=publicDirectorySchemas.js.map