import { User } from './User';
export declare enum ExportRequestStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    EXPIRED = "expired"
}
export declare class ExportRequest {
    id: string;
    userId?: string | null;
    user?: User;
    status: ExportRequestStatus;
    requestedAt: Date;
    processingStartedAt?: Date;
    completedAt?: Date;
    expiresAt?: Date;
    requestIpAddress?: string;
    requestUserAgent?: string;
    failureReason?: string;
    filePath?: string;
    fileSize?: string;
    downloadToken?: string;
    notificationSent: boolean;
    exportMetadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ExportRequest.d.ts.map