"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wikiSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.wikiSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(200).required().messages({
            'string.empty': 'Title is required',
            'any.required': 'Title is required',
        }),
        content: joi_1.default.string().max(100_000).optional().allow(null, '').default(''),
        parentPageId: common_1.optionalUuid.allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional().default([]),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(1).max(200).optional(),
        content: joi_1.default.string().max(100_000).optional().allow(null, ''),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        changeDescription: joi_1.default.string().trim().max(500).optional().allow(null, ''),
        isLocked: joi_1.default.boolean().optional(),
    }).min(1),
    move: joi_1.default.object({
        parentPageId: joi_1.default.string().uuid().allow(null).required(),
        sortOrder: joi_1.default.number().integer().min(0).default(0),
    }),
    search: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).required().messages({
            'string.empty': 'Search query is required',
            'any.required': 'Search query is required',
        }),
        limit: joi_1.default.number().integer().min(1).max(50).default(20),
    }),
    restore: joi_1.default.object({
        revisionId: joi_1.default.string().uuid().required().messages({
            'any.required': 'Revision ID is required',
        }),
    }),
    pageIdParam: joi_1.default.object({
        pageId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    revisionIdParam: joi_1.default.object({
        pageId: joi_1.default.string().trim().min(1).max(100).required(),
        revisionId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=wikiSchemas.js.map