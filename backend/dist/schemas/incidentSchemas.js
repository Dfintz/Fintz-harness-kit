"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paramSchemas = exports.incidentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.incidentSchemas = {
    reportBreach: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required()
            .messages({
            'string.empty': 'Title is required',
            'string.min': 'Title must be at least 3 characters',
            'string.max': 'Title must not exceed 200 characters'
        }),
        description: joi_1.default.string().trim().min(10).max(5000).required()
            .messages({
            'string.empty': 'Description is required',
            'string.min': 'Description must be at least 10 characters',
            'string.max': 'Description must not exceed 5000 characters'
        }),
        severity: joi_1.default.string().valid('critical', 'high', 'medium', 'low').required()
            .messages({
            'any.only': 'Severity must be one of: critical, high, medium, low',
            'any.required': 'Severity is required'
        }),
        affectedUsers: joi_1.default.array().items(joi_1.default.string().trim()).default([])
            .messages({
            'array.base': 'Affected users must be an array of user IDs'
        }),
        affectedDataTypes: joi_1.default.array().items(joi_1.default.string().trim()).min(1).required()
            .messages({
            'array.base': 'Affected data types must be an array',
            'array.min': 'At least one affected data type is required',
            'any.required': 'Affected data types are required'
        })
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED').required()
            .messages({
            'any.only': 'Status must be one of: INVESTIGATING, CONTAINED, NOTIFIED, RESOLVED',
            'any.required': 'Status is required'
        })
    }),
    addRemediationStep: joi_1.default.object({
        step: joi_1.default.string().trim().min(5).max(1000).required()
            .messages({
            'string.empty': 'Remediation step is required',
            'string.min': 'Remediation step must be at least 5 characters',
            'string.max': 'Remediation step must not exceed 1000 characters',
            'any.required': 'Remediation step is required'
        })
    }),
    addRecommendation: joi_1.default.object({
        recommendation: joi_1.default.string().trim().min(5).max(1000).required()
            .messages({
            'string.empty': 'Recommendation is required',
            'string.min': 'Recommendation must be at least 5 characters',
            'string.max': 'Recommendation must not exceed 1000 characters',
            'any.required': 'Recommendation is required'
        })
    })
};
exports.paramSchemas = {
    incidentId: joi_1.default.object({
        id: joi_1.default.string().uuid().required()
            .messages({
            'string.guid': 'Invalid incident ID format',
            'any.required': 'Incident ID is required'
        })
    })
};
//# sourceMappingURL=incidentSchemas.js.map