"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceSchemas = exports.claimSchemas = exports.bountySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const bountyTypes = ['kill', 'capture', 'intel', 'transport', 'rescue', 'custom'];
const targetTypes = ['player', 'npc', 'ship', 'location', 'item', 'other'];
const rewardTypes = ['credits', 'item', 'reputation', 'mixed', 'other'];
const bountyStatuses = [
    'active',
    'claimed',
    'in_progress',
    'completed',
    'verified',
    'paid',
    'cancelled',
    'expired',
];
const difficultyLevels = ['easy', 'medium', 'hard', 'expert'];
const visibilityLevels = ['public', 'organization', 'alliance', 'private'];
const claimStatuses = ['active', 'submitted', 'completed', 'abandoned', 'rejected'];
const evidenceTypes = ['screenshot', 'video', 'text', 'link', 'file'];
exports.bountySchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        bountyType: joi_1.default.string()
            .valid(...bountyTypes)
            .required(),
        targetType: joi_1.default.string()
            .valid(...targetTypes)
            .required(),
        targetIdentifier: joi_1.default.string().trim().max(100).optional(),
        targetName: joi_1.default.string().trim().max(100).optional(),
        targetDetails: joi_1.default.object({
            lastKnownLocation: joi_1.default.string().trim().max(200).optional(),
            shipType: joi_1.default.string().trim().max(100).optional(),
            affiliations: joi_1.default.array().items(joi_1.default.string().trim().max(100)).optional(),
            threat_level: joi_1.default.string().trim().max(50).optional(),
            notes: joi_1.default.string().trim().max(1000).optional(),
            imageUrl: joi_1.default.string().uri().optional(),
        }).optional(),
        rewardType: joi_1.default.string()
            .valid(...rewardTypes)
            .required(),
        rewardAmount: joi_1.default.number().integer().min(0).max(999999999).optional(),
        rewardDescription: joi_1.default.string().trim().max(500).optional(),
        difficulty: joi_1.default.string()
            .valid(...difficultyLevels)
            .optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        systemLocation: joi_1.default.string().trim().max(100).optional(),
        expiresAt: joi_1.default.date().iso().min('now').optional(),
        visibility: joi_1.default.string()
            .valid(...visibilityLevels)
            .default('organization'),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: joi_1.default.string().trim().max(2000).optional(),
        targetIdentifier: joi_1.default.string().trim().max(100).optional(),
        targetName: joi_1.default.string().trim().max(100).optional(),
        targetDetails: joi_1.default.object({
            lastKnownLocation: joi_1.default.string().trim().max(200).optional(),
            shipType: joi_1.default.string().trim().max(100).optional(),
            affiliations: joi_1.default.array().items(joi_1.default.string().trim().max(100)).optional(),
            threat_level: joi_1.default.string().trim().max(50).optional(),
            notes: joi_1.default.string().trim().max(1000).optional(),
            imageUrl: joi_1.default.string().uri().optional(),
        }).optional(),
        rewardAmount: joi_1.default.number().integer().min(0).max(999999999).optional(),
        rewardDescription: joi_1.default.string().trim().max(500).optional(),
        difficulty: joi_1.default.string()
            .valid(...difficultyLevels)
            .optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        systemLocation: joi_1.default.string().trim().max(100).optional(),
        expiresAt: joi_1.default.date().iso().optional(),
        visibility: joi_1.default.string()
            .valid(...visibilityLevels)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        metadata: joi_1.default.object().optional(),
    }),
    claim: joi_1.default.object({
        notes: joi_1.default.string().trim().max(500).optional(),
    }),
    complete: joi_1.default.object({
        evidence: joi_1.default.array().items(joi_1.default.string().trim().max(500)).max(10).optional(),
        completionNotes: joi_1.default.string().trim().max(2000).optional(),
    }),
    verify: joi_1.default.object({
        approved: joi_1.default.boolean().required(),
        verificationNotes: joi_1.default.string().trim().max(1000).optional(),
    }),
    pay: joi_1.default.object({
        paymentReference: joi_1.default.string().trim().max(200).optional(),
        paymentNotes: joi_1.default.string().trim().max(500).optional(),
    }),
    cancel: joi_1.default.object({
        reason: joi_1.default.string().trim().max(500).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        bountyType: joi_1.default.string()
            .valid(...bountyTypes)
            .optional(),
        status: joi_1.default.string()
            .valid(...bountyStatuses)
            .optional(),
        difficulty: joi_1.default.string()
            .valid(...difficultyLevels)
            .optional(),
        visibility: joi_1.default.string()
            .valid(...visibilityLevels)
            .optional(),
        targetType: joi_1.default.string()
            .valid(...targetTypes)
            .optional(),
        createdBy: joi_1.default.string().trim().optional(),
        claimedBy: joi_1.default.string().trim().optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        minReward: joi_1.default.number().integer().min(0).optional(),
        maxReward: joi_1.default.number().integer().min(0).optional(),
        includeExpired: joi_1.default.boolean().default(false),
        sortBy: joi_1.default.string()
            .valid('createdAt', 'rewardAmount', 'expiresAt', 'title')
            .default('createdAt'),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    listMine: joi_1.default.object({
        type: joi_1.default.string().valid('created', 'claimed', 'both').default('both'),
        status: joi_1.default.string()
            .valid(...bountyStatuses)
            .optional(),
        ...common_1.paginationKeys,
    }),
};
exports.claimSchemas = {
    create: joi_1.default.object({
        bountyId: joi_1.default.string().uuid().required(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }),
    submit: joi_1.default.object({
        completionNotes: joi_1.default.string().trim().max(2000).optional(),
    }),
    abandon: joi_1.default.object({
        reason: joi_1.default.string().trim().max(500).optional(),
    }),
    verify: joi_1.default.object({
        approved: joi_1.default.boolean().required(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    approve: joi_1.default.object({
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    reject: joi_1.default.object({
        reason: joi_1.default.string().trim().min(10).max(1000).required(),
    }),
    pay: joi_1.default.object({
        paymentReference: joi_1.default.string().trim().max(200).optional(),
        paymentNotes: joi_1.default.string().trim().max(500).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid(...claimStatuses)
            .optional(),
        hunterId: joi_1.default.string().uuid().optional(),
        bountyId: joi_1.default.string().uuid().optional(),
        sortBy: joi_1.default.string().valid('claimedAt', 'submittedAt', 'completedAt').default('claimedAt'),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
};
exports.evidenceSchemas = {
    submit: joi_1.default.object({
        evidenceType: joi_1.default.string()
            .valid(...evidenceTypes)
            .required(),
        content: joi_1.default.string().trim().max(5000).optional(),
        fileUrl: joi_1.default.string().uri().max(500).optional(),
        fileName: joi_1.default.string().trim().max(255).optional(),
        fileSize: joi_1.default.number().integer().min(0).max(52428800).optional(),
        mimeType: joi_1.default.string().trim().max(100).optional(),
    }).or('content', 'fileUrl'),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    query: joi_1.default.object({
        claimId: joi_1.default.string().uuid().required(),
        evidenceType: joi_1.default.string()
            .valid(...evidenceTypes)
            .optional(),
    }),
};
//# sourceMappingURL=bountySchemas.js.map