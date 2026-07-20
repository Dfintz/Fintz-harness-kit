"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgSettingsAuditLogger = exports.OrgSettingsAuditLogger = exports.OrgSettingsAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var OrgSettingsAuditAction;
(function (OrgSettingsAuditAction) {
    OrgSettingsAuditAction["ORG_SETTINGS_UPDATED"] = "ORG_SETTINGS_UPDATED";
    OrgSettingsAuditAction["ORG_SECURITY_POLICY_CHANGED"] = "ORG_SECURITY_POLICY_CHANGED";
    OrgSettingsAuditAction["ORG_TIER_CHANGED"] = "ORG_TIER_CHANGED";
    OrgSettingsAuditAction["ORG_TRUST_SCORE_ADJUSTED"] = "ORG_TRUST_SCORE_ADJUSTED";
    OrgSettingsAuditAction["ORG_DEFAULT_SETTINGS_CHANGED"] = "ORG_DEFAULT_SETTINGS_CHANGED";
    OrgSettingsAuditAction["ORG_FEDERATION_SETTINGS_CHANGED"] = "ORG_FEDERATION_SETTINGS_CHANGED";
    OrgSettingsAuditAction["ORG_ARCHIVAL_POLICY_CHANGED"] = "ORG_ARCHIVAL_POLICY_CHANGED";
})(OrgSettingsAuditAction || (exports.OrgSettingsAuditAction = OrgSettingsAuditAction = {}));
class OrgSettingsAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            domainLabel: 'OrgSettings',
        });
    }
    static getInstance() {
        if (!OrgSettingsAuditLogger.instance) {
            OrgSettingsAuditLogger.instance = new OrgSettingsAuditLogger();
        }
        return OrgSettingsAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            OrgSettingsAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        switch (entry.action) {
            case OrgSettingsAuditAction.ORG_SETTINGS_UPDATED:
                return `Org settings updated: ${entry.settingKey} [${entry.previousValue} → ${entry.newValue}]`;
            case OrgSettingsAuditAction.ORG_SECURITY_POLICY_CHANGED:
                return `Org security policy changed: ${entry.reason || 'policy update'}`;
            case OrgSettingsAuditAction.ORG_TIER_CHANGED:
                return `Org tier changed: ${entry.previousValue} → ${entry.newValue}`;
            case OrgSettingsAuditAction.ORG_TRUST_SCORE_ADJUSTED:
                return `Org trust score adjusted: ${entry.previousValue} → ${entry.newValue}`;
            case OrgSettingsAuditAction.ORG_DEFAULT_SETTINGS_CHANGED:
                return `Org default settings changed: ${entry.settingKey}`;
            case OrgSettingsAuditAction.ORG_FEDERATION_SETTINGS_CHANGED:
                return `Org federation settings changed: ${entry.reason || 'federation update'}`;
            case OrgSettingsAuditAction.ORG_ARCHIVAL_POLICY_CHANGED:
                return `Org archival policy changed: ${entry.reason || 'archival update'}`;
            default:
                return `Org settings operation: ${entry.action}`;
        }
    }
    buildResource(entry) {
        return `org/${entry.organizationId}/settings`;
    }
    logSettingsUpdated(organizationId, settingKey, previousValue, newValue, changedById, changedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
            organizationId,
            settingCategory: 'defaults',
            settingKey,
            previousValue,
            newValue,
            performedById: changedById,
            performedByName: changedByName,
            details: { changedBy: changedById },
        });
    }
    logSecurityPolicyChanged(organizationId, policyName, reason, changedById, changedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_SECURITY_POLICY_CHANGED,
            organizationId,
            settingCategory: 'security',
            settingKey: policyName,
            reason,
            performedById: changedById,
            performedByName: changedByName,
            details: { policy: policyName },
        });
    }
    logTierChanged(organizationId, previousTier, newTier, changedById, changedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_TIER_CHANGED,
            organizationId,
            settingCategory: 'tier',
            previousValue: previousTier,
            newValue: newTier,
            performedById: changedById,
            performedByName: changedByName,
            details: {},
        });
    }
    logTrustScoreAdjusted(organizationId, previousScore, newScore, reason, adjustedById, adjustedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_TRUST_SCORE_ADJUSTED,
            organizationId,
            settingCategory: 'trust',
            previousValue: previousScore,
            newValue: newScore,
            reason,
            performedById: adjustedById,
            performedByName: adjustedByName,
            details: { reason },
        });
    }
    logDefaultSettingsChanged(organizationId, settingKey, newValue, changedById, changedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_DEFAULT_SETTINGS_CHANGED,
            organizationId,
            settingCategory: 'defaults',
            settingKey,
            newValue,
            performedById: changedById,
            performedByName: changedByName,
            details: { setting: settingKey },
        });
    }
    logFederationSettingsChanged(organizationId, reason, changedById, changedByName) {
        this.log({
            action: OrgSettingsAuditAction.ORG_FEDERATION_SETTINGS_CHANGED,
            organizationId,
            settingCategory: 'federation',
            reason,
            performedById: changedById,
            performedByName: changedByName,
            details: { reason },
        });
    }
}
exports.OrgSettingsAuditLogger = OrgSettingsAuditLogger;
exports.orgSettingsAuditLogger = OrgSettingsAuditLogger.getInstance();
//# sourceMappingURL=OrgSettingsAuditLogger.js.map