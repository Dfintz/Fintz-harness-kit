"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityExtendedQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const pagination = {
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(10),
    sortBy: joi_1.default.string()
        .valid('name', 'startDate', 'createdAt', 'participantCount', 'status')
        .default('startDate'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('ASC'),
};
exports.activityExtendedQuerySchemas = {
    searchQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        q: joi_1.default.string().trim().max(200).optional(),
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        type: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'recruitment', 'job_listing')
            .optional(),
        difficulty: joi_1.default.string().valid('easy', 'medium', 'hard', 'expert').optional(),
        minParticipants: joi_1.default.number().integer().min(0).optional(),
        maxParticipants: joi_1.default.number().integer().min(0).optional(),
        startDateFrom: joi_1.default.date().iso().optional(),
        startDateTo: joi_1.default.date().iso().optional(),
        visibility: joi_1.default.string().valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed').optional(),
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
        includeExpired: joi_1.default.boolean().optional(),
        myActivitiesOnly: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .messages({
        'any.invalid': 'Invalid {#label} value',
        'date.base': '{#label} must be valid ISO date',
    }),
    myActivitiesQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        type: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'recruitment', 'job_listing')
            .optional(),
        role: joi_1.default.string().valid('OWNER', 'ORGANIZER', 'LEAD', 'PARTICIPANT', 'BACKUP').optional(),
        includeExpired: joi_1.default.boolean().optional(),
    }).unknown(false),
    statisticsQuery: joi_1.default.object({
        groupBy: joi_1.default.string().valid('type', 'status', 'difficulty', 'month').optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }).unknown(false),
    joinActivityBody: joi_1.default.object({
        notes: joi_1.default.string().trim().max(500).optional(),
        preferredRole: joi_1.default.string().valid('LEAD', 'PARTICIPANT', 'BACKUP', 'SUPPORT').optional(),
    }).unknown(false),
    inviteOrgBody: joi_1.default.object({
        organizationId: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
        message: joi_1.default.string().trim().max(500).optional(),
    }).unknown(false),
    participantsQuery: joi_1.default.object({
        page: pagination.page,
        limit: pagination.limit,
        status: joi_1.default.string().valid('CONFIRMED', 'PENDING', 'DECLINED', 'STANDBY').optional(),
        role: joi_1.default.string().valid('LEAD', 'PARTICIPANT', 'BACKUP', 'SUPPORT').optional(),
    }).unknown(false),
};
//# sourceMappingURL=activityExtendedQuerySchemas.js.map