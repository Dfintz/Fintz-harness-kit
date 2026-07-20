import { EntityManager } from 'typeorm';
import { ApprovalRequest } from '../../models/ApprovalRequest';
import { ApprovalAuditAction } from './ApprovalAuditLogger';
export { ApprovalAuditAction };
export declare class ApprovalService {
    private readonly approvalRepo;
    listApprovals(organizationId: string, filters?: {
        status?: string;
        type?: string;
        assignedTo?: string;
    }): Promise<{
        approvals: ApprovalRequest[];
        total: number;
    }>;
    getApproval(approvalId: string, organizationId: string): Promise<ApprovalRequest | null>;
    createApproval(organizationId: string, requestedBy: string, data: {
        type: string;
        title?: string;
        description?: string;
        resourceId?: string;
        resourceType?: string;
        assignedTo?: string;
        reason?: string;
        metadata?: Record<string, unknown>;
    }): Promise<ApprovalRequest>;
    approve(approvalId: string, organizationId: string, userId: string, comment?: string, manager?: EntityManager): Promise<ApprovalRequest>;
    reject(approvalId: string, organizationId: string, userId: string, reason?: string): Promise<ApprovalRequest>;
    delegate(approvalId: string, organizationId: string, delegatedBy: string, delegateTo: string): Promise<ApprovalRequest>;
    getPending(organizationId: string, userId: string): Promise<ApprovalRequest[]>;
    private addHistory;
}
//# sourceMappingURL=ApprovalService.d.ts.map