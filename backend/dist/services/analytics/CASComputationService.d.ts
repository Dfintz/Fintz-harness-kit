import { OrgActivityScore } from '../../models/OrgActivityScore';
export declare class CASComputationService {
    private readonly scoreRepo;
    private readonly heatmapRepo;
    private readonly engagementRepo;
    private readonly guildOrgRepo;
    private readonly orgRepo;
    computeScore(organizationId: string): Promise<OrgActivityScore>;
    private computeOnlinePresence;
    private computeEngagement;
    private computeConsistency;
    private computeVoiceActivity;
    private computeSiteActivity;
    private persistScore;
    sampleHeatmap(organizationId: string, guildIds: string[], memberCount: number): Promise<void>;
}
//# sourceMappingURL=CASComputationService.d.ts.map