"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.rateLimitSchemas = {
    updateConfig: joi_1.default.object({
        endpoints: joi_1.default.object()
            .pattern(joi_1.default.string(), joi_1.default.object({
            windowMs: joi_1.default.number().integer().min(1000).max(3600000).optional(),
            maxRequests: joi_1.default.number().integer().min(1).max(10000).optional(),
        }))
            .required(),
    }),
    reset: joi_1.default.object({
        userId: joi_1.default.string().trim().min(1).max(100).required(),
    }),
};
//# sourceMappingURL=rateLimitSchemas.js.map