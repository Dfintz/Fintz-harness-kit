"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalHoldSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.legalHoldSchemas = {
    create: joi_1.default.object({
        userId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'userId must be a valid UUID',
            'any.required': 'userId is required',
        }),
        reason: joi_1.default.string().trim().min(10).max(500).required().messages({
            'string.min': 'Reason must be at least 10 characters',
            'string.max': 'Reason must not exceed 500 characters',
            'any.required': 'reason is required',
        }),
        holdUntil: joi_1.default.date().iso().optional().min('now').messages({
            'date.min': 'holdUntil must be a future date',
            'date.format': 'holdUntil must be a valid ISO date string',
        }),
    }),
    release: joi_1.default.object({
        reason: joi_1.default.string().trim().min(10).max(500).required().messages({
            'string.min': 'Release reason must be at least 10 characters',
            'string.max': 'Release reason must not exceed 500 characters',
            'any.required': 'Release reason is required',
        }),
    }),
    idParam: joi_1.default.object({
        id: joi_1.default.string().uuid().required().messages({
            'string.guid': 'Legal hold ID must be a valid UUID',
        }),
    }),
};
//# sourceMappingURL=legalHoldSchemas.js.map