"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityTemplateSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const activityTypeValues = [
    'mission',
    'contract',
    'bounty',
    'event',
    'lfg',
    'operation',
    'job_listing',
];
const categoryValues = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'logistics',
    'social',
    'training',
    'custom',
];
const roleRequirementSchema = joi_1.default.object({
    role: joi_1.default.string().trim().min(1).max(100).required(),
    count: joi_1.default.number().integer().min(1).max(100).required(),
    required: joi_1.default.boolean().required(),
});
const resourceRequirementSchema = joi_1.default.object({
    resource: joi_1.default.string().trim().min(1).max(100).required(),
    quantity: joi_1.default.number().integer().min(1).required(),
    required: joi_1.default.boolean().required(),
});
const templateDataSchema = joi_1.default.object({
    description: joi_1.default.string().trim().max(2000).optional(),
    activityType: joi_1.default.string()
        .valid(...activityTypeValues)
        .optional(),
    visibility: joi_1.default.string()
        .valid('public', 'organization', 'private', 'unlisted', 'restricted', 'federation')
        .optional(),
    maxParticipants: joi_1.default.number().integer().min(1).max(200).optional(),
    minParticipants: joi_1.default.number().integer().min(1).max(200).optional(),
    locationSystem: joi_1.default.string().trim().max(200).optional(),
    locationPlanet: joi_1.default.string().trim().max(200).optional(),
    locationDetails: joi_1.default.string().trim().max(500).optional(),
    estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
    requirements: joi_1.default.array().items(joi_1.default.string().trim().max(200)).max(20).optional(),
    objectives: joi_1.default.array().items(joi_1.default.string().trim().max(200)).max(20).optional(),
    roleRequirements: joi_1.default.array().items(roleRequirementSchema).max(20).optional(),
    resourceRequirements: joi_1.default.array().items(resourceRequirementSchema).max(20).optional(),
    requiredShips: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(100)).max(20).optional(),
    preferredShips: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(100)).max(20).optional(),
    tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
    metadata: joi_1.default.object().unknown(true).optional(),
});
exports.activityTemplateSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(150).required(),
        description: joi_1.default.string().trim().max(1000).optional().allow('', null),
        activityType: joi_1.default.string()
            .valid(...activityTypeValues)
            .required(),
        category: joi_1.default.string()
            .valid(...categoryValues)
            .optional(),
        templateData: templateDataSchema.default({}),
        isPublic: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(150).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow('', null),
        activityType: joi_1.default.string()
            .valid(...activityTypeValues)
            .optional(),
        category: joi_1.default.string()
            .valid(...categoryValues)
            .optional(),
        templateData: templateDataSchema.optional(),
        isPublic: joi_1.default.boolean().optional(),
        isActive: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        category: joi_1.default.string()
            .valid(...categoryValues)
            .optional(),
        activityType: joi_1.default.string()
            .valid(...activityTypeValues)
            .optional(),
        isPublic: joi_1.default.boolean().optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    }),
    param: joi_1.default.object({
        templateId: common_1.id.description('Activity template ID'),
    }),
    apply: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        scheduledStartTime: joi_1.default.date().iso().required(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(200).optional(),
        overrides: joi_1.default.object().unknown(true).optional(),
    }),
};
//# sourceMappingURL=activityTemplateSchemas.js.map