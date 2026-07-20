import type { CASActivityTier } from '@sc-fleet-manager/shared-types';
export declare class OrgActivityScore {
    id: string;
    organizationId: string;
    score: number;
    tier: CASActivityTier;
    breakdown: {
        onlinePresence: number;
        engagement: number;
        consistency: number;
        voiceActivity: number;
        siteActivity: number;
    };
    memberCount: number;
    computedAt: Date;
    createdAt: Date;
}
//# sourceMappingURL=OrgActivityScore.d.ts.map