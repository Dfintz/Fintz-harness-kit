import { MaintenanceStatus, MaintenanceType, ShipMaintenance } from '../../models/ShipMaintenance';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface MaintenanceFilters {
    shipId?: string;
    ownerId?: string;
    status?: MaintenanceStatus | MaintenanceStatus[];
    maintenanceType?: MaintenanceType | MaintenanceType[];
    scheduledDateFrom?: Date;
    scheduledDateTo?: Date;
    isOverdue?: boolean;
    search?: string;
}
export interface CreateMaintenanceDto {
    shipId: string;
    ownerId: string;
    maintenanceType: MaintenanceType;
    scheduledDate: Date;
    description?: string;
    cost?: number;
    notes?: string;
}
export interface UpdateMaintenanceDto {
    maintenanceType?: MaintenanceType;
    scheduledDate?: Date;
    status?: MaintenanceStatus;
    description?: string;
    cost?: number;
    performedBy?: string;
    notes?: string;
}
export interface MaintenanceReminder {
    maintenance: ShipMaintenance;
    daysUntilDue: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    message: string;
}
export interface MaintenanceStats {
    totalScheduled: number;
    totalInProgress: number;
    totalCompleted: number;
    totalCancelled: number;
    totalOverdue: number;
    totalCost: number;
    averageCost: number;
    completionRate: number;
    byType: Record<string, number>;
    upcomingCount: number;
}
export interface MaintenanceCostSummary {
    totalCost: number;
    byShip: Record<string, number>;
    byType: Record<string, number>;
    averagePerMaintenance: number;
    maintenanceCount: number;
}
export declare class ShipMaintenanceService {
    private maintenanceRepository;
    constructor();
    scheduleMaintenance(data: CreateMaintenanceDto): Promise<ShipMaintenance>;
    getMaintenanceById(id: string): Promise<ShipMaintenance | null>;
    getMaintenanceSchedules(filters: MaintenanceFilters, options?: PaginationOptions): Promise<PaginatedResponse<ShipMaintenance>>;
    updateMaintenance(id: string, updates: UpdateMaintenanceDto): Promise<ShipMaintenance | null>;
    startMaintenance(id: string, performedBy?: string): Promise<ShipMaintenance | null>;
    completeMaintenance(id: string, performedBy?: string, notes?: string, actualCost?: number): Promise<ShipMaintenance | null>;
    cancelMaintenance(id: string, reason?: string): Promise<ShipMaintenance | null>;
    getUpcomingMaintenance(daysAhead?: number, shipId?: string): Promise<ShipMaintenance[]>;
    getOverdueMaintenance(shipId?: string): Promise<ShipMaintenance[]>;
    getMaintenanceReminders(shipId?: string, daysAhead?: number): Promise<MaintenanceReminder[]>;
    getMaintenanceStats(ownerId?: string, shipId?: string, dateFrom?: Date, dateTo?: Date): Promise<MaintenanceStats>;
    getMaintenanceCostSummary(ownerId?: string, dateFrom?: Date, dateTo?: Date): Promise<MaintenanceCostSummary>;
    getShipMaintenanceHistory(shipId: string, options?: PaginationOptions): Promise<PaginatedResponse<ShipMaintenance>>;
    scheduleRecurringMaintenance(data: CreateMaintenanceDto, intervalDays: number, occurrences: number): Promise<ShipMaintenance[]>;
    deleteMaintenance(id: string): Promise<boolean>;
    updateOverdueStatuses(): Promise<number>;
}
//# sourceMappingURL=ShipMaintenanceService.d.ts.map