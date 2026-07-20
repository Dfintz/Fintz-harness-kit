import { Organization } from './Organization';
import { User } from './User';
export declare enum VerificationMethod {
    MANUAL = "manual",
    BIO_CODE = "bio_code",
    DISCORD_MATCH = "discord_match"
}
export declare enum SyncStatus {
    PENDING = "pending",
    SYNCED = "synced",
    FAILED = "failed",
    REMOVED = "removed",
    NEEDS_REVIEW = "needs_review"
}
export declare class RsiUserLink {
    id: string;
    userId: string;
    user: User;
    organizationId: string;
    organization: Organization;
    rsiHandle: string;
    verificationMethod: VerificationMethod;
    verificationCode?: string;
    verifiedAt?: Date;
    lastSyncedAt?: Date;
    syncStatus: SyncStatus;
    discordUserId?: string;
    lastKnownRank?: string;
    isAffiliate: boolean;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    isVerified(): boolean;
    isSynced(): boolean;
    isPending(): boolean;
    isRemoved(): boolean;
    hasFailed(): boolean;
    needsReview(): boolean;
    hasDiscordId(): boolean;
    markVerified(): void;
    markSynced(rank?: string, isAffiliate?: boolean): void;
    markFailed(reason?: string): void;
    markRemoved(): void;
    markNeedsReview(reason?: string): void;
    static generateVerificationCode(): string;
    getSummary(): {
        rsiHandle: string;
        isVerified: boolean;
        syncStatus: SyncStatus;
        lastKnownRank: string | null;
        isAffiliate: boolean;
        hasDiscordId: boolean;
    };
}
//# sourceMappingURL=RsiUserLink.d.ts.map