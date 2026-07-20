import type { BaseDomainAuditEntry } from '../shared/DomainAuditLogger';
import { DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum ApprovalAuditAction {
    APPROVAL_REQUEST_SUBMITTED = "APPROVAL_REQUEST_SUBMITTED",
    APPROVAL_APPROVED = "APPROVAL_APPROVED",
    APPROVAL_REJECTED = "APPROVAL_REJECTED",
    APPROVAL_DELEGATION_CREATED = "APPROVAL_DELEGATION_CREATED",
    APPROVAL_ESCALATED = "APPROVAL_ESCALATED",
    APPROVAL_CANCELLED = "APPROVAL_CANCELLED"
}
export interface ApprovalAuditEntry extends BaseDomainAuditEntry<ApprovalAuditAction> {
    approvalRequestId: string;
    requestType?: string;
    requesterId?: string;
    requesterName?: string;
    approverId?: string;
    approverName?: string;
    delegatedToId?: string;
    delegatedToName?: string;
    subject?: string;
    reason?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    details: Record<string, unknown>;
}
export declare class ApprovalAuditLogger extends DomainAuditLogger<ApprovalAuditAction, ApprovalAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): ApprovalAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: ApprovalAuditEntry): string;
    protected buildResource(entry: ApprovalAuditEntry): string;
    logApprovalSubmitted(approvalRequestId: string, requestType: string, subject: string, requesterId: string, requesterName: string, priority: 'low' | 'normal' | 'high' | 'critical', organizationId: string): void;
    logApprovalApproved(approvalRequestId: string, subject: string, approverId: string, approverName: string, requesterId: string, organizationId: string): void;
    logApprovalRejected(approvalRequestId: string, subject: string, approverId: string, approverName: string, requesterId: string, reason: string, organizationId: string): void;
    logApprovalDelegated(approvalRequestId: string, subject: string, approverId: string, approverName: string, delegatedToId: string, delegatedToName: string, organizationId: string): void;
    logApprovalEscalated(approvalRequestId: string, subject: string, escalatorId: string, escalatorName: string, reason: string, organizationId: string): void;
    logApprovalCancelled(approvalRequestId: string, subject: string, cancelledById: string, cancelledByName: string, reason: string, organizationId: string): void;
}
export declare const approvalAuditLogger: ApprovalAuditLogger;
//# sourceMappingURL=ApprovalAuditLogger.d.ts.map