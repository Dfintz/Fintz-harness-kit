export declare class LFGUserReputation {
    id: string;
    userId: string;
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    successRate: number;
    totalRatingsReceived: number;
    averageRating: number;
    positiveRatings: number;
    negativeRatings: number;
    categoryAverages?: {
        communication?: number;
        teamwork?: number;
        skill?: number;
        reliability?: number;
        leadership?: number;
    };
    activityStats?: {
        [activity: string]: {
            sessions: number;
            successful: number;
            averageRating: number;
        };
    };
    overallScore: number;
    sessionsAsLeader: number;
    successfulLeaderSessions: number;
    leadershipSuccessRate: number;
    currentSuccessStreak: number;
    longestSuccessStreak: number;
    lastSessionAt?: Date;
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
        sessions: number;
        successRate: number;
        averageRating: number;
        streak: number;
    };
    isExperienced(): boolean;
    isHighlyRated(): boolean;
    isSuccessfulLeader(): boolean;
}
//# sourceMappingURL=LFGUserReputation.d.ts.map