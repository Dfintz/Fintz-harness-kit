"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.tagSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        color: joi_1.default.string()
            .pattern(/^#[0-9a-fA-F]{6}$/)
            .default('#6366f1'),
        description: joi_1.default.string().trim().max(500).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        color: joi_1.default.string()
            .pattern(/^#[0-9a-fA-F]{6}$/)
            .optional(),
        description: joi_1.default.string().trim().max(500).allow('').optional(),
    }).min(1),
    apply: joi_1.default.object({
        resourceType: joi_1.default.string().trim().min(1).max(64).required(),
        resourceId: joi_1.default.string().trim().min(1).max(255).required(),
    }),
    remove: joi_1.default.object({
        resourceType: joi_1.default.string().trim().min(1).max(64).required(),
        resourceId: joi_1.default.string().trim().min(1).max(255).required(),
    }),
    query: joi_1.default.object({
        search: joi_1.default.string().trim().max(200).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).default(50),
    }),
    param: joi_1.default.object({
        tagId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=tagSchemas.js.map