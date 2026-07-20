"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSearchSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.adminSearchSchemas = {
    securitySearch: joi_1.default.object({
        type: joi_1.default.string()
            .valid('login_success', 'login_failure', 'logout', 'password_change', 'password_reset', 'permission_granted', 'permission_denied', 'role_changed', 'data_accessed', 'data_modified', 'data_deleted', 'data_exported', 'brute_force_attempt', 'suspicious_activity', 'api_rate_limit_exceeded', 'invalid_token', 'admin_action', 'feature_flag_changed', 'configuration_changed')
            .optional()
            .messages({
            'any.only': 'Invalid security event type',
        }),
        severity: joi_1.default.string().valid('info', 'warning', 'critical').optional().messages({
            'any.only': 'Severity must be info, warning, or critical',
        }),
        userHash: joi_1.default.string().trim().max(256).optional(),
        organizationHash: joi_1.default.string().trim().max(256).optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional().messages({
            'date.min': 'endDate must be after startDate',
        }),
    }),
    userSearch: joi_1.default.object({
        query: joi_1.default.string().trim().max(200).optional(),
        role: joi_1.default.string().valid('admin', 'user', 'moderator', 'member', 'guest').optional(),
        status: joi_1.default.string().valid('active', 'disabled', 'suspended').optional(),
        ...(0, common_1.pageSizeKeysWith)(20),
        sortBy: joi_1.default.string().valid('username', 'email', 'createdAt', 'role').optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('asc'),
    }),
};
//# sourceMappingURL=adminSearchSchemas.js.map