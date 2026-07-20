import type { MembershipInboxResponse } from '@sc-fleet-manager/shared-types';
export declare class MembershipIntakeService {
    private readonly orgApplicationService;
    private readonly invitationService;
    private readonly recruitmentService;
    private readonly permissionService;
    constructor();
    getInbox(userId: string, organizationId: string): Promise<MembershipInboxResponse>;
    private resolvePermissions;
    private collectApplications;
    private collectInvitations;
    private collectRecruitmentApplicants;
}
//# sourceMappingURL=MembershipIntakeService.d.ts.map