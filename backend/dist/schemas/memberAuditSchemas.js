"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberAuditSchemas = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.memberAuditSchemas = {
    orgIdParam: joi_1.default.object({ orgId: common_1.id }),
    flagIdParam: joi_1.default.object({ orgId: common_1.id, flagId: common_1.id }),
    entryIdParam: joi_1.default.object({ orgId: common_1.id, entryId: common_1.id }),
    userIdParam: joi_1.default.object({ orgId: common_1.id, userId: common_1.id }),
    createManualFlag: joi_1.default.object({
        userId: common_1.uuid.required(),
        severity: joi_1.default.string()
            .valid(...Object.values(shared_types_1.FlagSeverity))
            .required(),
        description: joi_1.default.string().trim().min(3).max(2000).required(),
        metadata: joi_1.default.object().optional(),
    }),
    resolveFlag: joi_1.default.object({
        status: joi_1.default.string()
            .valid(shared_types_1.FlagStatus.RESOLVED, shared_types_1.FlagStatus.DISMISSED, shared_types_1.FlagStatus.ESCALATED)
            .required(),
        resolutionNote: joi_1.default.string().trim().min(1).max(2000).required(),
    }),
    listFlagsQuery: joi_1.default.object({
        userId: joi_1.default.string().trim().max(100).optional(),
        flagTypes: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...Object.values(shared_types_1.MemberFlagType))), joi_1.default.string().valid(...Object.values(shared_types_1.MemberFlagType)))
            .optional(),
        severities: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...Object.values(shared_types_1.FlagSeverity))), joi_1.default.string().valid(...Object.values(shared_types_1.FlagSeverity)))
            .optional(),
        statuses: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...Object.values(shared_types_1.FlagStatus))), joi_1.default.string().valid(...Object.values(shared_types_1.FlagStatus)))
            .optional(),
        dateFrom: joi_1.default.date().iso().optional(),
        dateTo: joi_1.default.date().iso().optional(),
        ...(0, common_1.pageSizeKeysWith)(25),
        sortBy: joi_1.default.string().valid('createdAt', 'severity', 'flagType', 'status').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    createWatchlistEntry: joi_1.default.object({
        rsiHandle: joi_1.default.string().trim().min(1).max(100).required(),
        citizenName: joi_1.default.string().trim().min(1).max(255).required(),
        reason: joi_1.default.string()
            .valid(...Object.values(shared_types_1.WatchlistReason))
            .required(),
        threatLevel: joi_1.default.string()
            .valid(...Object.values(shared_types_1.WatchlistThreatLevel))
            .required(),
        notes: joi_1.default.string().trim().max(2000).optional().allow(''),
    }),
    updateWatchlistEntry: joi_1.default.object({
        reason: joi_1.default.string()
            .valid(...Object.values(shared_types_1.WatchlistReason))
            .optional(),
        threatLevel: joi_1.default.string()
            .valid(...Object.values(shared_types_1.WatchlistThreatLevel))
            .optional(),
        notes: joi_1.default.string().trim().max(2000).optional().allow(''),
        citizenName: joi_1.default.string().trim().min(1).max(255).optional(),
    }),
    listWatchlistQuery: joi_1.default.object({
        reasons: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...Object.values(shared_types_1.WatchlistReason))), joi_1.default.string().valid(...Object.values(shared_types_1.WatchlistReason)))
            .optional(),
        threatLevels: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...Object.values(shared_types_1.WatchlistThreatLevel))), joi_1.default.string().valid(...Object.values(shared_types_1.WatchlistThreatLevel)))
            .optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        ...(0, common_1.pageSizeKeysWith)(25),
        sortBy: joi_1.default.string()
            .valid('createdAt', 'citizenName', 'threatLevel', 'reason')
            .default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
};
//# sourceMappingURL=memberAuditSchemas.js.map