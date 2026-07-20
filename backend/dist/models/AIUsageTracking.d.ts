export declare enum AIFeatureType {
    BRIEFING_GENERATION = "briefing_generation",
    MISSION_SUMMARY = "mission_summary"
}
export declare class AIUsageTracking {
    id: string;
    organizationId: string;
    featureType: AIFeatureType;
    usageDate: string;
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    lastModelUsed?: string;
    lastRequestByUserId?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=AIUsageTracking.d.ts.map