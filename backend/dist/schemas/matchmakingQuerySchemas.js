"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pagination = {
    ...(0, common_1.paginationKeysWith)(10),
    sortBy: joi_1.default.string().valid('createdAt', 'rating', 'playerCount', 'waitTime').default('createdAt'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
};
const _stringToArray = (value) => {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return value.split(',').map(s => s.trim());
};
exports.matchmakingQuerySchemas = {
    findMatchesQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .optional(),
        minRating: joi_1.default.number().integer().min(0).optional(),
        maxRating: joi_1.default.number().integer().max(10000).optional(),
        minPlayers: joi_1.default.number().integer().min(1).optional(),
        maxPlayers: joi_1.default.number().integer().min(1).optional(),
        region: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
        minWaitTime: joi_1.default.number().integer().min(0).optional(),
        maxWaitTime: joi_1.default.number().integer().optional(),
        includePartyMatches: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'number.base': '{#label} must be a number',
    }),
    joinSoloQueueBody: joi_1.default.object({
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .required(),
        preferredRegion: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
        maxWaitTime: joi_1.default.number().integer().min(30).max(600).optional(),
    }).unknown(false),
    joinGroupQueueBody: joi_1.default.object({
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .required(),
        groupId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        preferredRegion: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
        maxWaitTime: joi_1.default.number().integer().min(30).max(600).optional(),
    }).unknown(false),
    joinOrgQueueBody: joi_1.default.object({
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .required(),
        organizationId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        preferredRegion: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
        maxWaitTime: joi_1.default.number().integer().min(30).max(600).optional(),
    }).unknown(false),
    queueStatusQuery: joi_1.default.object({
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .optional(),
        region: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    }).unknown(false),
    leaveQueueBody: joi_1.default.object({
        reason: joi_1.default.string().valid('CANCELLED', 'TIMEOUT', 'PLAYER_DISCONNECT').optional(),
    }).unknown(false),
    playerIdParam: joi_1.default.object({
        playerId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    playerStatsQuery: joi_1.default.object({
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .optional(),
        period: joi_1.default.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL_TIME').default('MONTH'),
    }).unknown(false),
    leaderboardQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        gameMode: joi_1.default.string()
            .valid('DEATHMATCH', 'TEAM_DEATHMATCH', 'CAPTURE_THE_FLAG', 'KING_OF_THE_HILL', 'ELIMINATION')
            .optional(),
        region: joi_1.default.string().valid('US_EAST', 'US_WEST', 'EU', 'ASIA', 'AU').optional(),
    }).unknown(false),
    matchIdParam: joi_1.default.object({
        matchId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    matchResultsQuery: joi_1.default.object({}).unknown(false),
    reportMatchBody: joi_1.default.object({
        result: joi_1.default.string().valid('WIN', 'LOSS', 'DRAW', 'CANCELLED').required(),
        kills: joi_1.default.number().integer().min(0).optional(),
        deaths: joi_1.default.number().integer().min(0).optional(),
        assists: joi_1.default.number().integer().min(0).optional(),
        damageDealt: joi_1.default.number().min(0).optional(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }).unknown(false),
    participantsQuery: joi_1.default.object({
        sortBy: joi_1.default.string().valid('rating', 'kills', 'damage', 'joinTime').optional(),
    }).unknown(false),
};
//# sourceMappingURL=matchmakingQuerySchemas.js.map