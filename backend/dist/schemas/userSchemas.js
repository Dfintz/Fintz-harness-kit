"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.userSchemas = {
    create: joi_1.default.object({
        id: common_1.id,
        username: joi_1.default.string().trim().min(3).max(50).required(),
        email: common_1.email,
        discordId: joi_1.default.string().trim().required(),
        role: joi_1.default.string().valid('user', 'admin', 'moderator').default('user'),
    }),
    update: joi_1.default.object({
        username: joi_1.default.string().trim().min(3).max(50).optional(),
        email: common_1.optionalEmail,
        role: joi_1.default.string().valid('user', 'admin', 'moderator').optional(),
        activeOrgId: joi_1.default.string().trim().optional(),
    }),
    updateCurrentUser: joi_1.default.object({
        displayName: joi_1.default.string().trim().min(1).max(100).allow('').optional(),
        bio: joi_1.default.string().trim().max(2000).allow('').optional(),
        avatar: joi_1.default.string().trim().max(500_000).allow('').optional(),
        activeOrgId: joi_1.default.forbidden().messages({
            'any.unknown': 'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead',
            'any.forbidden': 'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead',
        }),
    }),
    switchActiveOrganization: joi_1.default.object({
        organizationId: common_1.uuid,
    }),
    login: joi_1.default.object({
        email: common_1.email,
        password: joi_1.default.string().min(8).required(),
    }),
    register: joi_1.default.object({
        username: joi_1.default.string().trim().min(3).max(50).required(),
        email: common_1.email,
        password: joi_1.default.string().min(8).max(128).required(),
        discordId: joi_1.default.string().trim().optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        role: joi_1.default.string().valid('user', 'admin', 'moderator').optional(),
        search: joi_1.default.string().trim().max(100).optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    updatePreferences: joi_1.default.object({
        theme: joi_1.default.string().valid('light', 'dark', 'auto').optional(),
        language: joi_1.default.string().valid('en', 'es', 'fr', 'de').optional(),
        notifications: joi_1.default.boolean().optional(),
        timezone: joi_1.default.string().optional(),
    }),
    passwordReset: joi_1.default.object({
        email: common_1.email.optional(),
        token: joi_1.default.string().trim().optional(),
        password: joi_1.default.string().min(8).max(128).optional(),
    }),
    passwordChange: joi_1.default.object({
        currentPassword: joi_1.default.string().min(8).required(),
        newPassword: joi_1.default.string().min(8).max(128).required(),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('newPassword')).required(),
    }),
    searchQuery: joi_1.default.object({
        query: joi_1.default.string().trim().min(1).max(200).required(),
        limit: joi_1.default.number().integer().min(1).max(50).default(20),
    }),
    browseCommunityMembers: joi_1.default.object({
        search: joi_1.default.string().trim().max(100).allow(''),
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(50).default(20),
        sortBy: joi_1.default.string().valid('createdAt', 'username', 'displayName').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        rsiVerifiedOnly: joi_1.default.boolean().default(false),
        hasOrganization: joi_1.default.boolean().default(false),
    }),
};
//# sourceMappingURL=userSchemas.js.map