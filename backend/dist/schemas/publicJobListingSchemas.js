"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicJobListingSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
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
const primaryFocusValues = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'bounty_hunting',
    'medical',
    'transport',
    'salvage',
    'security',
    'social',
    'piracy',
    'racing',
    'mixed',
];
const ownerTypeValues = ['organization', 'alliance', 'user'];
const listingCategoryValues = ['job', 'service'];
const sortByValues = ['postedAt', 'title', 'jobType', 'experienceLevel', 'payMin'];
const shipRequirementTypeValues = ['none', 'required', 'preferred'];
const shipRequirementEntrySchema = joi_1.default.alternatives().try(joi_1.default.object({
    requirementType: joi_1.default.string().valid('specific').required(),
    shipName: joi_1.default.string().trim().min(1).max(200).required(),
    shipId: joi_1.default.string().trim().optional(),
    count: joi_1.default.number().integer().min(1).max(99).required(),
    crewPerShip: joi_1.default.number().integer().min(0).max(500).required(),
}), joi_1.default.object({
    requirementType: joi_1.default.string().valid('role').required(),
    role: joi_1.default.string().trim().min(1).max(200).required(),
    count: joi_1.default.number().integer().min(1).max(99).required(),
    avgCrewPerShip: joi_1.default.number().min(0).max(500).required(),
}));
exports.publicJobListingSchemas = {
    jobListingQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        organizationId: joi_1.default.string().uuid().optional(),
        allianceId: joi_1.default.string().uuid().optional(),
        ownerType: joi_1.default.string()
            .valid(...ownerTypeValues)
            .optional(),
        jobTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...jobTypeValues)), joi_1.default.string().valid(...jobTypeValues))
            .optional(),
        focuses: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...primaryFocusValues)), joi_1.default.string().valid(...primaryFocusValues))
            .optional(),
        payTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...payTypeValues)), joi_1.default.string().valid(...payTypeValues))
            .optional(),
        minPay: joi_1.default.number().integer().min(0).optional(),
        maxPay: joi_1.default.number().integer().min(0).optional(),
        maxExperienceLevel: joi_1.default.number().integer().min(0).max(10).optional(),
        search: joi_1.default.string().trim().max(100).optional(),
        isActive: joi_1.default.boolean().optional(),
        includeExpired: joi_1.default.boolean().optional(),
        listingCategory: joi_1.default.string()
            .valid(...listingCategoryValues)
            .optional(),
        sortBy: joi_1.default.string()
            .valid(...sortByValues)
            .optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
    createJobListing: joi_1.default.object({
        organizationId: joi_1.default.string().uuid().when('ownerType', {
            is: 'organization',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        allianceId: joi_1.default.string().uuid().when('ownerType', {
            is: 'alliance',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        ownerType: joi_1.default.string()
            .valid(...ownerTypeValues)
            .default('user'),
        listingCategory: joi_1.default.string()
            .valid(...listingCategoryValues)
            .default('job'),
        title: joi_1.default.string().trim().min(5).max(255).required(),
        description: joi_1.default.string().trim().max(5000).allow('', null).optional(),
        jobType: joi_1.default.string()
            .valid(...jobTypeValues)
            .required(),
        focus: joi_1.default.string()
            .valid(...primaryFocusValues)
            .default('mixed'),
        payType: joi_1.default.string()
            .valid(...payTypeValues)
            .optional(),
        payMin: joi_1.default.number().integer().min(0).optional(),
        payMax: joi_1.default.number().integer().min(0).optional(),
        experienceLevel: joi_1.default.number().integer().min(0).max(10).default(0),
        expiresAt: joi_1.default.date().iso().min('now').optional(),
        contactInfo: joi_1.default.string().trim().max(255).optional(),
        timezone: joi_1.default.string().max(50).optional(),
        languages: joi_1.default.array().items(joi_1.default.string().max(20)).max(10).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().max(50)).max(10).optional(),
        shipRequirementType: joi_1.default.string()
            .valid(...shipRequirementTypeValues)
            .optional(),
        requiredShips: joi_1.default.array().items(shipRequirementEntrySchema).max(50).optional(),
        crewSpotsTotal: joi_1.default.number().integer().min(1).max(10000).optional(),
    }),
    updateJobListing: joi_1.default.object({
        listingCategory: joi_1.default.string()
            .valid(...listingCategoryValues)
            .optional(),
        title: joi_1.default.string().trim().min(5).max(255).optional(),
        description: joi_1.default.string().trim().max(5000).allow('', null).optional(),
        jobType: joi_1.default.string()
            .valid(...jobTypeValues)
            .optional(),
        focus: joi_1.default.string()
            .valid(...primaryFocusValues)
            .optional(),
        payType: joi_1.default.string()
            .valid(...payTypeValues)
            .optional(),
        payMin: joi_1.default.number().integer().min(0).allow(null).optional(),
        payMax: joi_1.default.number().integer().min(0).allow(null).optional(),
        experienceLevel: joi_1.default.number().integer().min(0).max(10).optional(),
        isActive: joi_1.default.boolean().optional(),
        expiresAt: joi_1.default.date().iso().allow(null).optional(),
        contactInfo: joi_1.default.string().trim().max(255).allow('', null).optional(),
        timezone: joi_1.default.string().max(50).allow('', null).optional(),
        languages: joi_1.default.array().items(joi_1.default.string().max(20)).max(10).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().max(50)).max(10).optional(),
        shipRequirementType: joi_1.default.string()
            .valid(...shipRequirementTypeValues)
            .optional(),
        requiredShips: joi_1.default.array().items(shipRequirementEntrySchema).max(50).allow(null).optional(),
        crewSpotsTotal: joi_1.default.number().integer().min(1).max(10000).allow(null).optional(),
    }),
    assignCrewRole: joi_1.default.object({
        shipIndex: joi_1.default.number().integer().min(0).required(),
        roleIndex: joi_1.default.number().integer().min(0).required(),
        userId: joi_1.default.string().trim().min(1).max(100).required(),
        userName: joi_1.default.string().trim().min(1).max(255).required(),
    }),
    unassignCrewRole: joi_1.default.object({
        shipIndex: joi_1.default.number().integer().min(0).required(),
        roleIndex: joi_1.default.number().integer().min(0).required(),
    }),
};
//# sourceMappingURL=publicJobListingSchemas.js.map