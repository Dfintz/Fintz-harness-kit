"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.configSchemas = {
    updateAll: joi_1.default.object({
        settings: joi_1.default.object()
            .pattern(joi_1.default.string().trim().min(1).max(100), joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.number(), joi_1.default.boolean(), joi_1.default.object(), joi_1.default.array()))
            .required(),
    }),
    updateKey: joi_1.default.object({
        value: joi_1.default.alternatives()
            .try(joi_1.default.string(), joi_1.default.number(), joi_1.default.boolean(), joi_1.default.object(), joi_1.default.array())
            .required(),
        description: joi_1.default.string().trim().max(500).optional(),
    }),
    importConfig: joi_1.default.object({
        settings: joi_1.default.object()
            .pattern(joi_1.default.string().trim().min(1).max(100), joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.number(), joi_1.default.boolean(), joi_1.default.object(), joi_1.default.array()))
            .required(),
        overwrite: joi_1.default.boolean().default(false),
    }),
    query: joi_1.default.object({
        scope: joi_1.default.string().valid('global', 'org', 'user').optional(),
    }),
    exportQuery: joi_1.default.object({
        scope: joi_1.default.string().valid('global', 'org', 'user').optional(),
        format: joi_1.default.string().valid('json', 'yaml').default('json'),
    }),
    param: joi_1.default.object({
        key: joi_1.default.string().trim().min(1).max(100).required(),
    }),
};
//# sourceMappingURL=configSchemas.js.map