import { TenantEntity } from './base/TenantEntity';
export declare enum OperationType {
    MISSION = "mission",
    EVENT = "event",
    MINING = "mining",
    TRADING = "trading",
    LOGISTICS = "logistics",
    INTEL = "intel"
}
export declare enum OperationStatus {
    PLANNED = "planned",
    IN_PROGRESS = "in-progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare class Operation extends TenantEntity {
    id: string;
    type: OperationType;
    name: string;
    description?: string;
    status: OperationStatus;
    startDate?: Date;
    endDate?: Date;
    participants: string[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    isActive(): boolean;
}
//# sourceMappingURL=Operation.d.ts.map