import { TenantEntity } from './base/TenantEntity';
export declare enum BackupStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    EXPIRED = "expired"
}
export declare enum BackupType {
    FULL = "full",
    INCREMENTAL = "incremental"
}
export declare class Backup extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    backupType: BackupType;
    status: BackupStatus;
    createdBy: string;
    createdByName: string;
    sizeBytes?: number;
    blobName?: string;
    entityCount: number;
    entityBreakdown?: Record<string, number>;
    errorMessage?: string;
    completedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    get isCompleted(): boolean;
    get isExpired(): boolean;
    get isPending(): boolean;
}
//# sourceMappingURL=Backup.d.ts.map