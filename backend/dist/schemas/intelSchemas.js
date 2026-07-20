"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const intelClassification = joi_1.default.string().valid('public', 'restricted', 'confidential', 'secret', 'top_secret');
const intelCategory = joi_1.default.string().valid('strategic', 'tactical', 'personnel', 'enemy', 'alliance', 'economic', 'technical', 'other');
const intelOfficerRank = joi_1.default.string().valid('junior', 'officer', 'senior', 'lead', 'chief');
const intelAccessLevel = joi_1.default.string().valid('read', 'write', 'edit', 'delete', 'admin');
const intelSharePermission = joi_1.default.string().valid('view', 'comment', 'contribute', 'full');
const intelShareStatus = joi_1.default.string().valid('pending', 'active', 'revoked', 'declined', 'expired');
const intelAuditAction = joi_1.default.string().valid('entry_created', 'entry_viewed', 'entry_updated', 'entry_deleted', 'entry_archived', 'entry_restored', 'officer_appointed', 'officer_promoted', 'officer_demoted', 'officer_removed', 'officer_access_changed', 'access_granted', 'access_denied', 'unauthorized_attempt', 'vault_accessed', 'export_performed', 'bulk_operation');
exports.intelSchemas = {
    createEntry: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        content: joi_1.default.string().trim().min(1).max(50000).required(),
        classification: intelClassification.required(),
        category: intelCategory.required(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        eventDate: joi_1.default.date().iso().optional(),
        metadata: joi_1.default.object({
            attachments: joi_1.default.array().items(joi_1.default.string()).max(10).optional(),
            relatedEntries: joi_1.default.array().items(joi_1.default.string()).max(20).optional(),
            sources: joi_1.default.array().items(joi_1.default.string()).max(10).optional(),
            reliability: joi_1.default.number().min(1).max(5).optional(),
            urgency: joi_1.default.string().valid('low', 'medium', 'high', 'critical').optional(),
            expirationDate: joi_1.default.date().iso().optional(),
            customFields: joi_1.default.object().optional(),
        }).optional(),
    }),
    updateEntry: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        content: joi_1.default.string().trim().min(1).max(50000).optional(),
        classification: intelClassification.optional(),
        category: intelCategory.optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        eventDate: joi_1.default.date().iso().optional(),
        isArchived: joi_1.default.boolean().optional(),
        metadata: joi_1.default.object({
            attachments: joi_1.default.array().items(joi_1.default.string()).max(10).optional(),
            relatedEntries: joi_1.default.array().items(joi_1.default.string()).max(20).optional(),
            sources: joi_1.default.array().items(joi_1.default.string()).max(10).optional(),
            reliability: joi_1.default.number().min(1).max(5).optional(),
            urgency: joi_1.default.string().valid('low', 'medium', 'high', 'critical').optional(),
            expirationDate: joi_1.default.date().iso().optional(),
            customFields: joi_1.default.object().optional(),
        }).optional(),
    }),
    queryEntries: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
        offset: joi_1.default.number().integer().min(0).optional(),
        includeArchived: joi_1.default.string().valid('true', 'false').optional(),
        classification: intelClassification.optional(),
        category: intelCategory.optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    }),
    appointOfficer: joi_1.default.object({
        userId: common_1.id,
        rank: intelOfficerRank.required(),
        accessLevel: intelAccessLevel.required(),
        specializations: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    updateOfficer: joi_1.default.object({
        rank: intelOfficerRank.optional(),
        accessLevel: intelAccessLevel.optional(),
        specializations: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
    queryOfficers: joi_1.default.object({
        includeInactive: joi_1.default.string().valid('true', 'false').optional(),
        rank: intelOfficerRank.optional(),
    }),
    removeOfficer: joi_1.default.object({
        reason: joi_1.default.string().trim().max(500).optional(),
    }),
    createShare: joi_1.default.object({
        targetOrganizationId: common_1.id,
        permission: intelSharePermission.required(),
        maxClassification: intelClassification.optional(),
        shareReason: joi_1.default.string().trim().max(2000).optional(),
        expiresAt: joi_1.default.date().iso().optional(),
        metadata: joi_1.default.object({
            allianceId: common_1.optionalId,
            treatyId: common_1.optionalId,
            conditions: joi_1.default.array().items(joi_1.default.string().trim().max(200)).max(20).optional(),
            restrictedSections: joi_1.default.array().items(joi_1.default.string().trim().max(200)).max(50).optional(),
            notes: joi_1.default.string().trim().max(2000).optional(),
        }).optional(),
    }),
    shareResponse: joi_1.default.object({
        reason: joi_1.default.string().trim().max(2000).optional(),
    }),
    queryShares: joi_1.default.object({
        status: intelShareStatus.optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
        offset: joi_1.default.number().integer().min(0).optional(),
    }),
    queryAuditLogs: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
        offset: joi_1.default.number().integer().min(0).optional(),
        intelEntryId: common_1.optionalId,
        action: intelAuditAction.optional(),
        userId: common_1.optionalId,
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
    }),
    entryIdParam: joi_1.default.object({
        orgId: common_1.id,
        entryId: common_1.id,
    }),
    officerIdParam: joi_1.default.object({
        orgId: common_1.id,
        officerId: common_1.id,
    }),
    shareIdParam: joi_1.default.object({
        orgId: common_1.id,
        shareId: common_1.id,
    }),
    orgIdParam: joi_1.default.object({
        orgId: common_1.id,
    }),
};
//# sourceMappingURL=intelSchemas.js.map