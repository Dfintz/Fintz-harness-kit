"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.membershipAuditLogger = exports.MembershipAuditLogger = exports.MembershipAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var MembershipAuditAction;
(function (MembershipAuditAction) {
    MembershipAuditAction["INTAKE_VIEWED"] = "INTAKE_VIEWED";
    MembershipAuditAction["APPLICATION_APPROVED"] = "APPLICATION_APPROVED";
    MembershipAuditAction["APPLICATION_REJECTED"] = "APPLICATION_REJECTED";
    MembershipAuditAction["INVITATION_SENT"] = "INVITATION_SENT";
    MembershipAuditAction["INVITATION_APPROVED"] = "INVITATION_APPROVED";
    MembershipAuditAction["INVITATION_REJECTED"] = "INVITATION_REJECTED";
    MembershipAuditAction["INVITATION_ACCEPTED"] = "INVITATION_ACCEPTED";
    MembershipAuditAction["INVITATION_DECLINED"] = "INVITATION_DECLINED";
})(MembershipAuditAction || (exports.MembershipAuditAction = MembershipAuditAction = {}));
class MembershipAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.MEMBERSHIP,
            domainLabel: 'Membership',
        });
    }
    static getInstance() {
        const existing = MembershipAuditLogger.instance;
        if (existing) {
            return existing;
        }
        const created = new MembershipAuditLogger();
        MembershipAuditLogger.instance = created;
        return created;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            MembershipAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        if (entry.action === MembershipAuditAction.INTAKE_VIEWED) {
            return `Membership INTAKE_VIEWED: ${entry.itemCount ?? 0} pending item(s) for org ${entry.organizationId}`;
        }
        const subject = entry.subjectUserId ? ` (subject ${entry.subjectUserId})` : '';
        return `Membership ${entry.action}: ${entry.resourceId ?? 'unknown'}${subject}`;
    }
    buildResource(entry) {
        return entry.resourceId
            ? `organization/${entry.organizationId}/membership/${entry.resourceId}`
            : `organization/${entry.organizationId}/membership-intake`;
    }
    logIntakeViewed(organizationId, itemCount, performedById, performedByName) {
        this.log({
            action: MembershipAuditAction.INTAKE_VIEWED,
            itemCount,
            organizationId,
            performedById,
            performedByName,
            details: { itemCount },
        });
    }
    logApplicationReviewed(applicationId, applicantUserId, organizationId, reviewerId, decision) {
        this.log({
            action: decision === 'approved'
                ? MembershipAuditAction.APPLICATION_APPROVED
                : MembershipAuditAction.APPLICATION_REJECTED,
            organizationId,
            resourceId: applicationId,
            subjectUserId: applicantUserId,
            performedById: reviewerId,
            details: { applicationId, applicantUserId, decision },
        });
    }
    logInvitationEvent(action, invitationId, inviteeUserId, organizationId, performedById) {
        this.log({
            action,
            organizationId,
            resourceId: invitationId,
            subjectUserId: inviteeUserId,
            performedById,
            details: { invitationId, inviteeUserId },
        });
    }
}
exports.MembershipAuditLogger = MembershipAuditLogger;
exports.membershipAuditLogger = MembershipAuditLogger.getInstance();
//# sourceMappingURL=MembershipAuditLogger.js.map