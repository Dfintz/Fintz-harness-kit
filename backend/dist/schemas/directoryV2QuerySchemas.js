"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.directoryV2QuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...common_1.paginationKeys,
    sortBy: joi_1.default.string()
        .valid('name', 'memberCount', 'createdAt', 'updatedAt', 'activityLevel')
        .default('memberCount'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
const stringToArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }
    return [];
};
exports.directoryV2QuerySchemas = {
    listOrganizationsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        search: joi_1.default.string().trim().max(200).optional(),
        primaryFocus: joi_1.default.string()
            .valid('PVP', 'PVE', 'EXPLORATION', 'MINING', 'TRADING', 'INDUSTRIAL', 'ROLEPLAY', 'RACING', 'OTHER')
            .optional(),
        primaryFocuses: joi_1.default.string()
            .custom((value, helpers) => {
            const focuses = stringToArray(value);
            const validFocuses = [
                'PVP',
                'PVE',
                'EXPLORATION',
                'MINING',
                'TRADING',
                'INDUSTRIAL',
                'ROLEPLAY',
                'RACING',
                'OTHER',
            ];
            if (focuses.length > 0 && !focuses.every(f => validFocuses.includes(f))) {
                return helpers.error('any.invalid');
            }
            return focuses;
        })
            .optional(),
        activityLevel: joi_1.default.string().valid('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH').optional(),
        activityLevels: joi_1.default.string()
            .custom((value, helpers) => {
            const levels = stringToArray(value);
            const validLevels = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
            if (levels.length > 0 && !levels.every(l => validLevels.includes(l))) {
                return helpers.error('any.invalid');
            }
            return levels;
        })
            .optional(),
        isRecruiting: joi_1.default.boolean().optional(),
        isVerified: joi_1.default.boolean().optional(),
        minMemberCount: joi_1.default.number().integer().min(0).optional(),
        maxMemberCount: joi_1.default.number().integer().min(0).optional(),
        languages: joi_1.default.string()
            .custom((value, helpers) => {
            const langs = stringToArray(value);
            if (langs.length > 0) {
                const iso639 = ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'ru', 'pt', 'pl'];
                if (!langs.every(l => iso639.includes(l.toLowerCase()))) {
                    return helpers.error('any.invalid');
                }
            }
            return langs;
        })
            .optional(),
        timezone: joi_1.default.string().trim().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
    }),
    statsQuery: joi_1.default.object({}).unknown(false),
    organizationIdParam: joi_1.default.object({
        organizationId: joi_1.default.string().trim().min(1).max(255).required(),
    }).unknown(false),
    seoMetaQuery: joi_1.default.object({}).unknown(false),
    seoHtmlQuery: joi_1.default.object({
        path: joi_1.default.string().trim().min(1).max(2048).required(),
    }).unknown(false),
    listFederationsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: joi_1.default.string()
            .valid('name', 'memberCount', 'createdAt', 'updatedAt')
            .default('memberCount'),
        sortOrder: pagination.sortOrder,
        search: joi_1.default.string().trim().max(200).optional(),
        name: joi_1.default.string().trim().max(200).optional(),
        tags: joi_1.default.string()
            .custom((value, helpers) => {
            const tags = stringToArray(value);
            if (tags.length === 0 && value !== undefined) {
                return helpers.error('any.invalid');
            }
            return tags;
        })
            .optional(),
        minMembers: joi_1.default.number().integer().min(0).optional(),
        maxMembers: joi_1.default.number().integer().min(0).optional(),
    }).unknown(false),
    federationStatsQuery: joi_1.default.object({}).unknown(false),
    globalSearchQuery: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).required(),
        page: pagination.page,
        limit: pagination.limit,
        type: joi_1.default.string().valid('organization', 'federation', 'user').optional(),
    }).unknown(false),
};
//# sourceMappingURL=directoryV2QuerySchemas.js.map