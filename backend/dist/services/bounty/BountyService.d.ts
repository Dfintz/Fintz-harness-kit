import { Bounty, BountyDifficulty, BountyMetadata, BountyRewardType, BountyStatus, BountyTargetDetails, BountyTargetType, BountyType, BountyVisibility } from '../../models/Bounty';
import { TenantService } from '../base/TenantService';
export declare enum BountyAuditAction {
    BOUNTY_CREATED = "BOUNTY_CREATED",
    BOUNTY_UPDATED = "BOUNTY_UPDATED",
    BOUNTY_DELETED = "BOUNTY_DELETED",
    BOUNTY_CLAIMED = "BOUNTY_CLAIMED",
    BOUNTY_UNCLAIMED = "BOUNTY_UNCLAIMED",
    BOUNTY_COMPLETED = "BOUNTY_COMPLETED",
    BOUNTY_VERIFIED = "BOUNTY_VERIFIED",
    BOUNTY_PAID = "BOUNTY_PAID",
    BOUNTY_CANCELLED = "BOUNTY_CANCELLED",
    BOUNTY_EXPIRED = "BOUNTY_EXPIRED"
}
export interface CreateBountyDTO {
    title: string;
    description?: string;
    bountyType: BountyType;
    targetType: BountyTargetType;
    targetIdentifier?: string;
    targetName?: string;
    targetDetails?: BountyTargetDetails;
    rewardType: BountyRewardType;
    rewardAmount?: number;
    rewardDescription?: string;
    difficulty?: BountyDifficulty;
    location?: string;
    systemLocation?: string;
    expiresAt?: Date;
    visibility?: BountyVisibility;
    tags?: string[];
    metadata?: BountyMetadata;
}
export interface UpdateBountyDTO {
    title?: string;
    description?: string;
    targetIdentifier?: string;
    targetName?: string;
    targetDetails?: BountyTargetDetails;
    rewardAmount?: number;
    rewardDescription?: string;
    difficulty?: BountyDifficulty;
    location?: string;
    systemLocation?: string;
    expiresAt?: Date;
    visibility?: BountyVisibility;
    tags?: string[];
    metadata?: BountyMetadata;
}
export interface BountySearchFilters {
    bountyType?: BountyType;
    status?: BountyStatus;
    difficulty?: BountyDifficulty;
    visibility?: BountyVisibility;
    targetType?: BountyTargetType;
    createdBy?: string;
    claimedBy?: string;
    searchTerm?: string;
    tags?: string[];
    minReward?: number;
    maxReward?: number;
    includeExpired?: boolean;
    sortBy?: 'createdAt' | 'rewardAmount' | 'expiresAt' | 'title';
    sortOrder?: 'asc' | 'desc';
}
export interface BountyStatistics {
    totalBounties: number;
    activeBounties: number;
    completedBounties: number;
    claimedBounties: number;
    totalRewardsPosted: number;
    totalRewardsPaid: number;
    byType: Record<BountyType, number>;
    byStatus: Record<BountyStatus, number>;
    averageCompletionTime: number;
}
export declare class BountyService extends TenantService<Bounty> {
    constructor();
    private isClaimable;
    private isClaimed;
    private isCompleted;
    private isTerminal;
    private logBountyAudit;
    createBounty(organizationId: string, creatorId: string, creatorName: string, dto: CreateBountyDTO): Promise<Bounty>;
    getBountyById(organizationId: string, bountyId: string): Promise<Bounty | null>;
    getBountyByIdSimple(bountyId: string): Promise<Bounty | null>;
    updateBounty(organizationId: string, bountyId: string, userId: string, userName: string, dto: UpdateBountyDTO, options?: {
        isAdmin?: boolean;
    }): Promise<Bounty | null>;
    claimBounty(organizationId: string, bountyId: string, userId: string, userName: string): Promise<Bounty>;
    unclaimBounty(organizationId: string, bountyId: string, userId: string, userName: string): Promise<Bounty>;
    completeBounty(organizationId: string, bountyId: string, userId: string, userName: string, evidence?: string[], completionNotes?: string): Promise<Bounty>;
    verifyBounty(organizationId: string, bountyId: string, verifierId: string, verifierName: string, approved: boolean, verificationNotes?: string): Promise<Bounty>;
    payBounty(organizationId: string, bountyId: string, payerId: string, payerName: string, paymentReference?: string, paymentNotes?: string): Promise<Bounty>;
    cancelBounty(organizationId: string, bountyId: string, userId: string, userName: string, reason?: string): Promise<Bounty>;
    deleteBounty(organizationId: string, bountyId: string, userId: string, userName: string, options?: {
        isAdmin?: boolean;
    }): Promise<void>;
    searchBounties(organizationId: string, filters: BountySearchFilters, page?: number, limit?: number): Promise<{
        bounties: Bounty[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    listActiveBounties(organizationId: string, page?: number, limit?: number): Promise<{
        bounties: Bounty[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMyCreatedBounties(organizationId: string, userId: string, page?: number, limit?: number): Promise<{
        bounties: Bounty[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMyClaimedBounties(organizationId: string, userId: string, page?: number, limit?: number): Promise<{
        bounties: Bounty[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getStatistics(organizationId: string): Promise<BountyStatistics>;
    expireBounties(): Promise<number>;
}
//# sourceMappingURL=BountyService.d.ts.map