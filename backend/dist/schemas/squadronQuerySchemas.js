"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.squadronQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string().valid('joinDate', 'rank', 'name', 'status', 'activity').default('joinDate'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
exports.squadronQuerySchemas = {
    membersQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        role: joi_1.default.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').optional(),
        status: joi_1.default.string().valid('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED').optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
    }),
    rosterQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        includeShips: joi_1.default.boolean().optional(),
        includeRanks: joi_1.default.boolean().optional(),
        filterByShipType: joi_1.default.string()
            .valid('FIGHTER', 'BOMBER', 'EXPLORER', 'TRANSPORT', 'SUPPORT')
            .optional(),
    }).unknown(false),
    squadronIdParam: joi_1.default.object({
        squadronId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    memberIdParam: joi_1.default.object({
        memberId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    userIdParam: joi_1.default.object({
        userId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    addMemberBody: joi_1.default.object({
        userId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        role: joi_1.default.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').optional(),
        joinDate: joi_1.default.date().iso().optional(),
    }).unknown(false),
    updateRoleBody: joi_1.default.object({
        role: joi_1.default.string().valid('COMMANDER', 'LEAD', 'MEMBER', 'RECRUIT').required(),
    }).unknown(false),
    statsQuery: joi_1.default.object({
        includeHistorical: joi_1.default.boolean().optional(),
        period: joi_1.default.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR').default('MONTH'),
    }).unknown(false),
    roleStatsQuery: joi_1.default.object({}).unknown(false),
    shipStatsQuery: joi_1.default.object({
        groupBy: joi_1.default.string().valid('type', 'manufacturer', 'role').optional(),
    }).unknown(false),
    countQuery: joi_1.default.object({
        activeOnly: joi_1.default.boolean().optional(),
    }).unknown(false),
    activeCountQuery: joi_1.default.object({}).unknown(false),
    userSquadronCountQuery: joi_1.default.object({}).unknown(false),
};
//# sourceMappingURL=squadronQuerySchemas.js.map