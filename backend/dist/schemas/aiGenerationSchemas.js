"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGenerationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
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
const difficulties = ['trivial', 'easy', 'medium', 'hard', 'extreme'];
exports.aiGenerationSchemas = {
    generateBriefing: joi_1.default.object({
        missionType: joi_1.default.string()
            .valid(...missionTypes)
            .optional()
            .messages({ 'any.only': 'missionType must be a valid mission type' }),
        difficulty: joi_1.default.string()
            .valid(...difficulties)
            .optional()
            .messages({ 'any.only': 'difficulty must be a valid difficulty level' }),
        objectives: joi_1.default.array()
            .items(joi_1.default.object({
            id: joi_1.default.string().trim().optional(),
            title: joi_1.default.string().trim().min(1).max(300).required(),
            description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
            completed: joi_1.default.boolean().optional().default(false),
            optional: joi_1.default.boolean().optional().default(false),
            order: joi_1.default.number().integer().min(0).optional().default(0),
        }))
            .max(50)
            .optional(),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        fleetComposition: joi_1.default.array()
            .items(joi_1.default.object({
            shipName: joi_1.default.string().trim().min(1).max(100).required(),
            role: joi_1.default.string().trim().min(1).max(100).required(),
        }))
            .max(100)
            .optional(),
        participantCount: joi_1.default.number().integer().min(1).max(1000).optional(),
        estimatedDuration: joi_1.default.number()
            .integer()
            .min(1)
            .max(10080)
            .optional()
            .messages({ 'number.max': 'Estimated duration cannot exceed 7 days (10080 minutes)' }),
        additionalContext: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
    }),
    generateBriefingStream: joi_1.default.object({
        missionType: joi_1.default.string()
            .valid(...missionTypes)
            .optional(),
        difficulty: joi_1.default.string()
            .valid(...difficulties)
            .optional(),
        objectives: joi_1.default.array()
            .items(joi_1.default.object({
            id: joi_1.default.string().trim().optional(),
            title: joi_1.default.string().trim().min(1).max(300).required(),
            description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
            completed: joi_1.default.boolean().optional().default(false),
            optional: joi_1.default.boolean().optional().default(false),
            order: joi_1.default.number().integer().min(0).optional().default(0),
        }))
            .max(50)
            .optional(),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        fleetComposition: joi_1.default.array()
            .items(joi_1.default.object({
            shipName: joi_1.default.string().trim().min(1).max(100).required(),
            role: joi_1.default.string().trim().min(1).max(100).required(),
        }))
            .max(100)
            .optional(),
        participantCount: joi_1.default.number().integer().min(1).max(1000).optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(10080).optional(),
        additionalContext: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
    }),
};
//# sourceMappingURL=aiGenerationSchemas.js.map