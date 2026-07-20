"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string().valid('name', 'createdAt', 'updatedAt', 'memberCount').default('createdAt'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
const _stringToArray = (value) => {
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
exports.organizationQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION').optional(),
        type: joi_1.default.string().valid('MAIN', 'DIVISION', 'SQUAD', 'WINGS', 'OTHER').optional(),
        joinable: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
        'number.min': '{#label} must be at least {#limit}',
        'number.max': '{#label} must be at most {#limit}',
    }),
    searchQuery: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).required(),
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION').optional(),
        type: joi_1.default.string().valid('MAIN', 'DIVISION', 'SQUAD', 'WINGS', 'OTHER').optional(),
        joinable: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.required': 'Search query {#label} is required',
    }),
    getQuery: joi_1.default.object({
        includeHierarchy: joi_1.default.boolean().optional(),
    }).unknown(false),
    activityQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortOrder: pagination.sortOrder,
        action: joi_1.default.string()
            .valid('CREATED', 'UPDATED', 'DELETED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_PROMOTED', 'MEMBER_DEMOTED', 'PERMISSION_CHANGED', 'SETTINGS_CHANGED')
            .optional(),
        severity: joi_1.default.string().valid('INFO', 'WARNING', 'CRITICAL').optional(),
        userId: joi_1.default.string().trim().optional(),
    }).unknown(false),
    analyticsQuery: joi_1.default.object({
        period: joi_1.default.string()
            .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')
            .default('MONTHLY'),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }).unknown(false),
    membersQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: joi_1.default.string().valid('joinedAt', 'name', 'role').default('joinedAt'),
        sortOrder: pagination.sortOrder,
        role: joi_1.default.string().valid('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'GUEST').optional(),
        status: joi_1.default.string().valid('ACTIVE', 'INACTIVE', 'PENDING').optional(),
    }).unknown(false),
    permissionsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        resource: joi_1.default.string()
            .valid('ORGANIZATION', 'FLEET', 'INVENTORY', 'PERMISSIONS', 'SETTINGS')
            .optional(),
    }).unknown(false),
};
//# sourceMappingURL=organizationQuerySchemas.js.map