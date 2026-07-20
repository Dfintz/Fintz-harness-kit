export declare enum ReputationCategory {
    COMBAT = "combat",
    TRADING = "trading",
    MINING = "mining",
    EXPLORATION = "exploration",
    RELIABILITY = "reliability",
    LEADERSHIP = "leadership"
}
export interface ReputationScore {
    category: ReputationCategory;
    score: number;
    lastUpdated: Date;
}
export interface ReputationModifier {
    reason: string;
    amount: number;
    category: ReputationCategory;
    timestamp: Date;
    modifiedBy?: string;
}
export declare class Reputation {
    id: string;
    userId: string;
    scores: ReputationScore[];
    overallScore: number;
    history: ReputationModifier[];
    lastUpdated: Date;
    createdAt: Date;
}
//# sourceMappingURL=Reputation.d.ts.map