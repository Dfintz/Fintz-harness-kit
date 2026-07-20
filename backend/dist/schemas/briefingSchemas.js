"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.briefingSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const CLASSIFICATION_VALUES = [
    'public',
    'restricted',
    'confidential',
    'secret',
    'top_secret',
];
exports.briefingSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required().messages({
            'string.empty': 'Title is required',
            'any.required': 'Title is required',
        }),
        missionId: common_1.id.optional().allow(null),
        type: joi_1.default.string()
            .valid('mission', 'operation', 'training', 'event', 'announcement')
            .default('mission'),
        classification: joi_1.default.string()
            .valid(...CLASSIFICATION_VALUES)
            .default('restricted'),
        operationIds: joi_1.default.array().items(common_1.id).max(20).optional(),
        summary: joi_1.default.string().trim().max(1000).optional(),
        content: joi_1.default.string().trim().max(50000).optional(),
        objectives: joi_1.default.array().items(joi_1.default.string().trim().max(500)).max(20).optional(),
        targetDate: joi_1.default.date().iso().optional().allow(null),
        expiresAt: joi_1.default.date().iso().optional().allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        notes: common_1.notes,
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        classification: joi_1.default.string()
            .valid(...CLASSIFICATION_VALUES)
            .optional(),
        operationIds: joi_1.default.array().items(common_1.id).max(20).optional(),
        elements: joi_1.default.array().optional(),
        backgroundImage: joi_1.default.string().max(7_000_000).optional().allow(null),
        pages: joi_1.default.array()
            .items(joi_1.default.object({
            backgroundImage: joi_1.default.string().max(7_000_000).optional().allow(null),
        }))
            .max(50)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        status: joi_1.default.string().valid('draft', 'active', 'completed', 'archived').optional(),
        participants: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(100).optional(),
    }),
    postToDiscord: joi_1.default.object({
        webhookUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .max(500)
            .required()
            .messages({
            'string.uri': 'webhookUrl must be a valid https URL',
            'any.required': 'webhookUrl is required',
        }),
    }),
    addElement: joi_1.default.object({
        type: joi_1.default.string()
            .valid('text', 'shape', 'line', 'arrow', 'marker', 'image', 'map', 'waypoint', 'video', 'link', 'file', 'tactical-unit', 'map-reference', 'interdiction-point', 'ship-map')
            .required(),
        title: joi_1.default.string().trim().max(200).optional(),
        content: joi_1.default.string().trim().max(10000).optional(),
        url: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        order: joi_1.default.number().integer().min(0).optional(),
        metadata: joi_1.default.object().optional(),
        position: joi_1.default.object({
            x: joi_1.default.number().required(),
            y: joi_1.default.number().required(),
        }).optional(),
        size: joi_1.default.object({
            width: joi_1.default.number().min(0).required(),
            height: joi_1.default.number().min(0).required(),
        }).optional(),
        data: joi_1.default.object().optional(),
        style: joi_1.default.object().optional(),
        unitType: joi_1.default.string().trim().max(50).optional(),
        formationSize: joi_1.default.string().trim().max(50).optional(),
        locationSystem: joi_1.default.string().trim().max(100).optional(),
        locationCode: joi_1.default.string().trim().max(100).optional(),
        locationName: joi_1.default.string().trim().max(200).optional(),
        pageIndex: joi_1.default.number().integer().min(0).max(49).optional(),
    }),
    updateElement: joi_1.default.object({
        title: joi_1.default.string().trim().max(200).optional(),
        content: joi_1.default.string().trim().max(10000).optional(),
        url: joi_1.default.string().uri().trim().max(500).optional().allow(null),
        order: joi_1.default.number().integer().min(0).optional(),
        metadata: joi_1.default.object().optional(),
        position: joi_1.default.object({
            x: joi_1.default.number().required(),
            y: joi_1.default.number().required(),
        }).optional(),
        size: joi_1.default.object({
            width: joi_1.default.number().min(0).required(),
            height: joi_1.default.number().min(0).required(),
        }).optional(),
        data: joi_1.default.object().optional(),
        style: joi_1.default.object().optional(),
    }),
    addParticipant: joi_1.default.object({
        userId: common_1.id,
        role: joi_1.default.string().valid('viewer', 'contributor', 'editor', 'owner').default('viewer'),
        required: joi_1.default.boolean().default(false),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('draft', 'active', 'completed', 'archived').required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        sortBy: joi_1.default.string()
            .valid('createdAt', 'updatedAt', 'title', 'status', 'classification', 'version')
            .default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
        type: joi_1.default.string()
            .valid('mission', 'operation', 'training', 'event', 'announcement')
            .optional(),
        classification: joi_1.default.string()
            .valid(...CLASSIFICATION_VALUES)
            .optional(),
        operationId: common_1.id.optional(),
        status: joi_1.default.string().valid('draft', 'active', 'completed', 'archived').optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    }),
};
//# sourceMappingURL=briefingSchemas.js.map