export interface StarCommsBriefingSyncPayload {
    organizationId: string;
    briefingId: string;
    title: string;
    classification: string;
    status: string;
    missionId?: string;
    operationIds?: string[];
}
export interface StarCommsTeamSyncPayload {
    organizationId: string;
    teamId: string;
    teamName: string;
    teamType?: string;
    action: 'team-created' | 'team-deleted';
}
export declare class StarCommsContextSyncService {
    private static readonly BRIEFING_SYNC_SUCCESS_METRIC;
    private static readonly BRIEFING_SYNC_SKIPPED_METRIC;
    private static readonly BRIEFING_SYNC_FAILED_METRIC;
    private static readonly TEAM_SYNC_SUCCESS_METRIC;
    private static readonly TEAM_SYNC_SKIPPED_METRIC;
    private static readonly TEAM_SYNC_FAILED_METRIC;
    private readonly organizationRepository;
    private readonly fleetService;
    private readonly integrationService;
    private readonly starCommsAdapter;
    syncBriefingContext(payload: StarCommsBriefingSyncPayload): Promise<void>;
    syncTeamContext(payload: StarCommsTeamSyncPayload): Promise<void>;
    private trackSyncMetric;
    private isFlagEnabled;
    private findStarCommsIntegration;
}
//# sourceMappingURL=StarCommsContextSyncService.d.ts.map