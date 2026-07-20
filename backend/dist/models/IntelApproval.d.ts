import { IntelEntry } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';
export declare enum IntelApprovalStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    WITHDRAWN = "withdrawn",
    EXPIRED = "expired"
}
export declare class IntelApproval {
    id: string;
    organizationId: string;
    organization?: Organization;
    intelEntryId: string;
    intelEntry?: IntelEntry;
    requestedBy: string;
    requester?: User;
    status: IntelApprovalStatus;
    reason?: string;
    requiredApprovals: number;
    approvers?: string[];
    approvalDetails?: {
        userId: string;
        timestamp: Date;
        decision: 'approved' | 'rejected';
        comment?: string;
    }[];
    expiresAt?: Date;
    completedAt?: Date;
    completedBy?: string;
    completer?: User;
    createdAt: Date;
}
//# sourceMappingURL=IntelApproval.d.ts.map