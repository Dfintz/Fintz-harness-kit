"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.apiKeySchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        scopes: joi_1.default.array()
            .items(joi_1.default.string().valid('read:activities', 'write:activities', 'read:fleet', 'read:profile', '*'))
            .min(1)
            .max(10)
            .required(),
        expiresInDays: joi_1.default.number().integer().min(1).max(365).optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        scopes: joi_1.default.array()
            .items(joi_1.default.string().valid('read:activities', 'write:activities', 'read:fleet', 'read:profile', '*'))
            .min(1)
            .max(10)
            .optional(),
    }),
};
//# sourceMappingURL=apiKeySchemas.js.map