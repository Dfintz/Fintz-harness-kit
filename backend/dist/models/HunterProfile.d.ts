export declare enum HunterRank {
    ROOKIE = "rookie",
    APPRENTICE = "apprentice",
    HUNTER = "hunter",
    VETERAN = "veteran",
    ELITE = "elite",
    LEGENDARY = "legendary"
}
export declare class HunterProfile {
    id: string;
    userId: string;
    userName?: string;
    organizationId: string;
    totalBountiesCompleted: number;
    totalBountiesClaimed: number;
    totalBountiesAbandoned: number;
    totalBountiesRejected: number;
    totalRewardsEarned: number;
    successRate: number;
    averageCompletionTimeMinutes: number;
    rank: HunterRank;
    reputationScore: number;
    killBountiesCompleted: number;
    captureBountiesCompleted: number;
    intelBountiesCompleted: number;
    transportBountiesCompleted: number;
    rescueBountiesCompleted: number;
    customBountiesCompleted: number;
    lastBountyCompletedAt?: Date;
    currentStreak: number;
    longestStreak: number;
    createdAt: Date;
    updatedAt: Date;
    get isActive(): boolean;
    get primarySpecialization(): string;
}
//# sourceMappingURL=HunterProfile.d.ts.map