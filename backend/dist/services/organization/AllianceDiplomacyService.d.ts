import { AllianceDiplomacy, AllianceType } from '../../models/AllianceDiplomacy';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface ProposeDiplomacyDto {
    orgId1: string;
    orgId2: string;
    allianceType: AllianceType;
    proposedBy: string;
    terms?: AllianceDiplomacy['terms'];
    notes?: string;
}
export declare class AllianceDiplomacyService {
    private readonly repository;
    constructor();
    propose(dto: ProposeDiplomacyDto): Promise<AllianceDiplomacy>;
    findAll(orgId: string, pagination: PaginationOptions): Promise<PaginatedResponse<AllianceDiplomacy>>;
    findById(id: string, orgId: string): Promise<AllianceDiplomacy>;
    approve(id: string, orgId: string, approvedBy: string): Promise<AllianceDiplomacy>;
    suspend(id: string, orgId: string): Promise<AllianceDiplomacy>;
    terminate(id: string, orgId: string): Promise<AllianceDiplomacy>;
    reportIncident(id: string, orgId: string, incident: {
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        reportedBy: string;
    }): Promise<AllianceDiplomacy>;
    resolveIncident(id: string, orgId: string, incidentId: string): Promise<AllianceDiplomacy>;
}
//# sourceMappingURL=AllianceDiplomacyService.d.ts.map