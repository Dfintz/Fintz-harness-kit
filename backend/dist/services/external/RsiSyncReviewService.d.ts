import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
export declare enum ReviewReason {
    RANK_MISMATCH = "rank_mismatch",
    HANDLE_NOT_FOUND = "handle_not_found",
    MULTIPLE_FAILURES = "multiple_failures",
    MANUAL_FLAG = "manual_flag",
    AFFILIATE_CHANGE = "affiliate_change",
    SUSPICIOUS_ACTIVITY = "suspicious_activity",
    USERNAME_MATCH = "username_match",
    DISCORD_NAME_MATCH = "discord_name_match"
}
export declare enum ReviewResolution {
    APPROVED = "approved",
    REJECTED = "rejected",
    RESYNCED = "resynced",
    REMOVED = "removed"
}
export interface ReviewQueueItem {
    id: string;
    userId: string;
    rsiHandle: string;
    syncStatus: SyncStatus;
    lastKnownRank: string | null;
    isAffiliate: boolean;
    discordUserId: string | null;
    reviewReason: string | null;
    reviewFlaggedAt: string | null;
    lastFailureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface ReviewStats {
    totalPendingReview: number;
    byReason: Record<string, number>;
    oldestReviewItem: Date | null;
    resolvedLast30Days: number;
}
export interface ResolveReviewInput {
    linkId: string;
    resolution: ReviewResolution;
    adminNotes?: string;
    updatedRank?: string;
}
export declare class RsiSyncReviewService {
    private userLinkRepository;
    constructor();
    getReviewQueue(organizationId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        items: ReviewQueueItem[];
        total: number;
    }>;
    resolveReviewItem(input: ResolveReviewInput, adminId: string): Promise<RsiUserLink | null>;
    flagForReview(linkId: string, reason: ReviewReason | string, additionalContext?: Record<string, unknown>): Promise<RsiUserLink | null>;
    getReviewStats(organizationId: string): Promise<ReviewStats>;
    flagMultipleFailures(organizationId: string, failureThreshold?: number): Promise<number>;
}
export declare const rsiSyncReviewService: RsiSyncReviewService;
//# sourceMappingURL=RsiSyncReviewService.d.ts.map