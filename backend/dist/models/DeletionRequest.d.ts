import { User } from './User';
export declare enum DeletionRequestStatus {
    PENDING = "pending",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare class DeletionRequest {
    id: string;
    userId?: string | null;
    user?: User;
    status: DeletionRequestStatus;
    requestedAt: Date;
    scheduledFor: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelledBy?: string;
    cancellationReason?: string;
    requestIpAddress?: string;
    requestUserAgent?: string;
    failureReason?: string;
    deletionPreview?: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=DeletionRequest.d.ts.map