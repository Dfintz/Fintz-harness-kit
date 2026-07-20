import { Repository } from 'typeorm';
import { OrgDues } from '../../models/OrgDues';
import { DuesService } from './DuesService';
export interface DuesCollectionSummary {
    collected: number;
    errors: number;
}
export declare class DuesCollectionOrchestratorService {
    private readonly duesService;
    private readonly duesRepository;
    private static readonly BATCH_SIZE;
    constructor(duesService?: DuesService, duesRepository?: Repository<OrgDues>);
    collectAllDues(now?: Date): Promise<DuesCollectionSummary>;
}
//# sourceMappingURL=DuesCollectionOrchestratorService.d.ts.map