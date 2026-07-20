"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const INCIDENT_TYPES = ['WARNING', 'TIMEOUT', 'LONG_TIMEOUT', 'KICK', 'BAN'];
const INCIDENT_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'];
exports.moderationSchemas = {
    createIncident: joi_1.default.object({
        guildId: joi_1.default.string().max(20).required(),
        guildName: joi_1.default.string().max(100).optional(),
        targetDiscordId: joi_1.default.string().max(20).required(),
        targetUsername: joi_1.default.string().max(100).optional(),
        incidentType: joi_1.default.string()
            .valid(...INCIDENT_TYPES)
            .required(),
        reason: joi_1.default.string().max(2000).optional(),
        durationMinutes: joi_1.default.number().integer().min(1).max(40320).optional(),
        isShared: joi_1.default.boolean().optional(),
        metadata: joi_1.default.object().optional(),
    }),
    updateIncident: joi_1.default.object({
        reason: joi_1.default.string().max(2000).optional(),
        isShared: joi_1.default.boolean().optional(),
        metadata: joi_1.default.object().optional(),
    }),
    revokeIncident: joi_1.default.object({
        reason: joi_1.default.string().max(2000).optional(),
    }),
    searchQuery: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
        targetDiscordId: joi_1.default.string().max(20).optional(),
        guildId: joi_1.default.string().max(20).optional(),
        incidentType: joi_1.default.string()
            .valid(...INCIDENT_TYPES)
            .optional(),
        severity: joi_1.default.number().integer().min(1).max(5).optional(),
        status: joi_1.default.string()
            .valid(...INCIDENT_STATUSES)
            .optional(),
        minSeverity: joi_1.default.number().integer().min(1).max(5).optional(),
        isShared: joi_1.default.string().valid('true', 'false').optional(),
        searchTerm: joi_1.default.string().max(200).optional(),
        sortBy: joi_1.default.string().valid('createdAt', 'severity', 'incidentType', 'status').optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
    updateSharingConfig: joi_1.default.object({
        shareWarnings: joi_1.default.boolean().optional(),
        shareTimeouts: joi_1.default.boolean().optional(),
        shareKicks: joi_1.default.boolean().optional(),
        shareBans: joi_1.default.boolean().optional(),
        receiveAlerts: joi_1.default.boolean().optional(),
        minAlertSeverity: joi_1.default.number().integer().min(1).max(5).optional(),
        alertChannelId: joi_1.default.string().max(20).allow(null).optional(),
        autoShareWithAllies: joi_1.default.boolean().optional(),
        autoShareMinSeverity: joi_1.default.number().integer().min(1).max(5).optional(),
    }),
};
//# sourceMappingURL=moderationSchemas.js.map