"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const skillCategories = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'medical',
    'engineering',
    'piloting',
    'leadership',
    'logistics',
    'other',
];
const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
exports.skillSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        description: joi_1.default.string().trim().max(1000).optional(),
        category: joi_1.default.string()
            .valid(...skillCategories)
            .default('other'),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        description: joi_1.default.string().trim().max(1000).allow('').optional(),
        category: joi_1.default.string()
            .valid(...skillCategories)
            .optional(),
    }).min(1),
    assignSkill: joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
        level: joi_1.default.string()
            .valid(...skillLevels)
            .default('beginner'),
    }),
    endorse: joi_1.default.object({
        userId: joi_1.default.string().uuid().required(),
    }),
    query: joi_1.default.object({
        category: joi_1.default.string()
            .valid(...skillCategories)
            .optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).default(50),
    }),
    param: joi_1.default.object({
        skillId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=skillSchemas.js.map