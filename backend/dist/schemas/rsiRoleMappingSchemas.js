"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiRoleMappingSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const rbacPermissionsSchema = joi_1.default.object({
    fleetView: joi_1.default.boolean().optional(),
    fleetEdit: joi_1.default.boolean().optional(),
    fleetManage: joi_1.default.boolean().optional(),
    orgView: joi_1.default.boolean().optional(),
    orgEdit: joi_1.default.boolean().optional(),
    orgManage: joi_1.default.boolean().optional(),
    eventView: joi_1.default.boolean().optional(),
    eventManage: joi_1.default.boolean().optional(),
    intelView: joi_1.default.boolean().optional(),
    intelManage: joi_1.default.boolean().optional(),
    admin: joi_1.default.boolean().optional(),
    custom: joi_1.default.object().pattern(joi_1.default.string().max(50), joi_1.default.boolean()).optional(),
}).optional();
exports.rsiRoleMappingSchemas = {
    createMapping: joi_1.default.object({
        rsiRank: joi_1.default.string().trim().min(1).max(50).required().messages({
            'string.empty': 'RSI rank is required',
            'string.min': 'RSI rank must be at least 1 character',
            'string.max': 'RSI rank cannot exceed 50 characters',
            'any.required': 'RSI rank is required',
        }),
        discordRoleId: joi_1.default.string()
            .trim()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null, '')
            .messages({
            'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
        }),
        rbacPermissions: rbacPermissionsSchema,
        isActive: joi_1.default.boolean().optional().default(true),
        priority: joi_1.default.number().integer().min(0).max(1000).optional().default(0).messages({
            'number.min': 'Priority must be at least 0',
            'number.max': 'Priority cannot exceed 1000',
        }),
        description: joi_1.default.string().trim().max(255).optional().allow(null, '').messages({
            'string.max': 'Description cannot exceed 255 characters',
        }),
        internalRoleId: joi_1.default.string().uuid().optional().allow(null, '').messages({
            'string.guid': 'Internal role ID must be a valid UUID',
        }),
    }),
    updateMapping: joi_1.default.object({
        discordRoleId: joi_1.default.string()
            .trim()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null, '')
            .messages({
            'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
        }),
        rbacPermissions: rbacPermissionsSchema,
        isActive: joi_1.default.boolean().optional(),
        priority: joi_1.default.number().integer().min(0).max(1000).optional().messages({
            'number.min': 'Priority must be at least 0',
            'number.max': 'Priority cannot exceed 1000',
        }),
        description: joi_1.default.string().trim().max(255).optional().allow(null, '').messages({
            'string.max': 'Description cannot exceed 255 characters',
        }),
        internalRoleId: joi_1.default.string().uuid().optional().allow(null, '').messages({
            'string.guid': 'Internal role ID must be a valid UUID',
        }),
    }),
    applyTemplate: joi_1.default.object({
        templateName: joi_1.default.string()
            .trim()
            .valid('standard', 'military', 'corporate')
            .required()
            .messages({
            'string.empty': 'Template name is required',
            'any.only': 'Template name must be one of: standard, military, corporate',
            'any.required': 'Template name is required',
        }),
        discordRoleMappings: joi_1.default.object()
            .pattern(joi_1.default.string().max(50), joi_1.default.string().pattern(/^\d{17,20}$/))
            .optional()
            .messages({
            'object.pattern.match': 'Discord role mappings must use valid RSI rank names as keys and Discord role IDs as values',
        }),
    }),
    bulkUpsert: joi_1.default.object({
        mappings: joi_1.default.array()
            .items(joi_1.default.object({
            rsiRank: joi_1.default.string().trim().min(1).max(50).required().messages({
                'string.empty': 'RSI rank is required',
                'string.min': 'RSI rank must be at least 1 character',
                'string.max': 'RSI rank cannot exceed 50 characters',
                'any.required': 'RSI rank is required',
            }),
            discordRoleId: joi_1.default.string()
                .trim()
                .pattern(/^\d{17,20}$/)
                .optional()
                .allow(null, '')
                .messages({
                'string.pattern.base': 'Discord role ID must be a valid snowflake (17-20 digits)',
            }),
            rbacPermissions: rbacPermissionsSchema,
            priority: joi_1.default.number().integer().min(0).max(1000).optional().messages({
                'number.min': 'Priority must be at least 0',
                'number.max': 'Priority cannot exceed 1000',
            }),
            description: joi_1.default.string().trim().max(255).optional().allow(null, ''),
            internalRoleId: joi_1.default.string().uuid().optional().allow(null, '').messages({
                'string.guid': 'Internal role ID must be a valid UUID',
            }),
        }))
            .min(1)
            .max(50)
            .required()
            .messages({
            'array.min': 'At least one mapping is required',
            'array.max': 'Cannot process more than 50 mappings at once',
            'any.required': 'Mappings array is required',
        }),
    }),
    cloneMappings: joi_1.default.object({
        sourceOrgId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'Source organization ID must be a valid UUID',
            'any.required': 'Source organization ID is required',
        }),
        includeDiscordRoles: joi_1.default.boolean().optional().default(false),
    }),
    listMappingsQuery: joi_1.default.object({
        includeInactive: joi_1.default.boolean().optional().default(false),
    }),
    mappingIdParam: joi_1.default.object({
        id: joi_1.default.string().uuid().required().messages({
            'string.guid': 'Mapping ID must be a valid UUID',
            'any.required': 'Mapping ID is required',
        }),
    }),
    organizationIdParam: joi_1.default.object({
        organizationId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'Organization ID must be a valid UUID',
            'any.required': 'Organization ID is required',
        }),
    }),
};
//# sourceMappingURL=rsiRoleMappingSchemas.js.map