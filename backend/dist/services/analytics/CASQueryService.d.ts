import type { CASBreakdown, CASHeatmapResponse, CASHistoryPoint, CASRankingEntry, CASScoreResult } from '@sc-fleet-manager/shared-types';
export declare class CASQueryService {
    private readonly scoreRepo;
    private readonly heatmapRepo;
    getCurrentScore(organizationId: string): Promise<CASScoreResult | null>;
    getScoreHistory(organizationId: string, days?: number): Promise<CASHistoryPoint[]>;
    getScoreBreakdown(organizationId: string): Promise<CASBreakdown | null>;
    getOrgRanking(limit?: number): Promise<CASRankingEntry[]>;
    getHeatmap(organizationId: string, days?: number, logScale?: boolean): Promise<CASHeatmapResponse>;
}
//# sourceMappingURL=CASQueryService.d.ts.map