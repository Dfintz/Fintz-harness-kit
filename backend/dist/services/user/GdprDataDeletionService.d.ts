import { DeletionRequest } from '../../models/DeletionRequest';
export interface LegalHoldStatus {
    isOnHold: boolean;
    reason?: string;
    holdUntil?: Date;
    createdBy?: string;
}
export interface GdprDeletionResult {
    success: boolean;
    userId: string;
    deletedCounts: Record<string, number>;
    totalDeleted: number;
    errors: string[];
    completedAt: Date;
}
export declare class GdprDataDeletionService {
    private readonly legalHoldRepository;
    private readonly deletionRequestRepository;
    constructor();
    private getGracePeriodMs;
    createDeletionRequest(userId: string, ipAddress?: string, userAgent?: string): Promise<DeletionRequest>;
    cancelDeletionRequest(userId: string, reason?: string): Promise<DeletionRequest | null>;
    getPendingDeletionRequest(userId: string): Promise<DeletionRequest | null>;
    getAllPendingDeletionRequests(): Promise<DeletionRequest[]>;
    getPendingDeletionCount(): Promise<number>;
    getAllDeletionRequests(limit?: number): Promise<DeletionRequest[]>;
    markDeletionComplete(requestId: string, result: GdprDeletionResult): Promise<void>;
    processDueDeletions(): Promise<Array<{
        userId: string;
        result: GdprDeletionResult;
    }>>;
    checkLegalHold(userId: string): Promise<LegalHoldStatus>;
    setLegalHold(userId: string, reason: string, holdUntil?: Date, createdBy?: string): Promise<void>;
    removeLegalHold(userId: string): Promise<void>;
    deleteAllUserData(userId: string, bypassLegalHold?: boolean): Promise<GdprDeletionResult>;
    private deleteFromTable;
    private deleteFromTableNumericId;
    private deleteFromTableByRater;
    private clearSCStatsData;
    private anonymizeActivities;
    private anonymizeIntelAuditLogs;
    getDataDeletionPreview(userId: string): Promise<Record<string, number>>;
}
export declare const getGdprDataDeletionService: () => GdprDataDeletionService;
//# sourceMappingURL=GdprDataDeletionService.d.ts.map