import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum MembershipAuditAction {
    INTAKE_VIEWED = "INTAKE_VIEWED",
    APPLICATION_APPROVED = "APPLICATION_APPROVED",
    APPLICATION_REJECTED = "APPLICATION_REJECTED",
    INVITATION_SENT = "INVITATION_SENT",
    INVITATION_APPROVED = "INVITATION_APPROVED",
    INVITATION_REJECTED = "INVITATION_REJECTED",
    INVITATION_ACCEPTED = "INVITATION_ACCEPTED",
    INVITATION_DECLINED = "INVITATION_DECLINED"
}
export interface MembershipAuditEntry extends BaseDomainAuditEntry<MembershipAuditAction> {
    itemCount?: number;
    resourceId?: string;
    subjectUserId?: string;
}
export declare class MembershipAuditLogger extends DomainAuditLogger<MembershipAuditAction, MembershipAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): MembershipAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: MembershipAuditEntry): string;
    protected buildResource(entry: MembershipAuditEntry): string;
    logIntakeViewed(organizationId: string, itemCount: number, performedById: string, performedByName?: string): void;
    logApplicationReviewed(applicationId: string, applicantUserId: string, organizationId: string, reviewerId: string, decision: 'approved' | 'rejected'): void;
    logInvitationEvent(action: MembershipAuditAction.INVITATION_SENT | MembershipAuditAction.INVITATION_APPROVED | MembershipAuditAction.INVITATION_REJECTED | MembershipAuditAction.INVITATION_ACCEPTED | MembershipAuditAction.INVITATION_DECLINED, invitationId: string, inviteeUserId: string, organizationId: string, performedById: string): void;
}
export declare const membershipAuditLogger: MembershipAuditLogger;
//# sourceMappingURL=MembershipAuditLogger.d.ts.map