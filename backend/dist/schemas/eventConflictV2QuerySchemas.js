"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventConflictV2QuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
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
exports.eventConflictV2QuerySchemas = {
    checkConflictsBody: joi_1.default.object({
        activityId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        startDate: joi_1.default.date().iso().required(),
        endDate: joi_1.default.date().iso().required(),
        excludeActivityId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional()
            .description('Exclude this activity from conflict detection'),
        userId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        organizationId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        includeShared: joi_1.default.boolean().optional(),
        options: joi_1.default.object({
            includeTypes: joi_1.default.array().items(joi_1.default.string()).optional(),
            excludeTypes: joi_1.default.array().items(joi_1.default.string()).optional(),
            bufferMinutes: joi_1.default.number().integer().min(0).max(1440).optional(),
        }).optional().description('Additional conflict detection options'),
    })
        .unknown(false)
        .external(async (value) => {
        if (value.startDate >= value.endDate) {
            throw new Error('startDate must be before endDate');
        }
    }),
    myConflictsQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        includeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to include'),
        excludeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to exclude'),
    }).unknown(false),
    activityIdParam: joi_1.default.object({
        activityId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    activityConflictsQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        includeResolved: joi_1.default.boolean().optional(),
        severity: joi_1.default.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
        includeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to include'),
        excludeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to exclude'),
        bufferMinutes: joi_1.default.number().integer().min(0).max(1440).optional(),
    }).unknown(false),
    userIdParam: joi_1.default.object({
        userId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    userConflictsQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        includeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to include'),
        excludeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to exclude'),
    }).unknown(false),
    rangeQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().required(),
        endDate: joi_1.default.date().iso().required(),
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        includeResolved: joi_1.default.boolean().optional(),
        bufferMinutes: joi_1.default.number().integer().min(0).max(1440).default(0),
        includeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to include'),
        excludeTypes: joi_1.default.string()
            .optional()
            .custom(_stringToArray)
            .description('Comma-separated activity types to exclude'),
    })
        .unknown(false)
        .external(async (value) => {
        if (value.startDate >= value.endDate) {
            throw new Error('startDate must be before endDate');
        }
    }),
};
//# sourceMappingURL=eventConflictV2QuerySchemas.js.map