import { Repository } from 'typeorm';
import { FleetInventory, InventoryCategory, StockStatus } from '../../../models/FleetInventory';
import { FleetLogistics, LogisticsStatus } from '../../../models/FleetLogistics';
import { AlertSeverity, AlertType, LogisticsAlert } from '../../../models/LogisticsAlert';
export interface DashboardMetrics {
    inventory: {
        totalItems: number;
        totalValue: number;
        lowStockItems: number;
        criticalItems: number;
        outOfStockItems: number;
        adequateItems: number;
        averageDaysRemaining: number;
        totalAlerts: number;
    };
    alerts: {
        active: number;
        critical: number;
        warning: number;
        unacknowledged: number;
        resolvedToday: number;
    };
    operations: {
        active: number;
        planning: number;
        completed: number;
        totalShips: number;
        totalCargo: number;
        totalFuel: number;
    };
    trends: {
        stockTrend: 'improving' | 'declining' | 'stable';
        alertTrend: 'increasing' | 'decreasing' | 'stable';
        consumptionTrend: 'high' | 'normal' | 'low';
    };
}
export interface CategoryBreakdown {
    category: InventoryCategory;
    totalItems: number;
    totalValue: number;
    lowStock: number;
    criticalStock: number;
    adequateStock: number;
    topItems: Array<{
        name: string;
        quantity: number;
        unit: string;
        status: StockStatus;
        value: number;
    }>;
}
export interface AlertSummary {
    type: AlertType;
    count: number;
    severity: AlertSeverity;
    averageResolutionTime?: number;
    oldestAlert?: Date;
}
export interface OperationsSummary {
    operationId: string;
    name: string;
    status: LogisticsStatus;
    shipCount: number;
    cargoUtilization: number;
    fuelStatus: string;
    estimatedDuration?: number;
}
export interface SupplierPerformance {
    supplierId: string;
    supplierName: string;
    totalOrders: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    averageDeliveryTime: number;
    reliabilityScore: number;
}
export interface ConsumptionReport {
    period: string;
    category: InventoryCategory;
    totalConsumed: number;
    averageDaily: number;
    peakDate: Date;
    peakConsumption: number;
    trend: 'increasing' | 'decreasing' | 'stable';
}
export declare class LogisticsDashboardService {
    private inventoryRepository;
    private alertRepository;
    private logisticsRepository;
    constructor(inventoryRepository?: Repository<FleetInventory>, alertRepository?: Repository<LogisticsAlert>, logisticsRepository?: Repository<FleetLogistics>);
    getDashboardMetrics(fleetId: string): Promise<DashboardMetrics>;
    private getInventoryMetrics;
    private getAlertMetrics;
    private getOperationsMetrics;
    private calculateTrends;
    getCategoryBreakdown(fleetId: string): Promise<CategoryBreakdown[]>;
    getAlertSummary(fleetId: string): Promise<AlertSummary[]>;
    getOperationsSummary(fleetId: string): Promise<OperationsSummary[]>;
    getSupplierPerformance(fleetId: string): Promise<SupplierPerformance[]>;
    getConsumptionReport(fleetId: string, days?: number): Promise<ConsumptionReport[]>;
    getStockValueTrend(fleetId: string, days?: number): Promise<{
        date: string;
        totalValue: number;
        itemCount: number;
    }[]>;
    private getFuelStatus;
}
//# sourceMappingURL=LogisticsDashboardService.d.ts.map