import { Invitation, InvitationStatus } from '../../models/Invitation';
export declare const INVITATION_TERMINAL_STATUSES: InvitationStatus[];
export declare class InvitationService {
    private readonly invitationRepository;
    private readonly organizationRepository;
    private readonly membershipRepository;
    private readonly userRepository;
    private readonly memberService;
    private readonly notificationService;
    constructor();
    invite(orgId: string, inviteeUserId: string, inviterId: string, inviterRole: string, message?: string): Promise<Invitation>;
    approveInvitation(invitationId: string, orgId: string, adminId: string): Promise<Invitation>;
    private notifyInviteeOfApproval;
    rejectInvitation(invitationId: string, orgId: string, adminId: string): Promise<Invitation>;
    private resolveTokenFromInviteCode;
    private getInviteCode;
    acceptByToken(token: string, userId: string): Promise<Invitation>;
    acceptByCode(code: string, userId: string): Promise<Invitation>;
    declineByToken(token: string, userId: string): Promise<Invitation>;
    declineByCode(code: string, userId: string): Promise<Invitation>;
    expireStale(): Promise<number>;
    getInvitationsForOrg(orgId: string, options?: {
        status?: InvitationStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: Record<string, unknown>[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getMyInvitations(userId: string): Promise<Record<string, unknown>[]>;
}
//# sourceMappingURL=InvitationService.d.ts.map