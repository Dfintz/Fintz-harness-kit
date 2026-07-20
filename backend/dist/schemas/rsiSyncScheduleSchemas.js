"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiSyncScheduleSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.rsiSyncScheduleSchemas = {
    upsertSchedule: joi_1.default.object({
        rsiOrgSid: joi_1.default.string()
            .required()
            .min(1)
            .max(50)
            .pattern(/^[A-Za-z0-9_-]+$/)
            .messages({
            'string.pattern.base': 'RSI Organization SID must contain only alphanumeric characters, underscores, and hyphens',
            'any.required': 'RSI Organization SID is required',
        }),
        guildId: joi_1.default.string()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null)
            .messages({
            'string.pattern.base': 'Guild ID must be a valid Discord snowflake ID',
        }),
        isEnabled: joi_1.default.boolean().optional().default(false),
        intervalMinutes: joi_1.default.number().integer().valid(360, 720, 1440).optional().default(360).messages({
            'any.only': 'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)',
        }),
        notifyOnChanges: joi_1.default.boolean().optional().default(true),
        notifyOnErrors: joi_1.default.boolean().optional().default(true),
        notificationChannelId: joi_1.default.string()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null)
            .messages({
            'string.pattern.base': 'Notification channel ID must be a valid Discord snowflake ID',
        }),
        removeRolesOnLeave: joi_1.default.boolean().optional().default(true),
        affiliateHandling: joi_1.default.string()
            .valid('include', 'exclude', 'special_role')
            .optional()
            .default('include')
            .messages({
            'any.only': 'Affiliate handling must be one of: include, exclude, special_role',
        }),
        affiliateRoleId: joi_1.default.string()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null)
            .messages({
            'string.pattern.base': 'Affiliate role ID must be a valid Discord snowflake ID',
        }),
        maxConsecutiveFailures: joi_1.default.number().integer().min(1).max(20).optional().default(5).messages({
            'number.min': 'Max consecutive failures must be at least 1',
            'number.max': 'Max consecutive failures cannot exceed 20',
        }),
    }),
    updateInterval: joi_1.default.object({
        intervalMinutes: joi_1.default.number().integer().valid(360, 720, 1440).required().messages({
            'any.only': 'Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)',
            'any.required': 'Interval is required',
        }),
    }),
    auditLogQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(100).optional().default(20),
        offset: joi_1.default.number().integer().min(0).optional().default(0),
        syncType: joi_1.default.string().valid('manual', 'scheduled', 'webhook').optional(),
        hasErrors: joi_1.default.boolean().optional(),
        fromDate: joi_1.default.date().iso().optional(),
        toDate: joi_1.default.date().iso().optional(),
    }),
    resolveReview: joi_1.default.object({
        linkId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'linkId must be a valid UUID',
            'any.required': 'linkId is required',
        }),
        resolution: joi_1.default.string()
            .valid('approved', 'rejected', 'resynced', 'removed')
            .required()
            .messages({
            'any.only': 'resolution must be one of: approved, rejected, resynced, removed',
            'any.required': 'resolution is required',
        }),
        adminNotes: joi_1.default.string().max(500).optional().allow(''),
        updatedRank: joi_1.default.string().max(50).optional().allow(''),
    }),
    flagForReview: joi_1.default.object({
        linkId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'linkId must be a valid UUID',
            'any.required': 'linkId is required',
        }),
        reason: joi_1.default.string().max(100).required().messages({
            'any.required': 'reason is required',
        }),
    }),
    manualAssign: joi_1.default.object({
        userId: joi_1.default.string().uuid().required().messages({
            'string.guid': 'userId must be a valid UUID',
            'any.required': 'userId is required',
        }),
        rsiHandle: joi_1.default.string().min(1).max(100).required().messages({
            'any.required': 'rsiHandle is required',
        }),
        discordUserId: joi_1.default.string()
            .pattern(/^\d{17,20}$/)
            .optional()
            .allow(null),
        rank: joi_1.default.string().max(50).optional(),
    }),
    bulkVerify: joi_1.default.object({
        linkIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(100).required().messages({
            'array.min': 'At least one linkId is required',
            'array.max': 'Maximum 100 links per bulk operation',
            'any.required': 'linkIds array is required',
        }),
    }),
    bulkAssign: joi_1.default.object({
        entries: joi_1.default.array()
            .items(joi_1.default.object({
            userId: joi_1.default.string().uuid().required(),
            rsiHandle: joi_1.default.string().min(1).max(100).required(),
            discordUserId: joi_1.default.string()
                .pattern(/^\d{17,20}$/)
                .optional()
                .allow(null),
        }))
            .min(1)
            .max(100)
            .required()
            .messages({
            'array.min': 'At least one entry is required',
            'array.max': 'Maximum 100 entries per bulk operation',
            'any.required': 'entries array is required',
        }),
    }),
};
//# sourceMappingURL=rsiSyncScheduleSchemas.js.map