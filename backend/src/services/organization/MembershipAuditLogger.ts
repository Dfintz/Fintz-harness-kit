import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Membership audit event types — covers intake-queue access and the
 * member-acquisition decision transitions (applications + invitations) that
 * were previously unaudited.
 */
export enum MembershipAuditAction {
  /** An admin viewed the membership intake queue for an organization. */
  INTAKE_VIEWED = 'INTAKE_VIEWED',
  /** A pending org join application was approved (member added). */
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  /** A pending org join application was rejected. */
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  /** An invitation was sent to a user. */
  INVITATION_SENT = 'INVITATION_SENT',
  /** A member-initiated invitation was approved by an admin. */
  INVITATION_APPROVED = 'INVITATION_APPROVED',
  /** A member-initiated invitation was rejected by an admin. */
  INVITATION_REJECTED = 'INVITATION_REJECTED',
  /** An invitee accepted an invitation (member added). */
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  /** An invitee declined an invitation. */
  INVITATION_DECLINED = 'INVITATION_DECLINED',
}

/**
 * Membership audit log entry.
 */
export interface MembershipAuditEntry extends BaseDomainAuditEntry<MembershipAuditAction> {
  /** For INTAKE_VIEWED: number of pending items shown (counts only — never PII). */
  itemCount?: number;
  /** For transition events: the application or invitation id. */
  resourceId?: string;
  /** For transition events: the applicant or invitee user id. */
  subjectUserId?: string;
}

/**
 * MembershipAuditLogger
 *
 * Domain-specific audit logger for organization member-acquisition (intake)
 * operations. Establishes the MEMBERSHIP audit category so the previously
 * unaudited application/invitation/recruitment intake flows become traceable.
 * Singleton with circular buffer and AuditService delegation.
 */
export class MembershipAuditLogger extends DomainAuditLogger<
  MembershipAuditAction,
  MembershipAuditEntry
> {
  private static instance: MembershipAuditLogger | undefined;

  private constructor() {
    super({
      category: AuditCategory.MEMBERSHIP,
      domainLabel: 'Membership',
    });
  }

  static getInstance(): MembershipAuditLogger {
    const existing = MembershipAuditLogger.instance;
    if (existing) {
      return existing;
    }
    const created = new MembershipAuditLogger();
    MembershipAuditLogger.instance = created;
    return created;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      MembershipAuditLogger.instance = undefined;
    }
  }

  protected buildMessage(entry: MembershipAuditEntry): string {
    if (entry.action === MembershipAuditAction.INTAKE_VIEWED) {
      return `Membership INTAKE_VIEWED: ${entry.itemCount ?? 0} pending item(s) for org ${entry.organizationId}`;
    }
    const subject = entry.subjectUserId ? ` (subject ${entry.subjectUserId})` : '';
    return `Membership ${entry.action}: ${entry.resourceId ?? 'unknown'}${subject}`;
  }

  protected buildResource(entry: MembershipAuditEntry): string {
    return entry.resourceId
      ? `organization/${entry.organizationId}/membership/${entry.resourceId}`
      : `organization/${entry.organizationId}/membership-intake`;
  }

  // ── Convenience methods ─────────────────────────────────────────────

  /**
   * Record that an admin accessed the membership intake queue.
   * Logs counts only — never applicant/invitee PII.
   */
  logIntakeViewed(
    organizationId: string,
    itemCount: number,
    performedById: string,
    performedByName?: string
  ): void {
    this.log({
      action: MembershipAuditAction.INTAKE_VIEWED,
      itemCount,
      organizationId,
      performedById,
      performedByName,
      details: { itemCount },
    });
  }

  /**
   * Record an org join-application review decision (approved/rejected).
   */
  logApplicationReviewed(
    applicationId: string,
    applicantUserId: string,
    organizationId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected'
  ): void {
    this.log({
      action:
        decision === 'approved'
          ? MembershipAuditAction.APPLICATION_APPROVED
          : MembershipAuditAction.APPLICATION_REJECTED,
      organizationId,
      resourceId: applicationId,
      subjectUserId: applicantUserId,
      performedById: reviewerId,
      details: { applicationId, applicantUserId, decision },
    });
  }

  /**
   * Record an invitation lifecycle event. `performedById` is the actor: the
   * inviter for SENT, the admin for APPROVED/REJECTED, the invitee for
   * ACCEPTED/DECLINED.
   */
  logInvitationEvent(
    action:
      | MembershipAuditAction.INVITATION_SENT
      | MembershipAuditAction.INVITATION_APPROVED
      | MembershipAuditAction.INVITATION_REJECTED
      | MembershipAuditAction.INVITATION_ACCEPTED
      | MembershipAuditAction.INVITATION_DECLINED,
    invitationId: string,
    inviteeUserId: string,
    organizationId: string,
    performedById: string
  ): void {
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

export const membershipAuditLogger = MembershipAuditLogger.getInstance();

