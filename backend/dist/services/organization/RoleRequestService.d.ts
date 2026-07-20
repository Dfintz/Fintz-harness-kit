import { ApprovalRequest } from '../../models/ApprovalRequest';
export declare class RoleRequestService {
    private readonly approvalService;
    private readonly memberRoleAssignmentService;
    private readonly notificationService;
    private readonly membershipRepo;
    private readonly roleRepo;
    private assertApprover;
    private findEligibleApproverIds;
    requestRoleChange(organizationId: string, requesterId: string, roleId: string, reason?: string): Promise<ApprovalRequest>;
    approveRoleChange(organizationId: string, approvalId: string, approverId: string, comment?: string): Promise<ApprovalRequest>;
    rejectRoleChange(organizationId: string, approvalId: string, approverId: string, reason: string): Promise<ApprovalRequest>;
    listPendingForApprover(organizationId: string, approverId: string): Promise<ApprovalRequest[]>;
    private resolveRoleName;
    private runPostApprove;
    private notifyApprovers;
    private notifyRequester;
    private safeNotify;
}
//# sourceMappingURL=RoleRequestService.d.ts.map