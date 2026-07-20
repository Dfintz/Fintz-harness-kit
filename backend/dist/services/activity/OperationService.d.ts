import { Repository } from 'typeorm';
import { Operation, OperationType, OperationStatus } from '../../models/Operation';
import { TenantService } from '../base/TenantService';
export interface CreateOperationDTO {
    type: OperationType;
    name: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    participants?: string[];
}
export declare class OperationService extends TenantService<Operation> {
    constructor(repository: Repository<Operation>);
    createOperation(orgId: string, data: CreateOperationDTO, userId: string): Promise<Operation>;
    getOperationsByType(orgId: string, type: OperationType): Promise<Operation[]>;
    updateOperationStatus(orgId: string, opId: string, status: OperationStatus): Promise<Operation | null>;
    getActiveOperations(orgId: string): Promise<Operation[]>;
}
//# sourceMappingURL=OperationService.d.ts.map