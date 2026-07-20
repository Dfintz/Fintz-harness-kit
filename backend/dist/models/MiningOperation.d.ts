export declare enum MiningOperationStatus {
    PLANNED = "planned",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export interface MiningCrew {
    userId: string;
    role: 'miner' | 'escort' | 'hauler' | 'refiner';
    shipId?: string;
}
export interface ResourceYield {
    resourceType: string;
    quantity: number;
    value: number;
}
export declare class MiningOperation {
    id: string;
    name: string;
    description: string;
    location: string;
    coordinatorId: string;
    scheduledDate: Date;
    completedDate?: Date;
    status: MiningOperationStatus;
    crew: MiningCrew[];
    resourcesFound: ResourceYield[];
    totalValue: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=MiningOperation.d.ts.map