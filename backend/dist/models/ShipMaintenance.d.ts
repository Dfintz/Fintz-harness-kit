export declare enum MaintenanceStatus {
    SCHEDULED = "scheduled",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    OVERDUE = "overdue"
}
export declare enum MaintenanceType {
    ROUTINE = "routine",
    REPAIR = "repair",
    UPGRADE = "upgrade",
    INSPECTION = "inspection"
}
export declare class ShipMaintenance {
    id: string;
    shipId: string;
    ownerId: string;
    maintenanceType: MaintenanceType;
    scheduledDate: Date;
    completedDate?: Date;
    status: MaintenanceStatus;
    description?: string;
    cost?: number;
    performedBy?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ShipMaintenance.d.ts.map