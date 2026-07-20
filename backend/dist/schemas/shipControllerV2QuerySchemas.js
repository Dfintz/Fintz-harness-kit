"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipControllerV2QuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string()
        .valid('name', 'type', 'role', 'status', 'createdAt', 'updatedAt')
        .default('name'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('ASC'),
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
exports.shipControllerV2QuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string()
            .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
            .optional(),
        role: joi_1.default.string()
            .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
            .optional(),
        manufacturer: joi_1.default.string().trim().optional(),
        type: joi_1.default.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND', 'SHIP').optional(),
        minCrew: joi_1.default.number().integer().min(0).optional(),
        maxCrew: joi_1.default.number().integer().min(0).optional(),
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
        status: joi_1.default.string()
            .valid('ACTIVE', 'MAINTENANCE', 'DEPLOYED', 'DAMAGED', 'RETIRED')
            .optional(),
        role: joi_1.default.string()
            .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
            .optional(),
        manufacturer: joi_1.default.string().trim().optional(),
        type: joi_1.default.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND', 'SHIP').optional(),
        tags: joi_1.default.custom((value, helpers) => {
            const tags = stringToArray(value);
            if (tags.length === 0 && value !== undefined) {
                return helpers.error('any.invalid');
            }
            return tags;
        }).optional(),
    }).unknown(false),
    statisticsQuery: joi_1.default.object({
        groupBy: joi_1.default.string().valid('status', 'role', 'type', 'manufacturer').optional(),
        includeMetrics: joi_1.default.boolean().optional(),
    }).unknown(false),
    idParam: joi_1.default.object({
        id: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    catalogueQuery: joi_1.default.object({
        type: joi_1.default.string().valid('SPACECRAFT', 'VEHICLE', 'GROUND').optional(),
        manufacturer: joi_1.default.string().trim().optional(),
        role: joi_1.default.string()
            .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
            .optional(),
        size: joi_1.default.string().trim().optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        isVehicle: joi_1.default.string().valid('true', 'false').optional(),
        status: joi_1.default.string().trim().optional(),
        page: pagination.page,
        limit: joi_1.default.number().integer().min(1).max(500).default(100),
    }).unknown(false),
    vehiclesCatalogueQuery: joi_1.default.object({
        page: pagination.page,
        limit: joi_1.default.number().integer().min(1).max(500).default(100),
        manufacturer: joi_1.default.string().trim().optional(),
    }).unknown(false),
    spacecraftCatalogueQuery: joi_1.default.object({
        page: pagination.page,
        limit: joi_1.default.number().integer().min(1).max(500).default(100),
        manufacturer: joi_1.default.string().trim().optional(),
        role: joi_1.default.string()
            .valid('COMBAT', 'EXPLORATION', 'MINING', 'TRANSPORT', 'SALVAGE', 'SUPPORT')
            .optional(),
    }).unknown(false),
};
//# sourceMappingURL=shipControllerV2QuerySchemas.js.map