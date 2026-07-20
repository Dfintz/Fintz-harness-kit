import { DuesCollectionOrchestratorService, DuesCollectionSummary } from '../../services/treasury/DuesCollectionOrchestratorService';
export declare class DuesCollectionJobAdapter {
    private readonly orchestrator;
    constructor(orchestrator?: DuesCollectionOrchestratorService);
    runDailyCollection(): Promise<DuesCollectionSummary>;
}
//# sourceMappingURL=DuesCollectionJobAdapter.d.ts.map