"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opportunitySearchSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const activityTypeValues = [
    'mission',
    'contract',
    'bounty',
    'event',
    'lfg',
    'operation',
    'recruitment',
    'job_listing',
];
const activityStatusValues = [
    'draft',
    'open',
    'planning',
    'recruiting',
    'ready',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'expired',
];
const jobTypeValues = [
    'crew',
    'pilot',
    'gunner',
    'engineer',
    'medic',
    'miner',
    'hauler',
    'scout',
    'security',
    'leadership',
    'support',
    'other',
];
const payTypeValues = ['fixed', 'hourly', 'percentage', 'negotiable', 'volunteer'];
const listingCategoryValues = ['job', 'service'];
const sourceTypeValues = ['all', 'job', 'activity'];
const sortByValues = ['postedAt', 'title'];
exports.opportunitySearchSchemas = {
    searchQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        sourceType: joi_1.default.string()
            .valid(...sourceTypeValues)
            .default('all'),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        organizationId: joi_1.default.string().uuid().optional(),
        tags: joi_1.default.string().trim().max(500).optional(),
        jobTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...jobTypeValues)), joi_1.default.string().valid(...jobTypeValues))
            .optional(),
        payTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...payTypeValues)), joi_1.default.string().valid(...payTypeValues))
            .optional(),
        listingCategory: joi_1.default.string()
            .valid(...listingCategoryValues)
            .optional(),
        minPay: joi_1.default.number().integer().min(0).optional(),
        maxPay: joi_1.default.number().integer().min(0).optional(),
        activityTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...activityTypeValues)), joi_1.default.string().valid(...activityTypeValues))
            .optional(),
        activityStatus: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...activityStatusValues)), joi_1.default.string().valid(...activityStatusValues))
            .optional(),
        hasOpenSlots: joi_1.default.boolean().optional(),
        isFeatured: joi_1.default.boolean().optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        minReputationScore: joi_1.default.number().integer().min(0).max(100).optional(),
        reputationTiers: joi_1.default.string().trim().max(200).optional(),
        minSuccessRate: joi_1.default.number().integer().min(0).max(100).optional(),
        sortBy: joi_1.default.string()
            .valid(...sortByValues)
            .optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
};
//# sourceMappingURL=opportunitySearchSchemas.js.map