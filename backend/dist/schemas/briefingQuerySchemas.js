"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.briefingQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const pagination = {
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(10),
    sortBy: joi_1.default.string().valid('createdAt', 'updatedAt', 'priority', 'title').default('createdAt'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
exports.briefingQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
        type: joi_1.default.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
        priority: joi_1.default.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
        authorId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        isPublic: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
    }),
    searchQuery: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).optional(),
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
        type: joi_1.default.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
        priority: joi_1.default.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
        tags: joi_1.default.string()
            .custom((value, helpers) => {
            if (!value) {
                return undefined;
            }
            const tags = Array.isArray(value)
                ? value
                : value.split(',').map((t) => t.trim());
            if (!Array.isArray(tags) || tags.length === 0) {
                return helpers.error('any.invalid');
            }
            return tags;
        })
            .optional(),
    }).unknown(false),
    idParam: joi_1.default.object({
        id: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    orgIdParam: joi_1.default.object({
        orgId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    orgBriefingsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED').optional(),
        type: joi_1.default.string().valid('INTEL', 'TACTICAL', 'STRATEGIC', 'OPERATIONAL').optional(),
        priority: joi_1.default.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    }).unknown(false),
    readersQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
    }).unknown(false),
    attachmentsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
    }).unknown(false),
};
//# sourceMappingURL=briefingQuerySchemas.js.map