"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diplomacyAuditLogger = exports.DiplomacyAuditLogger = exports.DiplomacyAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var DiplomacyAuditAction;
(function (DiplomacyAuditAction) {
    DiplomacyAuditAction["DIPLOMACY_PROPOSED"] = "DIPLOMACY_PROPOSED";
    DiplomacyAuditAction["DIPLOMACY_APPROVED"] = "DIPLOMACY_APPROVED";
    DiplomacyAuditAction["DIPLOMACY_SUSPENDED"] = "DIPLOMACY_SUSPENDED";
    DiplomacyAuditAction["DIPLOMACY_TERMINATED"] = "DIPLOMACY_TERMINATED";
    DiplomacyAuditAction["INCIDENT_REPORTED"] = "INCIDENT_REPORTED";
    DiplomacyAuditAction["INCIDENT_RESOLVED"] = "INCIDENT_RESOLVED";
})(DiplomacyAuditAction || (exports.DiplomacyAuditAction = DiplomacyAuditAction = {}));
class DiplomacyAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.DIPLOMACY,
            domainLabel: 'Diplomacy',
        });
    }
    static getInstance() {
        if (!DiplomacyAuditLogger.instance) {
            DiplomacyAuditLogger.instance = new DiplomacyAuditLogger();
        }
        return DiplomacyAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            DiplomacyAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Diplomacy ${entry.action}: ${entry.orgId1} <-> ${entry.orgId2}`;
    }
    buildResource(entry) {
        return `diplomacy/${entry.diplomacyId}`;
    }
    logProposed(diplomacyId, orgId1, orgId2, allianceType, proposedById, proposedByName) {
        this.log({
            action: DiplomacyAuditAction.DIPLOMACY_PROPOSED,
            diplomacyId,
            orgId1,
            orgId2,
            allianceType,
            organizationId: orgId1,
            performedById: proposedById,
            performedByName: proposedByName,
            details: { allianceType, targetOrgId: orgId2 },
        });
    }
    logApproved(diplomacyId, orgId1, orgId2, approvedById, approvedByName) {
        this.log({
            action: DiplomacyAuditAction.DIPLOMACY_APPROVED,
            diplomacyId,
            orgId1,
            orgId2,
            organizationId: orgId2,
            performedById: approvedById,
            performedByName: approvedByName,
            details: { proposingOrgId: orgId1 },
        });
    }
    logSuspended(diplomacyId, orgId1, orgId2, suspendedByOrgId, performedById) {
        this.log({
            action: DiplomacyAuditAction.DIPLOMACY_SUSPENDED,
            diplomacyId,
            orgId1,
            orgId2,
            organizationId: suspendedByOrgId,
            performedById,
            details: {},
        });
    }
    logTerminated(diplomacyId, orgId1, orgId2, terminatedByOrgId, performedById) {
        this.log({
            action: DiplomacyAuditAction.DIPLOMACY_TERMINATED,
            diplomacyId,
            orgId1,
            orgId2,
            organizationId: terminatedByOrgId,
            performedById,
            details: {},
        });
    }
    logIncidentReported(diplomacyId, orgId1, orgId2, incidentId, severity, reportedById) {
        this.log({
            action: DiplomacyAuditAction.INCIDENT_REPORTED,
            diplomacyId,
            orgId1,
            orgId2,
            organizationId: orgId1,
            performedById: reportedById,
            details: { incidentId, severity },
        });
    }
    logIncidentResolved(diplomacyId, orgId1, orgId2, incidentId, resolvedByOrgId, performedById) {
        this.log({
            action: DiplomacyAuditAction.INCIDENT_RESOLVED,
            diplomacyId,
            orgId1,
            orgId2,
            organizationId: resolvedByOrgId,
            performedById,
            details: { incidentId },
        });
    }
}
exports.DiplomacyAuditLogger = DiplomacyAuditLogger;
exports.diplomacyAuditLogger = DiplomacyAuditLogger.getInstance();
//# sourceMappingURL=DiplomacyAuditLogger.js.map