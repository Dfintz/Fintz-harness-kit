"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gdprSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.gdprSchemas = {
    requestExport: joi_1.default.object({}),
    exportRequestQuery: joi_1.default.object({
        token: joi_1.default.string()
            .trim()
            .min(1)
            .when('$isDownload', {
            is: true,
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        })
            .messages({
            'string.empty': 'Download token is required',
            'any.required': 'Download token is required',
        }),
        limit: joi_1.default.number().integer().min(1).max(50).optional(),
    }),
    exportRequestId: joi_1.default.object({
        requestId: joi_1.default.string().uuid().required().messages({
            'string.empty': 'Export request ID is required',
            'string.guid': 'Invalid export request ID format',
            'any.required': 'Export request ID is required',
        }),
    }),
    adminRequestsQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
    }),
};
//# sourceMappingURL=gdprSchemas.js.map