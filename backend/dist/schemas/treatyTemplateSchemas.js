"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.treatyTemplateSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const VALID_CATEGORIES = [
    'mutual_defense',
    'trade',
    'non_aggression',
    'resource_sharing',
    'intel_sharing',
    'military_cooperation',
    'custom',
];
const VALID_SCOPES = ['alliance', 'federation', 'both'];
const clauseSchema = joi_1.default.object({
    title: joi_1.default.string().min(2).max(200).required(),
    text: joi_1.default.string().min(5).max(5000).required(),
    isRequired: joi_1.default.boolean().default(false),
    sortOrder: joi_1.default.number().integer().min(0).optional(),
});
exports.treatyTemplateSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().min(3).max(200).required(),
        description: joi_1.default.string().min(10).max(2000).required(),
        category: joi_1.default.string()
            .valid(...VALID_CATEGORIES)
            .required(),
        scope: joi_1.default.string()
            .valid(...VALID_SCOPES)
            .default('both'),
        clauses: joi_1.default.array().items(clauseSchema).min(1).max(50).required(),
        isPublished: joi_1.default.boolean().default(false),
        tags: joi_1.default.array().items(joi_1.default.string().max(50)).max(20).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().min(3).max(200),
        description: joi_1.default.string().min(10).max(2000),
        category: joi_1.default.string().valid(...VALID_CATEGORIES),
        scope: joi_1.default.string().valid(...VALID_SCOPES),
        clauses: joi_1.default.array().items(clauseSchema).min(1).max(50),
        isPublished: joi_1.default.boolean(),
        tags: joi_1.default.array().items(joi_1.default.string().max(50)).max(20),
    }).min(1),
    instantiate: joi_1.default.object({
        templateId: joi_1.default.string().required(),
        clauseOverrides: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string().min(5).max(5000)).optional(),
        additionalClauses: joi_1.default.array()
            .items(joi_1.default.object({
            title: joi_1.default.string().min(2).max(200).required(),
            text: joi_1.default.string().min(5).max(5000).required(),
        }))
            .max(20)
            .optional(),
        excludeClauses: joi_1.default.array().items(joi_1.default.string().max(200)).max(50).optional(),
    }),
    listQuery: joi_1.default.object({
        category: joi_1.default.string()
            .valid(...VALID_CATEGORIES)
            .optional(),
        scope: joi_1.default.string()
            .valid(...VALID_SCOPES)
            .optional(),
        search: joi_1.default.string().max(200).optional(),
        ...(0, common_1.paginationKeysWith)(50),
    }),
    param: joi_1.default.object({
        id: joi_1.default.string().required(),
    }),
};
//# sourceMappingURL=treatyTemplateSchemas.js.map