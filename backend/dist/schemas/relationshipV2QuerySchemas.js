"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relationshipV2QuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.relationshipV2QuerySchemas = {
    idParam: joi_1.default.object({
        id: joi_1.default.string()
            .trim()
            .uuid({ version: ['uuidv4'] })
            .required(),
    }).unknown(false),
    historyQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        changeType: joi_1.default.string()
            .valid('TRUST_CHANGED', 'SENTIMENT_RECORDED', 'STATUS_CHANGED', 'NOTE_ADDED', 'INTERACTION_RECORDED')
            .optional(),
    }).unknown(false),
    timelineQuery: joi_1.default.object({
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        includeInteractions: joi_1.default.boolean().optional(),
        includeTrustChanges: joi_1.default.boolean().optional(),
    })
        .unknown(false)
        .external((value) => {
        if (value.startDate && value.endDate && value.startDate >= value.endDate) {
            throw new Error('startDate must be before endDate');
        }
    }),
    analyticsQuery: joi_1.default.object({
        period: joi_1.default.string().valid('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL').default('MONTH'),
        includeMetrics: joi_1.default.boolean().optional(),
        includeProjections: joi_1.default.boolean().optional(),
    }).unknown(false),
    sentimentTrendQuery: joi_1.default.object({
        granularity: joi_1.default.string().valid('DAILY', 'WEEKLY', 'MONTHLY').default('WEEKLY'),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    })
        .unknown(false)
        .external((value) => {
        if (value.startDate && value.endDate && value.startDate >= value.endDate) {
            throw new Error('startDate must be before endDate');
        }
    }),
    updateBody: joi_1.default.object({
        type: joi_1.default.string()
            .valid('allied', 'partnership', 'cooperative', 'affiliated', 'trading_partner', 'neutral', 'observer', 'interested', 'competitive', 'rival', 'hostile', 'war', 'parent', 'subsidiary', 'merger_pending', 'under_negotiation')
            .optional(),
        status: joi_1.default.string()
            .valid('active', 'pending', 'suspended', 'terminated', 'expired')
            .optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(''),
        notes: joi_1.default.string().trim().max(1000).optional().allow(''),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).optional(),
        contactName: joi_1.default.string().trim().max(200).optional().allow(''),
        contactRole: joi_1.default.string().trim().max(200).optional().allow(''),
        contactEmail: joi_1.default.string().trim().email({ tlds: false }).max(254).optional().allow(''),
        communicationChannels: joi_1.default.array().items(joi_1.default.string().trim().max(100)).optional(),
        reviewDate: joi_1.default.string().isoDate().optional().allow(null, ''),
        expiryDate: joi_1.default.string().isoDate().optional().allow(null, ''),
        isPublic: joi_1.default.boolean().optional(),
        autoRenew: joi_1.default.boolean().optional(),
    }).unknown(false),
    terminateBody: joi_1.default.object({
        reason: joi_1.default.string()
            .valid('MUTUAL_AGREEMENT', 'USER_REQUEST', 'CONFLICT_RESOLUTION', 'OTHER')
            .required(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }).unknown(false),
    listQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
        status: joi_1.default.string()
            .valid('active', 'pending', 'suspended', 'terminated', 'expired')
            .optional(),
        type: joi_1.default.string()
            .valid('allied', 'partnership', 'cooperative', 'affiliated', 'trading_partner', 'neutral', 'observer', 'interested', 'competitive', 'rival', 'hostile', 'war', 'parent', 'subsidiary', 'merger_pending', 'under_negotiation')
            .optional(),
        minTrustScore: joi_1.default.number().min(-100).max(100).optional(),
        maxTrustScore: joi_1.default.number().min(-100).max(100).optional(),
    }).unknown(false),
    typesQuery: joi_1.default.object({}).unknown(false),
    sentimentsQuery: joi_1.default.object({}).unknown(false),
    changeTypesQuery: joi_1.default.object({}).unknown(false),
};
//# sourceMappingURL=relationshipV2QuerySchemas.js.map