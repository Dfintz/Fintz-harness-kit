"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const pollTypes = ['single_choice', 'multiple_choice', 'ranked', 'approval'];
const pollVisibilities = ['public', 'members_only', 'role_restricted'];
const pollStatuses = ['draft', 'active', 'closed', 'cancelled'];
const pollOptionSchema = joi_1.default.object({
    id: joi_1.default.string().trim().min(1).max(100).required(),
    label: joi_1.default.string().trim().min(1).max(200).required(),
    description: joi_1.default.string().trim().max(500).optional(),
    sortOrder: joi_1.default.number().integer().min(0).required(),
});
exports.pollSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        pollType: joi_1.default.string()
            .valid(...pollTypes)
            .required(),
        visibility: joi_1.default.string()
            .valid(...pollVisibilities)
            .default('members_only'),
        options: joi_1.default.array().items(pollOptionSchema).min(2).max(50).required(),
        isAnonymous: joi_1.default.boolean().default(false),
        maxSelections: joi_1.default.number().integer().min(1).max(50).default(1),
        endsAt: joi_1.default.date().iso().min('now').optional(),
        allowedRoles: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(20).optional(),
        status: joi_1.default.string().valid('draft', 'active').default('active'),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: joi_1.default.string().trim().max(2000).optional().allow(null),
        visibility: joi_1.default.string()
            .valid(...pollVisibilities)
            .optional(),
        options: joi_1.default.array().items(pollOptionSchema).min(2).max(50).optional(),
        isAnonymous: joi_1.default.boolean().optional(),
        maxSelections: joi_1.default.number().integer().min(1).max(50).optional(),
        endsAt: joi_1.default.date().iso().min('now').optional().allow(null),
        allowedRoles: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(20).optional().allow(null),
    }),
    vote: joi_1.default.object({
        votes: joi_1.default.array()
            .items(joi_1.default.object({
            optionId: joi_1.default.string().trim().min(1).max(100).required(),
            rank: joi_1.default.number().integer().min(1).optional(),
        }))
            .min(1)
            .max(50)
            .required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid(...pollStatuses)
            .optional(),
        pollType: joi_1.default.string()
            .valid(...pollTypes)
            .optional(),
        createdBy: joi_1.default.string().trim().max(100).optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        sortBy: joi_1.default.string().valid('createdAt', 'title', 'endsAt', 'status').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC', 'asc', 'desc').uppercase().default('DESC'),
    }),
    param: joi_1.default.object({
        pollId: joi_1.default.string().uuid().required(),
    }),
    mirrorParam: joi_1.default.object({
        pollId: joi_1.default.string().uuid().required(),
        mirrorId: joi_1.default.string().uuid().required(),
    }),
    mirrorToGuild: joi_1.default.object({
        guildId: joi_1.default.string().trim().min(1).max(20).required(),
        channelId: joi_1.default.string().trim().min(1).max(20).required(),
    }),
    mirrorToFederation: joi_1.default.object({
        federationId: joi_1.default.string().uuid().required(),
        channelId: joi_1.default.string().trim().min(1).max(20).optional(),
    }),
};
//# sourceMappingURL=pollSchemas.js.map