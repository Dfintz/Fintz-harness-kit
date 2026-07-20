"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiVerificationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.rsiVerificationSchemas = {
    initiateVerification: joi_1.default.object({
        rsiHandle: joi_1.default.string()
            .trim()
            .min(3)
            .max(60)
            .pattern(/^[a-zA-Z0-9_-]+$/)
            .required()
            .messages({
            'string.empty': 'RSI handle is required',
            'string.min': 'RSI handle must be at least 3 characters',
            'string.max': 'RSI handle cannot exceed 60 characters',
            'string.pattern.base': 'RSI handle can only contain letters, numbers, underscores and hyphens',
            'any.required': 'RSI handle is required',
        }),
    }),
    initiateOrgVerification: joi_1.default.object({
        orgId: joi_1.default.string().trim().required().messages({
            'string.empty': 'Organization ID is required',
            'any.required': 'Organization ID is required',
        }),
        rsiOrgSid: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/i)
            .required()
            .messages({
            'string.empty': 'RSI organization SID is required',
            'string.min': 'RSI organization SID must be at least 1 character',
            'string.max': 'RSI organization SID cannot exceed 20 characters',
            'string.pattern.base': 'RSI organization SID can only contain letters, numbers, underscores and hyphens',
            'any.required': 'RSI organization SID is required',
        }),
    }),
    completeOrgVerification: joi_1.default.object({
        orgId: joi_1.default.string().trim().required().messages({
            'string.empty': 'Organization ID is required',
            'any.required': 'Organization ID is required',
        }),
    }),
    verifyOrgByRank: joi_1.default.object({
        orgId: joi_1.default.string().trim().required().messages({
            'string.empty': 'Organization ID is required',
            'any.required': 'Organization ID is required',
        }),
        rsiOrgSid: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/i)
            .required()
            .messages({
            'string.empty': 'RSI organization SID is required',
            'string.min': 'RSI organization SID must be at least 1 character',
            'string.max': 'RSI organization SID cannot exceed 20 characters',
            'string.pattern.base': 'RSI organization SID can only contain letters, numbers, underscores and hyphens',
            'any.required': 'RSI organization SID is required',
        }),
    }),
    verifyOrganization: joi_1.default.object({
        orgSid: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/i)
            .required()
            .messages({
            'string.empty': 'Organization SID is required',
            'string.min': 'Organization SID must be at least 1 character',
            'string.max': 'Organization SID cannot exceed 20 characters',
            'string.pattern.base': 'Organization SID can only contain letters, numbers, underscores and hyphens',
            'any.required': 'Organization SID is required',
        }),
    }),
    lookupUser: joi_1.default.object({
        handle: joi_1.default.string()
            .trim()
            .min(3)
            .max(60)
            .pattern(/^[a-zA-Z0-9_-]+$/)
            .required()
            .messages({
            'string.empty': 'RSI handle is required',
            'string.min': 'RSI handle must be at least 3 characters',
            'string.max': 'RSI handle cannot exceed 60 characters',
            'string.pattern.base': 'RSI handle can only contain letters, numbers, underscores and hyphens',
            'any.required': 'RSI handle is required',
        }),
    }),
    lookupOrganization: joi_1.default.object({
        sid: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .pattern(/^[A-Z0-9_-]+$/i)
            .required()
            .messages({
            'string.empty': 'Organization SID is required',
            'string.min': 'Organization SID must be at least 1 character',
            'string.max': 'Organization SID cannot exceed 20 characters',
            'string.pattern.base': 'Organization SID can only contain letters, numbers, underscores and hyphens',
            'any.required': 'Organization SID is required',
        }),
    }),
};
//# sourceMappingURL=rsiVerificationSchemas.js.map