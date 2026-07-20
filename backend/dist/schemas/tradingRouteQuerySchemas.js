"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingRouteQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string().valid('createdAt', 'profit', 'distance', 'popularity').default('createdAt'),
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
exports.tradingRouteQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
        minProfit: joi_1.default.number().min(0).optional(),
        maxDistance: joi_1.default.number().min(0).optional(),
        includeExpired: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
        'number.min': '{#label} must be at least {#limit}',
    }),
    searchQuery: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).optional(),
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
        startLocation: joi_1.default.string().trim().optional(),
        endLocation: joi_1.default.string().trim().optional(),
        minProfit: joi_1.default.number().min(0).optional(),
        maxDistance: joi_1.default.number().min(0).optional(),
        commodity: joi_1.default.string().trim().optional(),
        tags: joi_1.default.custom((value, helpers) => {
            const tags = stringToArray(value);
            if (tags.length === 0 && value !== undefined) {
                return helpers.error('any.invalid');
            }
            return tags;
        }).optional(),
    }).unknown(false),
    idParam: joi_1.default.object({
        id: joi_1.default.string()
            .trim()
            .pattern(/^route_\d+_[a-f0-9-]+$/)
            .required()
            .messages({ 'string.pattern.base': 'Invalid trading route ID format' }),
    }).unknown(false),
    bulkQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        creatorId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
        favorited: joi_1.default.boolean().optional(),
    }).unknown(false),
    profitabilityQuery: joi_1.default.object({
        period: joi_1.default.string().valid('DAILY', 'WEEKLY', 'MONTHLY').default('WEEKLY'),
        includeMetrics: joi_1.default.boolean().optional(),
    }).unknown(false),
};
//# sourceMappingURL=tradingRouteQuerySchemas.js.map