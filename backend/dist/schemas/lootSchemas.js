"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lootSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const distributionMethods = [
    'need_greed',
    'random_roll',
    'auec_bid',
    'even_split',
    'leader_assign',
];
const itemCategories = ['gear', 'component', 'commodity', 'weapon', 'ship', 'other'];
const itemSources = ['manual', 'ocr'];
const claimTypes = ['need', 'greed', 'roll', 'bid'];
const poolStatuses = ['open', 'locked', 'distributed', 'partially_distributed', 'cancelled'];
const rulesSchema = joi_1.default.object({
    maxItemsPerParticipant: joi_1.default.number().integer().min(1).max(1000).optional(),
    shareTotalPayout: joi_1.default.boolean().optional(),
    roleWeights: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.number().positive()).optional(),
    eligibleRoles: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(50).optional(),
    closesAt: joi_1.default.date().iso().optional(),
    minBidIncrement: joi_1.default.number().positive().max(999999999).optional(),
    notes: joi_1.default.string().trim().max(2000).optional(),
});
const itemSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(255).required(),
    category: joi_1.default.string()
        .valid(...itemCategories)
        .default('other'),
    quantity: joi_1.default.number().integer().min(1).max(1000000).default(1),
    unitValue: joi_1.default.number().min(0).precision(2).max(999999999).default(0),
    imageUrl: joi_1.default.string().uri().max(1000).optional(),
    source: joi_1.default.string()
        .valid(...itemSources)
        .default('manual'),
    metadata: joi_1.default.object().optional(),
});
exports.lootSchemas = {
    createPool: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        activityId: joi_1.default.string().uuid().required(),
        missionId: joi_1.default.string().uuid().optional(),
        lfgSessionId: joi_1.default.string().trim().max(255).optional(),
        distributionMethod: joi_1.default.string()
            .valid(...distributionMethods)
            .default('need_greed'),
        rules: rulesSchema.optional(),
        assistantUserIds: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(255)).max(25).optional(),
        currency: joi_1.default.string().trim().max(10).default('aUEC'),
    }),
    updatePool: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        description: joi_1.default.string().trim().max(2000).allow('').optional(),
        distributionMethod: joi_1.default.string()
            .valid(...distributionMethods)
            .optional(),
        rules: rulesSchema.optional(),
        assistantUserIds: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(255)).max(25).optional(),
    }).min(1),
    listQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        activityId: joi_1.default.string().uuid().optional(),
        status: joi_1.default.string()
            .valid(...poolStatuses)
            .optional(),
    }),
    addItem: itemSchema,
    addItemsBulk: joi_1.default.object({
        items: joi_1.default.array().items(itemSchema).min(1).max(200).required(),
    }),
    updateItem: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        category: joi_1.default.string()
            .valid(...itemCategories)
            .optional(),
        quantity: joi_1.default.number().integer().min(1).max(1000000).optional(),
        unitValue: joi_1.default.number().min(0).precision(2).max(999999999).optional(),
        imageUrl: joi_1.default.string().uri().max(1000).allow('').optional(),
    }).min(1),
    assignItem: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(255).required(),
    }),
    claim: joi_1.default.object({
        claimType: joi_1.default.string()
            .valid(...claimTypes)
            .required(),
        bidAmount: joi_1.default.number().positive().precision(2).max(999999999).when('claimType', {
            is: 'bid',
            then: joi_1.default.required(),
            otherwise: joi_1.default.forbidden(),
        }),
    }),
    poolParam: joi_1.default.object({
        poolId: joi_1.default.string().uuid().required(),
    }),
    itemParam: joi_1.default.object({
        poolId: joi_1.default.string().uuid().required(),
        itemId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=lootSchemas.js.map