import { IntelApproval } from '../../models/IntelApproval';
import { IntelClassification } from '../../models/IntelEntry';
export interface TwoPersonApprovalConfig {
    requiredApprovals: number;
    expirationHours: number;
    allowSelfApproval: boolean;
    notifyOnPending: boolean;
    notifyOnComplete: boolean;
}
export declare class TwoPersonApprovalService {
    private readonly approvalRepo;
    private readonly intelEntryRepo;
    private readonly intelOfficerRepo;
    private readonly auditLogRepo;
    private readonly userOrgRepo;
    private readonly config;
    constructor(config?: Partial<TwoPersonApprovalConfig>);
    requiresTwoPersonApproval(classification: IntelClassification): boolean;
    canBeApprover(userId: string, organizationId: string): Promise<boolean>;
    getEligibleApprovers(organizationId: string): Promise<string[]>;
    requestApproval(intelEntryId: string, requestedBy: string, organizationId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<IntelApproval>;
    submitApproval(approvalId: string, approverId: string, organizationId: string, decision: 'approved' | 'rejected', comment?: string, ipAddress?: string, userAgent?: string): Promise<IntelApproval>;
    getPendingApprovals(organizationId: string): Promise<IntelApproval[]>;
    getApprovalHistory(intelEntryId: string, organizationId: string): Promise<IntelApproval[]>;
    withdrawApproval(approvalId: string, userId: string, organizationId: string, ipAddress?: string, userAgent?: string): Promise<IntelApproval>;
    isApprovedForModification(intelEntryId: string, organizationId: string): Promise<boolean>;
    expireOldApprovals(): Promise<number>;
    private logAudit;
}
//# sourceMappingURL=TwoPersonApprovalService.d.ts.map