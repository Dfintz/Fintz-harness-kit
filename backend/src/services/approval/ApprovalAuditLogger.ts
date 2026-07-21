/**
 * Approval Domain Audit Logger
 * Tracks all approval requests, decisions, and workflow state changes
 * Extends DomainAuditLogger for consistent audit trail pattern
 *
 * COMPLIANCE: Governance and Approval Process Audit Trail (ZT-Governance)
 */

import { AuditCategory } from '../audit/AuditService';
import type { BaseDomainAuditEntry } from '../shared/DomainAuditLogger';
import { DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Approval audit action types
 * Tracks lifecycle of approval requests and decisions
 */
export enum ApprovalAuditAction {
  APPROVAL_REQUEST_SUBMITTED = 'APPROVAL_REQUEST_SUBMITTED',
  APPROVAL_APPROVED = 'APPROVAL_APPROVED',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  APPROVAL_DELEGATION_CREATED = 'APPROVAL_DELEGATION_CREATED',
  APPROVAL_ESCALATED = 'APPROVAL_ESCALATED',
  APPROVAL_CANCELLED = 'APPROVAL_CANCELLED',
}

/**
 * Approval audit log entry structure
 * Captures approval workflow details for governance compliance
 */
export interface ApprovalAuditEntry extends BaseDomainAuditEntry<ApprovalAuditAction> {
  // Request identifiers
  approvalRequestId: string;
  requestType?: string;

  // Parties involved
  requesterId?: string;
  requesterName?: string;
  approverId?: string;
  approverName?: string;
  delegatedToId?: string;
  delegatedToName?: string;

  // Request details
  subject?: string;
  reason?: string;

  // Additional context
  priority?: 'low' | 'normal' | 'high' | 'critical';
  details: Record<string, unknown>;
}

/**
 * Approval Domain Audit Logger Singleton
 * Provides typed audit logging for all approval operations
 *
 * USAGE:
 *   const logger = ApprovalAuditLogger.getInstance();
 *   logger.logApprovalSubmitted(...);
 *   logger.logApprovalApproved(...);
 */
export class ApprovalAuditLogger extends DomainAuditLogger<
  ApprovalAuditAction,
  ApprovalAuditEntry
> {
  private static instance: ApprovalAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.APPROVAL,
      domainLabel: 'Approval',
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ApprovalAuditLogger {
    if (!ApprovalAuditLogger.instance) {
      ApprovalAuditLogger.instance = new ApprovalAuditLogger();
    }
    return ApprovalAuditLogger.instance;
  }

  static resetInstance(): void {
    // simplify-debt: resetInstance() is replicated on all 14 audit loggers; TypeScript abstract classes
    // cannot access subclass static fields generically — no shared base solution is possible without
    // losing type safety on the singleton instance type.
    if (process.env.NODE_ENV === 'test') {
      ApprovalAuditLogger.instance = undefined as unknown as ApprovalAuditLogger;
    }
  }

  /**
   * Build human-readable audit message
   */
  protected buildMessage(entry: ApprovalAuditEntry): string {
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

  /**
   * Build audit resource identifier
   */
  protected buildResource(entry: ApprovalAuditEntry): string {
    return `approval/${entry.approvalRequestId}`;
  }

  // ============ Convenience Methods ============

  /**
   * Log approval request submitted
   */
  logApprovalSubmitted(
    approvalRequestId: string,
    requestType: string,
    subject: string,
    requesterId: string,
    requesterName: string,
    priority: 'low' | 'normal' | 'high' | 'critical',
    organizationId: string
  ): void {
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

  /**
   * Log approval approved
   */
  logApprovalApproved(
    approvalRequestId: string,
    subject: string,
    approverId: string,
    approverName: string,
    requesterId: string,
    organizationId: string
  ): void {
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

  /**
   * Log approval rejected
   */
  logApprovalRejected(
    approvalRequestId: string,
    subject: string,
    approverId: string,
    approverName: string,
    requesterId: string,
    reason: string,
    organizationId: string
  ): void {
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

  /**
   * Log approval delegation
   */
  logApprovalDelegated(
    approvalRequestId: string,
    subject: string,
    approverId: string,
    approverName: string,
    delegatedToId: string,
    delegatedToName: string,
    organizationId: string
  ): void {
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

  /**
   * Log approval escalated
   */
  logApprovalEscalated(
    approvalRequestId: string,
    subject: string,
    escalatorId: string,
    escalatorName: string,
    reason: string,
    organizationId: string
  ): void {
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

  /**
   * Log approval cancelled
   */
  logApprovalCancelled(
    approvalRequestId: string,
    subject: string,
    cancelledById: string,
    cancelledByName: string,
    reason: string,
    organizationId: string
  ): void {
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

/**
 * Export singleton instance
 */
export const approvalAuditLogger = ApprovalAuditLogger.getInstance();
