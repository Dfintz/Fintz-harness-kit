export declare enum ReputationCategory {
    COMMUNICATION = "communication",
    TEAMWORK = "teamwork",
    SKILL = "skill",
    RELIABILITY = "reliability",
    LEADERSHIP = "leadership"
}
export declare class LFGReputationRating {
    id: string;
    sessionId: string;
    userId: string;
    raterId: string;
    overallRating: number;
    categoryRatings?: {
        [ReputationCategory.COMMUNICATION]?: number;
        [ReputationCategory.TEAMWORK]?: number;
        [ReputationCategory.SKILL]?: number;
        [ReputationCategory.RELIABILITY]?: number;
        [ReputationCategory.LEADERSHIP]?: number;
    };
    comment?: string;
    isPositive: boolean;
    createdAt: Date;
    updatedAt: Date;
    isPositiveRating(): boolean;
    getAverageCategoryRating(): number;
    getSummary(): {
        overall: number;
        isPositive: boolean;
        categories: number;
        hasComment: boolean;
    };
}
//# sourceMappingURL=LFGReputationRating.d.ts.map