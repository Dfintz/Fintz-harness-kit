import { CreateRoleSyncRetryDto, RoleSyncRetryQueue } from '../../models/RoleSyncRetryQueue';
export declare class RoleSyncRetryService {
    private readonly repository;
    private processingInterval;
    private isProcessing;
    private tableVerified;
    private readonly PROCESSING_INTERVAL_MS;
    private readonly BASE_RETRY_DELAY_MS;
    constructor();
    start(): void;
    stop(): void;
    enqueue(dto: CreateRoleSyncRetryDto): Promise<RoleSyncRetryQueue>;
    private processRetryQueue;
    private processEntry;
    private handleRetryFailure;
    private notifyAdmins;
    getStats(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        deadLetter: number;
        total: number;
    }>;
    getDeadLetterQueue(): Promise<RoleSyncRetryQueue[]>;
    retryDeadLetter(entryId: string): Promise<void>;
    cleanupCompleted(olderThanDays?: number): Promise<number>;
}
export declare function getRoleSyncRetryService(): RoleSyncRetryService;
export declare function startRoleSyncRetryService(): void;
export declare function stopRoleSyncRetryService(): void;
//# sourceMappingURL=RoleSyncRetryService.d.ts.map