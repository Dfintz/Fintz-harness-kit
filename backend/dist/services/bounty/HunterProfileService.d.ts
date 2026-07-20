import { BountyType } from '../../models/Bounty';
import { BountyClaimStatus } from '../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../models/HunterProfile';
export declare enum HunterProfileAuditAction {
    PROFILE_CREATED = "PROFILE_CREATED",
    PROFILE_UPDATED = "PROFILE_UPDATED",
    STATS_RECALCULATED = "STATS_RECALCULATED",
    RANK_CHANGED = "RANK_CHANGED"
}
export interface HunterLeaderboardEntry {
    userId: string;
    userName?: string;
    totalBountiesCompleted: number;
    totalRewardsEarned: number;
    successRate: number;
    rank: HunterRank;
    reputationScore: number;
    primarySpecialization: string;
}
export interface HunterBountyHistoryEntry {
    bountyId: string;
    bountyTitle: string;
    bountyType: BountyType;
    status: BountyClaimStatus;
    rewardAmount?: number;
    claimedAt: Date;
    completedAt?: Date;
}
export interface HunterAnalyticsSummary {
    totalHunters: number;
    activeHunters: number;
    totalBountiesCompleted: number;
    totalRewardsPaid: number;
    averageSuccessRate: number;
    topHunters: HunterLeaderboardEntry[];
    bountyTypeBreakdown: Record<string, number>;
}
export declare class HunterProfileService {
    private readonly profileRepository;
    private readonly claimRepository;
    private readonly bountyRepository;
    private readonly notificationService;
    constructor();
    private logProfileAudit;
    getOrCreateProfile(organizationId: string, userId: string, userName?: string): Promise<HunterProfile>;
    getProfileByUserId(organizationId: string, userId: string): Promise<HunterProfile | null>;
    getProfileById(profileId: string): Promise<HunterProfile | null>;
    private applySpecializationCounts;
    private calculateAvgCompletionMinutes;
    updateHunterStats(organizationId: string, userId: string, userName?: string): Promise<HunterProfile>;
    private calculateRank;
    private calculateReputationScore;
    private calculatePrimarySpecialization;
    getLeaderboard(organizationId: string, sortBy?: 'completed' | 'rewards' | 'successRate' | 'reputation', limit?: number): Promise<HunterLeaderboardEntry[]>;
    getHunterHistory(organizationId: string, userId: string, page?: number, limit?: number): Promise<{
        history: HunterBountyHistoryEntry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getAnalyticsSummary(organizationId: string): Promise<HunterAnalyticsSummary>;
    getProfileCount(organizationId: string): Promise<number>;
}
//# sourceMappingURL=HunterProfileService.d.ts.map