import { Organization } from './Organization';
import { User } from './User';
export declare enum OrgDeletionRequestStatus {
    PENDING = "pending",
    EMAIL_VERIFICATION_PENDING = "email_verification_pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare class OrganizationDeletionRequest {
    id: string;
    organizationId: string;
    organization?: Organization;
    requestedBy: string;
    requester?: User;
    status: OrgDeletionRequestStatus;
    requestedAt: Date;
    approvedAt?: Date;
    approvedBy?: string;
    approver?: User;
    approvalNotes?: string;
    rejectedAt?: Date;
    rejectedBy?: string;
    rejector?: User;
    rejectionReason?: string;
    scheduledFor?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelledBy?: string;
    canceller?: User;
    cancellationReason?: string;
    requestReason?: string;
    requestIpAddress?: string;
    requestUserAgent?: string;
    failureReason?: string;
    deleteDescendants: boolean;
    dataExportGenerated: boolean;
    exportFilePath?: string | null;
    exportDownloadToken?: string | null;
    exportDownloadCount: number;
    exportLastDownloadedAt?: Date;
    deletionPreview?: {
        descendantCount?: number;
        memberCount?: number;
        shipCount?: number;
        dataSize?: string;
        [key: string]: unknown;
    };
    gracePeriodDays: number;
    emailVerificationToken?: string;
    emailVerifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    isEmailVerified(): boolean;
    isGracePeriodExpired(): boolean;
    canBeCancelled(): boolean;
    canBeApproved(): boolean;
    canBeRejected(): boolean;
}
//# sourceMappingURL=OrganizationDeletionRequest.d.ts.map