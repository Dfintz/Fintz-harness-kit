"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedAccountSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.sharedAccountSchemas = {
    create: joi_1.default.object({
        accountName: joi_1.default.string().trim().min(1).max(200).required().messages({
            'string.empty': 'Account name is required',
            'any.required': 'Account name is required',
        }),
        accountUsername: joi_1.default.string().trim().min(1).max(200).required().messages({
            'string.empty': 'Username is required',
            'any.required': 'Username is required',
        }),
        password: joi_1.default.string().min(1).max(500).required().messages({
            'any.required': 'Password is required',
        }),
        organizationId: common_1.id,
        category: joi_1.default.string().trim().max(100).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(''),
        url: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        expiresAt: joi_1.default.date().iso().optional().allow(null),
        twoFactorSecret: joi_1.default.string().trim().max(200).optional().allow('', null),
        notes: common_1.notes,
    }),
    update: joi_1.default.object({
        accountName: joi_1.default.string().trim().min(1).max(200).optional(),
        accountUsername: joi_1.default.string().trim().min(1).max(200).optional(),
        category: joi_1.default.string().trim().max(100).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(''),
        url: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        expiresAt: joi_1.default.date().iso().optional().allow(null),
        notes: common_1.notes,
    }),
    updatePassword: joi_1.default.object({
        password: joi_1.default.string().min(1).max(500).required().messages({
            'any.required': 'Password is required',
        }),
    }),
    update2FA: joi_1.default.object({
        twoFactorSecret: joi_1.default.string().trim().max(200).optional().allow('', null),
    }),
    grantPermission: joi_1.default.object({
        accountId: common_1.id,
        userId: common_1.id,
        canView: joi_1.default.boolean().default(true),
        canEdit: joi_1.default.boolean().default(false),
        canViewPassword: joi_1.default.boolean().default(false),
        canView2FA: joi_1.default.boolean().default(false),
        expiresAt: joi_1.default.date().iso().optional().allow(null),
        notes: common_1.notes,
    }),
    bulkImport: joi_1.default.object({
        organizationId: common_1.id,
        accounts: joi_1.default.array()
            .items(joi_1.default.object({
            accountName: joi_1.default.string().trim().min(1).max(200).required(),
            accountUsername: joi_1.default.string().trim().min(1).max(200).required(),
            password: joi_1.default.string().min(1).max(500).required(),
            category: joi_1.default.string().trim().max(100).optional(),
            description: joi_1.default.string().trim().max(1000).optional().allow(''),
            url: joi_1.default.string().uri().trim().max(500).optional().allow('', null),
            tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
            expiresAt: joi_1.default.date().iso().optional().allow(null),
            twoFactorSecret: joi_1.default.string().trim().max(200).optional().allow('', null),
        }))
            .min(1)
            .max(100)
            .required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        category: joi_1.default.string().trim().max(100).optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        tag: joi_1.default.string().trim().max(50).optional(),
        includeExpired: joi_1.default.boolean().optional(),
    }),
    params: {
        organizationId: joi_1.default.object({
            organizationId: common_1.id,
        }),
        accountId: joi_1.default.object({
            accountId: common_1.id,
        }),
    },
};
//# sourceMappingURL=sharedAccountSchemas.js.map