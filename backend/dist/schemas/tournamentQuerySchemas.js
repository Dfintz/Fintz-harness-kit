"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string()
        .valid('name', 'startDate', 'createdAt', 'status', 'participantCount')
        .default('startDate'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
exports.tournamentQuerySchemas = {
    listQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string()
            .valid('PLANNING', 'REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
            .optional(),
        type: joi_1.default.string()
            .valid('DEATHMATCH', 'RACING', 'DOGFIGHTING', 'TEAM_COMBAT', 'OTHER')
            .optional(),
        difficulty: joi_1.default.string()
            .valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'HARDCORE')
            .optional(),
        minParticipants: joi_1.default.number().integer().min(0).optional(),
        maxParticipants: joi_1.default.number().integer().min(0).optional(),
        myTournamentsOnly: joi_1.default.boolean().optional(),
        isRegistered: joi_1.default.boolean().optional(),
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
    matchesQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        status: joi_1.default.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
        round: joi_1.default.number().integer().min(1).optional(),
    }).unknown(false),
    registerBody: joi_1.default.object({
        teamId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .optional(),
        shipIds: joi_1.default.array()
            .items(joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] }))
            .optional(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }).unknown(false),
    standingsQuery: joi_1.default.object({
        sortBy: joi_1.default.string().valid('wins', 'points', 'killDeathRatio', 'lastUpdated').default('points'),
        sortOrder: pagination.sortOrder,
    }).unknown(false),
    participantsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        status: joi_1.default.string().valid('REGISTERED', 'ACTIVE', 'ELIMINATED', 'WITHDRAWN').optional(),
    }).unknown(false),
};
//# sourceMappingURL=tournamentQuerySchemas.js.map