export declare class TradeUserReputation {
    id: string;
    userId: string;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    abortedRuns: number;
    successRate: number;
    totalProfitGenerated: number;
    avgProfitPerRun: number;
    avgEstimateAccuracy: number;
    profitConsistency: number;
    routeStats?: {
        [routeId: string]: {
            runs: number;
            successful: number;
            totalProfit: number;
        };
    };
    currentSuccessStreak: number;
    longestSuccessStreak: number;
    overallScore: number;
    lastRunAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    calculateOverallScore(): number;
    getReputationTier(): {
        tier: string;
        icon: string;
        minScore: number;
    };
    getSummary(): {
        userId: string;
        score: number;
        tier: string;
        runs: number;
        successRate: number;
        avgProfit: number;
        streak: number;
    };
    isExperienced(): boolean;
    isHighPerformer(): boolean;
}
//# sourceMappingURL=TradeUserReputation.d.ts.map