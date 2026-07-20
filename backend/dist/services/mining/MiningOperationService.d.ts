import { MiningOperation, MiningOperationStatus, type MiningCrew, type ResourceYield } from '../../models/MiningOperation';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface CreateMiningOperationDto {
    name: string;
    description?: string;
    location: string;
    coordinatorId: string;
    scheduledDate: string;
    notes?: string;
}
export declare class MiningOperationService {
    private readonly repository;
    constructor();
    create(dto: CreateMiningOperationDto): Promise<MiningOperation>;
    findAll(pagination: PaginationOptions): Promise<PaginatedResponse<MiningOperation>>;
    findById(id: string): Promise<MiningOperation>;
    update(id: string, updates: {
        location?: string;
        resourceType?: string;
        notes?: string;
        description?: string;
    }): Promise<MiningOperation>;
    updateStatus(id: string, status: MiningOperationStatus): Promise<MiningOperation>;
    addCrewMember(id: string, member: MiningCrew): Promise<MiningOperation>;
    recordResources(id: string, resource: ResourceYield): Promise<MiningOperation>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=MiningOperationService.d.ts.map