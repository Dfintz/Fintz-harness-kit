export declare enum RoleSyncRetryStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    DEAD_LETTER = "dead_letter"
}
export declare enum RoleSyncOperationType {
    ASSIGN = "assign",
    REMOVE = "remove"
}
export interface RoleSyncRetryPayload {
    guildId: string;
    userId: string;
    roleId: string;
    operation: RoleSyncOperationType;
    retryCount: number;
    originalRequestId?: string;
    metadata?: Record<string, unknown>;
}
export declare class RoleSyncRetryQueue {
    id: string;
    guildId: string;
    userId: string;
    roleId: string;
    operation: RoleSyncOperationType;
    payload: RoleSyncRetryPayload;
    retryCount: number;
    maxRetries: number;
    status: RoleSyncRetryStatus;
    nextRetryAt?: Date;
    lastError?: string;
    lastErrorCode?: string;
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    deadLetteredAt?: Date;
    adminNotified: boolean;
    adminNotifiedAt?: Date;
}
export interface CreateRoleSyncRetryDto {
    guildId: string;
    userId: string;
    roleId: string;
    operation: RoleSyncOperationType;
    maxRetries?: number;
    retryDelayMs?: number;
    originalRequestId?: string;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=RoleSyncRetryQueue.d.ts.map