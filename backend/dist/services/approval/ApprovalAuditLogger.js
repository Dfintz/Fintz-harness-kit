"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalAuditLogger = exports.ApprovalAuditLogger = exports.ApprovalAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var ApprovalAuditAction;
(function (ApprovalAuditAction) {
    ApprovalAuditAction["APPROVAL_REQUEST_SUBMITTED"] = "APPROVAL_REQUEST_SUBMITTED";
    ApprovalAuditAction["APPROVAL_APPROVED"] = "APPROVAL_APPROVED";
    ApprovalAuditAction["APPROVAL_REJECTED"] = "APPROVAL_REJECTED";
    ApprovalAuditAction["APPROVAL_DELEGATION_CREATED"] = "APPROVAL_DELEGATION_CREATED";
    ApprovalAuditAction["APPROVAL_ESCALATED"] = "APPROVAL_ESCALATED";
    ApprovalAuditAction["APPROVAL_CANCELLED"] = "APPROVAL_CANCELLED";
})(ApprovalAuditAction || (exports.ApprovalAuditAction = ApprovalAuditAction = {}));
class ApprovalAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.APPROVAL,
            domainLabel: 'Approval',
        });
    }
    static getInstance() {
        if (!ApprovalAuditLogger.instance) {
            ApprovalAuditLogger.instance = new ApprovalAuditLogger();
        }
        return ApprovalAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            ApprovalAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        const requester = entry.requesterName
            ? `${entry.requesterName} (${entry.requesterId})`
            : entry.requesterId;
        const approver = entry.approverName
            ? `${entry.approverName} (${entry.approverId})`
            : entry.approverId;
        switch (entry.action) {
            case ApprovalAuditAction.APPROVAL_REQUEST_SUBMITTED:
                return `Approval request submitted: ${entry.subject} by ${requester} [Priority: ${entry.priority || 'normal'}]`;
            case ApprovalAuditAction.APPROVAL_APPROVED:
                return `Approval approved: ${entry.subject} by ${approver}`;
            case ApprovalAuditAction.APPROVAL_REJECTED:
                return `Approval rejected: ${entry.subject} by ${approver} - ${entry.reason || 'no reason given'}`;
            case ApprovalAuditAction.APPROVAL_DELEGATION_CREATED:
                return `Approval delegated: ${entry.subject} from ${approver} to ${entry.delegatedToName || entry.delegatedToId}`;
            case ApprovalAuditAction.APPROVAL_ESCALATED:
                return `Approval escalated: ${entry.subject} - ${entry.reason || 'escalation required'}`;
            case ApprovalAuditAction.APPROVAL_CANCELLED:
                return `Approval cancelled: ${entry.subject} - ${entry.reason || 'cancelled by requester'}`;
            default:
                return `Approval operation: ${entry.action}`;
        }
    }
    buildResource(entry) {
        return `approval/${entry.approvalRequestId}`;
    }
    logApprovalSubmitted(approvalRequestId, requestType, subject, requesterId, requesterName, priority, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_REQUEST_SUBMITTED,
            approvalRequestId,
            requestType,
            subject,
            requesterId,
            requesterName,
            priority,
            organizationId,
            performedById: requesterId,
            details: { requestType, priority },
        });
    }
    logApprovalApproved(approvalRequestId, subject, approverId, approverName, requesterId, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_APPROVED,
            approvalRequestId,
            subject,
            approverId,
            approverName,
            requesterId,
            organizationId,
            performedById: approverId,
            details: {},
        });
    }
    logApprovalRejected(approvalRequestId, subject, approverId, approverName, requesterId, reason, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_REJECTED,
            approvalRequestId,
            subject,
            approverId,
            approverName,
            requesterId,
            reason,
            organizationId,
            performedById: approverId,
            details: { reason },
        });
    }
    logApprovalDelegated(approvalRequestId, subject, approverId, approverName, delegatedToId, delegatedToName, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_DELEGATION_CREATED,
            approvalRequestId,
            subject,
            approverId,
            approverName,
            delegatedToId,
            delegatedToName,
            organizationId,
            performedById: approverId,
            details: { delegatedTo: delegatedToId },
        });
    }
    logApprovalEscalated(approvalRequestId, subject, escalatorId, escalatorName, reason, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_ESCALATED,
            approvalRequestId,
            subject,
            approverId: escalatorId,
            approverName: escalatorName,
            reason,
            organizationId,
            performedById: escalatorId,
            details: { reason },
        });
    }
    logApprovalCancelled(approvalRequestId, subject, cancelledById, cancelledByName, reason, organizationId) {
        this.log({
            action: ApprovalAuditAction.APPROVAL_CANCELLED,
            approvalRequestId,
            subject,
            approverId: cancelledById,
            approverName: cancelledByName,
            reason,
            organizationId,
            performedById: cancelledById,
            details: { reason, cancelledBy: cancelledById },
        });
    }
}
exports.ApprovalAuditLogger = ApprovalAuditLogger;
exports.approvalAuditLogger = ApprovalAuditLogger.getInstance();
//# sourceMappingURL=ApprovalAuditLogger.js.map