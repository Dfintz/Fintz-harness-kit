"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.missionSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const missionTypes = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'logistics',
    'rescue',
    'reconnaissance',
    'escort',
    'salvage',
    'custom',
];
const missionStatuses = [
    'draft',
    'planned',
    'briefed',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
];
const difficulties = ['trivial', 'easy', 'medium', 'hard', 'extreme'];
const priorities = ['low', 'normal', 'high', 'critical'];
const participantRoles = ['leader', 'member', 'support', 'reserve'];
const workflowPhases = ['dispatch', 'quartermaster', 'execution', 'after_action'];
exports.missionSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required().messages({
            'string.empty': 'Title is required',
            'any.required': 'Title is required',
        }),
        description: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
        missionType: joi_1.default.string()
            .valid(...missionTypes)
            .default('custom'),
        difficulty: joi_1.default.string()
            .valid(...difficulties)
            .default('medium'),
        priority: joi_1.default.string()
            .valid(...priorities)
            .default('normal'),
        fleetId: common_1.optionalUuid.allow(null),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        objectives: joi_1.default.array()
            .items(joi_1.default.object({
            title: joi_1.default.string().trim().min(1).max(300).required(),
            description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
            optional: joi_1.default.boolean().default(false),
        }))
            .max(50)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        reward: joi_1.default.string().trim().max(500).optional().allow(null, ''),
        startDate: joi_1.default.date().iso().optional().allow(null),
        endDate: joi_1.default.date().iso().optional().allow(null),
        notes: common_1.notes,
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
        missionType: joi_1.default.string()
            .valid(...missionTypes)
            .optional(),
        status: joi_1.default.string()
            .valid(...missionStatuses)
            .optional(),
        difficulty: joi_1.default.string()
            .valid(...difficulties)
            .optional(),
        priority: joi_1.default.string()
            .valid(...priorities)
            .optional(),
        fleetId: common_1.optionalUuid.allow(null),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        objectives: joi_1.default.array()
            .items(joi_1.default.object({
            id: joi_1.default.string().uuid().optional(),
            title: joi_1.default.string().trim().min(1).max(300).required(),
            description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
            completed: joi_1.default.boolean().optional(),
            optional: joi_1.default.boolean().optional(),
            order: joi_1.default.number().integer().min(0).optional(),
        }))
            .max(50)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().min(1).max(50)).max(20).optional(),
        reward: joi_1.default.string().trim().max(500).optional().allow(null, ''),
        startDate: joi_1.default.date().iso().optional().allow(null),
        endDate: joi_1.default.date().iso().optional().allow(null),
        notes: common_1.notes,
    }),
    assign: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required().messages({
            'string.empty': 'User ID is required',
            'any.required': 'User ID is required',
        }),
        role: joi_1.default.string()
            .valid(...participantRoles)
            .default('leader'),
    }),
    complete: joi_1.default.object({
        status: joi_1.default.string().valid('completed', 'failed').required().messages({
            'any.required': 'Outcome status is required',
        }),
        notes: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
    }),
    advanceWorkflow: joi_1.default.object({
        phase: joi_1.default.string()
            .valid(...workflowPhases)
            .required(),
        notes: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...missionStatuses)
            .required()
            .messages({
            'any.required': 'Status is required',
        }),
    }),
    addParticipant: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
        role: joi_1.default.string()
            .valid(...participantRoles)
            .default('member'),
    }),
    addObjective: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(300).required(),
        description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
        optional: joi_1.default.boolean().default(false),
    }),
    updateObjective: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(300).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
        completed: joi_1.default.boolean().optional(),
        optional: joi_1.default.boolean().optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        sortBy: joi_1.default.string()
            .valid('createdAt', 'updatedAt', 'title', 'status', 'priority', 'difficulty', 'startDate', 'missionType')
            .default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        status: joi_1.default.string()
            .valid(...missionStatuses)
            .optional(),
        missionType: joi_1.default.string()
            .valid(...missionTypes)
            .optional(),
        difficulty: joi_1.default.string()
            .valid(...difficulties)
            .optional(),
        priority: joi_1.default.string()
            .valid(...priorities)
            .optional(),
        createdBy: joi_1.default.string().trim().max(100).optional(),
        assignedTo: joi_1.default.string().trim().max(100).optional(),
        fleetId: joi_1.default.string().uuid().optional(),
        tags: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().trim().max(50)), joi_1.default.string().trim().max(50))
            .optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        startDateFrom: joi_1.default.date().iso().optional(),
        startDateTo: joi_1.default.date().iso().optional(),
    }),
    idParam: joi_1.default.object({
        missionId: joi_1.default.string().uuid().required(),
    }),
    objectiveIdParam: joi_1.default.object({
        missionId: joi_1.default.string().uuid().required(),
        objectiveId: joi_1.default.string().uuid().required(),
    }),
    participantIdParam: joi_1.default.object({
        missionId: joi_1.default.string().uuid().required(),
        userId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    scmdbSearchQuery: joi_1.default.object({
        search: joi_1.default.string().trim().max(200).optional(),
        category: joi_1.default.string().trim().max(100).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
    importScmdbMissions: joi_1.default.object({
        items: joi_1.default.array()
            .items(joi_1.default.object({
            externalId: joi_1.default.string().trim().required(),
            priority: joi_1.default.string()
                .valid(...priorities)
                .optional(),
            startDate: joi_1.default.date().iso().optional(),
            endDate: joi_1.default.date().iso().optional(),
            notes: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
        }))
            .min(1)
            .max(100)
            .required(),
    }),
    importScmdbByUrl: joi_1.default.object({
        url: joi_1.default.string().trim().required().messages({
            'string.empty': 'Mission URL or ID is required',
            'any.required': 'Mission URL or ID is required',
        }),
        priority: joi_1.default.string()
            .valid(...priorities)
            .optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        notes: joi_1.default.string().trim().max(5000).optional().allow(null, ''),
    }),
    scmdbFiltersQuery: joi_1.default.object({
        source: joi_1.default.string().trim().max(50).optional(),
    }),
};
//# sourceMappingURL=missionSchemas.js.map