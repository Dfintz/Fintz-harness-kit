export interface OrgTrustScoreBreakdown {
    verifiedMemberRate: number;
    verifiedMemberCount: number;
    totalMembers: number;
    avgMemberReputation: number;
    categoryAverages: {
        communication: number;
        teamwork: number;
        skill: number;
        reliability: number;
        leadership: number;
    };
    orgRsiVerified: boolean;
    avgRelationshipTrust: number;
    activeRelationships: number;
}
export interface OrgTrustScore {
    organizationId: string;
    score: number;
    tier: string;
    breakdown: OrgTrustScoreBreakdown;
    computedAt: string;
}
export declare class OrgTrustScoreService {
    private membershipRepo;
    private rsiLinkRepo;
    private reputationRepo;
    private relationshipRepo;
    private orgRepo;
    private scoreCache;
    constructor();
    getTrustScore(organizationId: string): Promise<OrgTrustScore>;
    private computeTrustScore;
    private computeCategoryAverages;
    private averageOfCategories;
}
//# sourceMappingURL=OrgTrustScoreService.d.ts.map