"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceAuditLogger = exports.VoiceAuditLogger = exports.VoiceAuditAction = void 0;
const AuditService_1 = require("../../audit/AuditService");
const DomainAuditLogger_1 = require("../../shared/DomainAuditLogger");
var VoiceAuditAction;
(function (VoiceAuditAction) {
    VoiceAuditAction["CONFIG_CREATED"] = "VOICE_CONFIG_CREATED";
    VoiceAuditAction["CONFIG_UPDATED"] = "VOICE_CONFIG_UPDATED";
    VoiceAuditAction["CONFIG_DELETED"] = "VOICE_CONFIG_DELETED";
    VoiceAuditAction["ACCESS_GRANTED"] = "VOICE_ACCESS_GRANTED";
    VoiceAuditAction["ACCESS_DENIED"] = "VOICE_ACCESS_DENIED";
    VoiceAuditAction["SERVER_QUERIED"] = "VOICE_SERVER_QUERIED";
})(VoiceAuditAction || (exports.VoiceAuditAction = VoiceAuditAction = {}));
class VoiceAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.VOICE,
            domainLabel: 'Voice',
        });
    }
    static getInstance() {
        if (!VoiceAuditLogger.instance) {
            VoiceAuditLogger.instance = new VoiceAuditLogger();
        }
        return VoiceAuditLogger.instance;
    }
    buildMessage(entry) {
        const address = entry.serverAddress ? ` (${entry.serverAddress})` : '';
        return `Voice ${entry.action}: ${entry.entityType}/${entry.entityId}${address}`;
    }
    buildResource(entry) {
        return `voice/${entry.entityType}/${entry.entityId}`;
    }
    logConfigCreated(entityId, entityType, orgId, userId, serverType, host, port) {
        this.log({
            action: VoiceAuditAction.CONFIG_CREATED,
            entityId,
            entityType,
            organizationId: orgId,
            performedById: userId,
            serverType,
            serverAddress: `${host}:${port}`,
            details: { serverType, host, port },
        });
    }
    logConfigUpdated(entityId, entityType, orgId, userId, changes) {
        this.log({
            action: VoiceAuditAction.CONFIG_UPDATED,
            entityId,
            entityType,
            organizationId: orgId,
            performedById: userId,
            details: changes,
        });
    }
    logConfigDeleted(entityId, entityType, orgId, userId) {
        this.log({
            action: VoiceAuditAction.CONFIG_DELETED,
            entityId,
            entityType,
            organizationId: orgId,
            performedById: userId,
            details: {},
        });
    }
    logAccessDenied(entityId, entityType, orgId, userId, reason) {
        this.log({
            action: VoiceAuditAction.ACCESS_DENIED,
            entityId,
            entityType,
            organizationId: orgId,
            performedById: userId,
            details: { reason },
        });
    }
}
exports.VoiceAuditLogger = VoiceAuditLogger;
exports.voiceAuditLogger = VoiceAuditLogger.getInstance();
//# sourceMappingURL=VoiceAuditLogger.js.map