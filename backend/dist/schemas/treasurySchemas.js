"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.treasurySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const transactionTypes = ['income', 'expense', 'transfer', 'dues', 'reward', 'purchase'];
const duesFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly'];
const periods = ['day', 'week', 'month', 'quarter', 'year'];
exports.treasurySchemas = {
    earn: joi_1.default.object({
        amount: joi_1.default.number().positive().precision(2).max(999999999).required(),
        source: joi_1.default.string().trim().min(1).max(500).required(),
        category: joi_1.default.string().trim().max(100).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    spend: joi_1.default.object({
        amount: joi_1.default.number().positive().precision(2).max(999999999).required(),
        purpose: joi_1.default.string().trim().min(1).max(500).required(),
        category: joi_1.default.string().trim().max(100).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    transfer: joi_1.default.object({
        toUserId: joi_1.default.string().trim().min(1).max(255).required(),
        amount: joi_1.default.number().positive().precision(2).max(999999999).required(),
        note: joi_1.default.string().trim().max(500).optional(),
    }),
    transactionQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        type: joi_1.default.string()
            .valid(...transactionTypes)
            .optional(),
        category: joi_1.default.string().trim().max(100).optional(),
        fromUserId: joi_1.default.string().trim().max(255).optional(),
        toUserId: joi_1.default.string().trim().max(255).optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        sortBy: joi_1.default.string().valid('createdAt', 'amount').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    statisticsQuery: joi_1.default.object({
        period: joi_1.default.string()
            .valid(...periods)
            .optional(),
    }),
    leaderboardQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(50).default(10),
    }),
    createDues: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).required(),
        amount: joi_1.default.number().positive().precision(2).max(999999999).required(),
        frequency: joi_1.default.string()
            .valid(...duesFrequencies)
            .required(),
        dueDay: joi_1.default.number().integer().min(0).max(31).default(1),
        gracePeriodDays: joi_1.default.number().integer().min(0).max(90).default(7),
    }),
    updateDues: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        amount: joi_1.default.number().positive().precision(2).max(999999999).optional(),
        frequency: joi_1.default.string()
            .valid(...duesFrequencies)
            .optional(),
        isActive: joi_1.default.boolean().optional(),
        dueDay: joi_1.default.number().integer().min(0).max(31).optional(),
        gracePeriodDays: joi_1.default.number().integer().min(0).max(90).optional(),
    }),
    duesQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        activeOnly: joi_1.default.boolean().default(false),
    }),
    createCommissaryItem: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        price: joi_1.default.number().positive().precision(2).max(999999999).required(),
        category: joi_1.default.string().trim().min(1).max(100).required(),
        stock: joi_1.default.number().integer().min(-1).default(-1),
        imageUrl: joi_1.default.string().uri().max(1000).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    updateCommissaryItem: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        description: joi_1.default.string().trim().max(2000).optional(),
        price: joi_1.default.number().positive().precision(2).max(999999999).optional(),
        category: joi_1.default.string().trim().max(100).optional(),
        stock: joi_1.default.number().integer().min(-1).optional(),
        isActive: joi_1.default.boolean().optional(),
        imageUrl: joi_1.default.string().uri().max(1000).allow('').optional(),
        metadata: joi_1.default.object().optional(),
    }),
    commissaryQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        category: joi_1.default.string().trim().max(100).optional(),
        activeOnly: joi_1.default.boolean().default(true),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        sortBy: joi_1.default.string().valid('createdAt', 'price', 'name').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    purchase: joi_1.default.object({
        quantity: joi_1.default.number().integer().min(1).max(100).required(),
    }),
    purchaseQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        buyerId: joi_1.default.string().trim().max(255).optional(),
    }),
    duesParam: joi_1.default.object({
        duesId: joi_1.default.string().uuid().required(),
    }),
    itemParam: joi_1.default.object({
        itemId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=treasurySchemas.js.map