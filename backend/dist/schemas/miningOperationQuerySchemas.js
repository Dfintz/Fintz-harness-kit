"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.miningOperationQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string()
        .valid('name', 'status', 'startDate', 'createdAt', 'efficiency')
        .default('startDate'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
exports.miningOperationQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string().valid('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED').optional(),
        zone: joi_1.default.string().trim().optional(),
        miningType: joi_1.default.string().valid('ASTEROID', 'GROUND', 'SUBSURFACE', 'ORBITAL').optional(),
        minCrew: joi_1.default.number().integer().min(0).optional(),
        maxCrew: joi_1.default.number().integer().min(0).optional(),
        myOperationsOnly: joi_1.default.boolean().optional(),
        hasOpenPositions: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
    }),
    idParam: joi_1.default.object({
        id: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    addCrewBody: joi_1.default.object({
        userId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        role: joi_1.default.string().valid('LEAD', 'PILOT', 'ENGINEER', 'SURVEYOR', 'OPERATOR').required(),
        shipId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
    }).unknown(false),
    crewQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        role: joi_1.default.string().valid('LEAD', 'PILOT', 'ENGINEER', 'SURVEYOR', 'OPERATOR').optional(),
    }).unknown(false),
    updateResourcesBody: joi_1.default.object({
        resourceType: joi_1.default.string()
            .valid('QUANTANIUM', 'LABADITE', 'LARANITE', 'BORASE', 'TACONITE', 'AGRICIUM')
            .required(),
        amount: joi_1.default.number().min(0).precision(2).required(),
        purity: joi_1.default.number().min(0).max(100).precision(2).required(),
        timestamp: joi_1.default.date().iso().optional(),
    }).unknown(false),
    resourcesQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        resourceType: joi_1.default.string()
            .valid('QUANTANIUM', 'LABADITE', 'LARANITE', 'BORASE', 'TACONITE', 'AGRICIUM')
            .optional(),
    }).unknown(false),
    updateStatusBody: joi_1.default.object({
        status: joi_1.default.string().valid('planned', 'in_progress', 'completed', 'cancelled').required(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }).unknown(false),
    statisticsQuery: joi_1.default.object({
        includeResourceBreakdown: joi_1.default.boolean().optional(),
        includeCrewStats: joi_1.default.boolean().optional(),
    }).unknown(false),
};
//# sourceMappingURL=miningOperationQuerySchemas.js.map