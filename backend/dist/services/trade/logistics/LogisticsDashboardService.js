"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsDashboardService = void 0;
const data_source_1 = require("../../../data-source");
const FleetInventory_1 = require("../../../models/FleetInventory");
const FleetLogistics_1 = require("../../../models/FleetLogistics");
const LogisticsAlert_1 = require("../../../models/LogisticsAlert");
const logger_1 = require("../../../utils/logger");
class LogisticsDashboardService {
    inventoryRepository;
    alertRepository;
    logisticsRepository;
    constructor(inventoryRepository, alertRepository, logisticsRepository) {
        this.inventoryRepository = inventoryRepository || data_source_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory);
        this.alertRepository = alertRepository || data_source_1.AppDataSource.getRepository(LogisticsAlert_1.LogisticsAlert);
        this.logisticsRepository = logisticsRepository || data_source_1.AppDataSource.getRepository(FleetLogistics_1.FleetLogistics);
    }
    async getDashboardMetrics(fleetId) {
        try {
            const [inventoryMetrics, alertMetrics, operationsMetrics] = await Promise.all([
                this.getInventoryMetrics(fleetId),
                this.getAlertMetrics(fleetId),
                this.getOperationsMetrics(fleetId),
            ]);
            const trends = await this.calculateTrends(fleetId);
            return {
                inventory: inventoryMetrics,
                alerts: alertMetrics,
                operations: operationsMetrics,
                trends,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting dashboard metrics:', error);
            throw error;
        }
    }
    async getInventoryMetrics(fleetId) {
        const stats = await this.inventoryRepository
            .createQueryBuilder('i')
            .select('COUNT(*)::int', 'totalItems')
            .addSelect('COALESCE(SUM(i."totalValue"), 0)', 'totalValue')
            .addSelect('SUM(CASE WHEN i.status = :statusLow THEN 1 ELSE 0 END)::int', 'lowStockItems')
            .addSelect('SUM(CASE WHEN i.status = :statusCritical THEN 1 ELSE 0 END)::int', 'criticalItems')
            .addSelect('SUM(CASE WHEN i.status = :statusOos THEN 1 ELSE 0 END)::int', 'outOfStockItems')
            .addSelect('SUM(CASE WHEN i.status = :statusAdequate THEN 1 ELSE 0 END)::int', 'adequateItems')
            .addSelect('COALESCE(AVG(CASE WHEN i."estimatedDaysRemaining" IS NOT NULL THEN i."estimatedDaysRemaining" END)::int, 0)', 'averageDaysRemaining')
            .where('i."fleetId" = :fleetId', { fleetId })
            .setParameter('statusLow', FleetInventory_1.StockStatus.LOW)
            .setParameter('statusCritical', FleetInventory_1.StockStatus.CRITICAL)
            .setParameter('statusOos', FleetInventory_1.StockStatus.OUT_OF_STOCK)
            .setParameter('statusAdequate', FleetInventory_1.StockStatus.ADEQUATE)
            .getRawOne();
        const activeAlerts = await this.alertRepository.count({
            where: { fleetId, status: LogisticsAlert_1.AlertStatus.ACTIVE },
        });
        return {
            totalItems: stats?.totalItems ?? 0,
            totalValue: Number(stats?.totalValue ?? 0),
            lowStockItems: stats?.lowStockItems ?? 0,
            criticalItems: stats?.criticalItems ?? 0,
            outOfStockItems: stats?.outOfStockItems ?? 0,
            adequateItems: stats?.adequateItems ?? 0,
            averageDaysRemaining: stats?.averageDaysRemaining ?? 0,
            totalAlerts: activeAlerts,
        };
    }
    async getAlertMetrics(fleetId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const stats = await this.alertRepository
            .createQueryBuilder('a')
            .select('SUM(CASE WHEN a.status = :statusActive THEN 1 ELSE 0 END)::int', 'active')
            .addSelect('SUM(CASE WHEN a.severity = :sevCritical AND a.status = :statusActive THEN 1 ELSE 0 END)::int', 'critical')
            .addSelect('SUM(CASE WHEN a.severity = :sevWarning AND a.status = :statusActive THEN 1 ELSE 0 END)::int', 'warning')
            .addSelect('SUM(CASE WHEN a."acknowledgedAt" IS NULL AND a.status = :statusActive THEN 1 ELSE 0 END)::int', 'unacknowledged')
            .addSelect('SUM(CASE WHEN a."resolvedAt" >= :today THEN 1 ELSE 0 END)::int', 'resolvedToday')
            .where('a."fleetId" = :fleetId', { fleetId })
            .setParameter('statusActive', LogisticsAlert_1.AlertStatus.ACTIVE)
            .setParameter('sevCritical', LogisticsAlert_1.AlertSeverity.CRITICAL)
            .setParameter('sevWarning', LogisticsAlert_1.AlertSeverity.WARNING)
            .setParameter('today', today)
            .getRawOne();
        return {
            active: stats?.active ?? 0,
            critical: stats?.critical ?? 0,
            warning: stats?.warning ?? 0,
            unacknowledged: stats?.unacknowledged ?? 0,
            resolvedToday: stats?.resolvedToday ?? 0,
        };
    }
    async getOperationsMetrics(fleetId) {
        const stats = await this.logisticsRepository
            .createQueryBuilder('o')
            .select('SUM(CASE WHEN o.status = :sInProgress THEN 1 ELSE 0 END)::int', 'active')
            .addSelect('SUM(CASE WHEN o.status = :sPlanning THEN 1 ELSE 0 END)::int', 'planning')
            .addSelect('SUM(CASE WHEN o.status = :sCompleted THEN 1 ELSE 0 END)::int', 'completed')
            .addSelect(`COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN json_array_length(COALESCE(o.ships, '[]')::json) ELSE 0 END)::int, 0)`, 'totalShips')
            .addSelect('COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN o."totalCargoCapacity" ELSE 0 END)::int, 0)', 'totalCargo')
            .addSelect('COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN o."totalFuelCapacity" ELSE 0 END)::int, 0)', 'totalFuel')
            .where('o."fleetId" = :fleetId', { fleetId })
            .setParameter('sInProgress', FleetLogistics_1.LogisticsStatus.IN_PROGRESS)
            .setParameter('sPlanning', FleetLogistics_1.LogisticsStatus.PLANNING)
            .setParameter('sCompleted', FleetLogistics_1.LogisticsStatus.COMPLETED)
            .setParameter('activeStatuses', [FleetLogistics_1.LogisticsStatus.IN_PROGRESS, FleetLogistics_1.LogisticsStatus.READY])
            .getRawOne();
        return {
            active: stats?.active ?? 0,
            planning: stats?.planning ?? 0,
            completed: stats?.completed ?? 0,
            totalShips: stats?.totalShips ?? 0,
            totalCargo: stats?.totalCargo ?? 0,
            totalFuel: stats?.totalFuel ?? 0,
        };
    }
    async calculateTrends(_fleetId) {
        return {
            stockTrend: 'stable',
            alertTrend: 'stable',
            consumptionTrend: 'normal',
        };
    }
    async getCategoryBreakdown(fleetId) {
        try {
            const items = await this.inventoryRepository.find({
                where: { fleetId },
            });
            const categories = Object.values(FleetInventory_1.InventoryCategory);
            const breakdown = [];
            categories.forEach(category => {
                const categoryItems = items.filter(i => i.category === category);
                if (categoryItems.length === 0) {
                    return;
                }
                const topItems = categoryItems
                    .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
                    .slice(0, 5)
                    .map(i => ({
                    name: i.itemName,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                    status: i.status,
                    value: Number(i.totalValue || 0),
                }));
                breakdown.push({
                    category,
                    totalItems: categoryItems.length,
                    totalValue: categoryItems.reduce((sum, i) => sum + (i.totalValue || 0), 0),
                    lowStock: categoryItems.filter(i => i.status === FleetInventory_1.StockStatus.LOW).length,
                    criticalStock: categoryItems.filter(i => i.status === FleetInventory_1.StockStatus.CRITICAL || i.status === FleetInventory_1.StockStatus.OUT_OF_STOCK).length,
                    adequateStock: categoryItems.filter(i => i.status === FleetInventory_1.StockStatus.ADEQUATE).length,
                    topItems,
                });
            });
            return breakdown.sort((a, b) => b.totalValue - a.totalValue);
        }
        catch (error) {
            logger_1.logger.error('Error getting category breakdown:', error);
            throw error;
        }
    }
    async getAlertSummary(fleetId) {
        try {
            const alerts = await this.alertRepository.find({
                where: { fleetId },
            });
            const types = Object.values(LogisticsAlert_1.AlertType);
            const summary = [];
            types.forEach(type => {
                const typeAlerts = alerts.filter(a => a.type === type);
                if (typeAlerts.length === 0) {
                    return;
                }
                const resolvedAlerts = typeAlerts.filter(a => a.resolvedAt && a.createdAt);
                const avgResolutionTime = resolvedAlerts.length > 0
                    ? resolvedAlerts.reduce((sum, a) => {
                        const diff = a.resolvedAt.getTime() - a.createdAt.getTime();
                        return sum + diff;
                    }, 0) /
                        resolvedAlerts.length /
                        60000
                    : undefined;
                const oldestActive = typeAlerts
                    .filter(a => a.status === LogisticsAlert_1.AlertStatus.ACTIVE)
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
                const severityCounts = {};
                typeAlerts.forEach(a => {
                    severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
                });
                const mostCommonSeverity = Object.entries(severityCounts).sort(([, a], [, b]) => b - a)[0][0];
                summary.push({
                    type,
                    count: typeAlerts.length,
                    severity: mostCommonSeverity,
                    averageResolutionTime: avgResolutionTime ? Math.round(avgResolutionTime) : undefined,
                    oldestAlert: oldestActive?.createdAt,
                });
            });
            return summary.sort((a, b) => b.count - a.count);
        }
        catch (error) {
            logger_1.logger.error('Error getting alert summary:', error);
            throw error;
        }
    }
    async getOperationsSummary(fleetId) {
        try {
            const operations = await this.logisticsRepository.find({
                where: { fleetId },
            });
            return operations
                .map(op => ({
                operationId: op.id,
                name: op.operationName,
                status: op.status,
                shipCount: op.ships.length,
                cargoUtilization: op.totalCargoCapacity > 0
                    ? Math.round((op.totalCargoUsed / op.totalCargoCapacity) * 100)
                    : 0,
                fuelStatus: this.getFuelStatus(op),
                estimatedDuration: op.estimatedDuration,
            }))
                .sort((a, b) => {
                const statusPriority = {
                    [FleetLogistics_1.LogisticsStatus.IN_PROGRESS]: 1,
                    [FleetLogistics_1.LogisticsStatus.READY]: 2,
                    [FleetLogistics_1.LogisticsStatus.PLANNING]: 3,
                    [FleetLogistics_1.LogisticsStatus.COMPLETED]: 4,
                    [FleetLogistics_1.LogisticsStatus.CANCELLED]: 5,
                };
                return statusPriority[a.status] - statusPriority[b.status];
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting operations summary:', error);
            throw error;
        }
    }
    async getSupplierPerformance(fleetId) {
        try {
            const items = await this.inventoryRepository.find({
                where: { fleetId },
            });
            const supplierMap = new Map();
            items.forEach(item => {
                if (!item.supplierId || !item.supplierName) {
                    return;
                }
                if (!supplierMap.has(item.supplierId)) {
                    supplierMap.set(item.supplierId, {
                        supplierId: item.supplierId,
                        supplierName: item.supplierName,
                        totalOrders: 0,
                        onTimeDeliveries: 0,
                        lateDeliveries: 0,
                        totalDeliveryTime: 0,
                        items: [],
                    });
                }
                const supplier = supplierMap.get(item.supplierId);
                if (!supplier) {
                    return;
                }
                supplier.items.push(item);
                if (item.lastRestockDate) {
                    supplier.totalOrders++;
                    if (item.status === FleetInventory_1.StockStatus.ADEQUATE) {
                        supplier.onTimeDeliveries++;
                    }
                    else {
                        supplier.lateDeliveries++;
                    }
                }
            });
            const performance = [];
            supplierMap.forEach(supplier => {
                const onTimeRate = supplier.totalOrders > 0 ? supplier.onTimeDeliveries / supplier.totalOrders : 0;
                performance.push({
                    supplierId: supplier.supplierId,
                    supplierName: supplier.supplierName,
                    totalOrders: supplier.totalOrders,
                    onTimeDeliveries: supplier.onTimeDeliveries,
                    lateDeliveries: supplier.lateDeliveries,
                    averageDeliveryTime: 0,
                    reliabilityScore: Math.round(onTimeRate * 100),
                });
            });
            return performance.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
        }
        catch (error) {
            logger_1.logger.error('Error getting supplier performance:', error);
            throw error;
        }
    }
    async getConsumptionReport(fleetId, days = 30) {
        try {
            const items = await this.inventoryRepository.find({
                where: { fleetId },
            });
            const categoryMap = new Map();
            items.forEach(item => {
                if (!item.averageConsumptionRate) {
                    return;
                }
                if (!categoryMap.has(item.category)) {
                    categoryMap.set(item.category, {
                        totalConsumption: 0,
                        itemCount: 0,
                    });
                }
                const cat = categoryMap.get(item.category);
                if (!cat) {
                    return;
                }
                cat.totalConsumption += Number(item.averageConsumptionRate) * days;
                cat.itemCount++;
            });
            const reports = [];
            categoryMap.forEach((data, category) => {
                reports.push({
                    period: `Last ${days} days`,
                    category,
                    totalConsumed: Math.round(data.totalConsumption),
                    averageDaily: Math.round(data.totalConsumption / days),
                    peakDate: new Date(),
                    peakConsumption: Math.round((data.totalConsumption / days) * 1.5),
                    trend: 'stable',
                });
            });
            return reports.sort((a, b) => b.totalConsumed - a.totalConsumed);
        }
        catch (error) {
            logger_1.logger.error('Error getting consumption report:', error);
            throw error;
        }
    }
    async getStockValueTrend(fleetId, days = 30) {
        try {
            const items = await this.inventoryRepository.find({
                where: { fleetId },
            });
            const totalValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);
            const trend = [];
            const today = new Date();
            for (let i = days; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                trend.push({
                    date: date.toISOString().split('T')[0],
                    totalValue: totalValue * (0.95 + Math.random() * 0.1),
                    itemCount: items.length,
                });
            }
            return trend;
        }
        catch (error) {
            logger_1.logger.error('Error getting stock value trend:', error);
            throw error;
        }
    }
    getFuelStatus(operation) {
        if (operation.totalFuelCapacity === 0) {
            return 'Unknown';
        }
        const fuelAvailable = operation.ships.reduce((sum, ship) => sum + ship.currentFuel, 0);
        const fuelPercentage = (fuelAvailable / operation.totalFuelCapacity) * 100;
        if (fuelPercentage >= 80) {
            return 'Excellent';
        }
        if (fuelPercentage >= 50) {
            return 'Good';
        }
        if (fuelPercentage >= 30) {
            return 'Fair';
        }
        if (fuelPercentage >= 10) {
            return 'Low';
        }
        return 'Critical';
    }
}
exports.LogisticsDashboardService = LogisticsDashboardService;
//# sourceMappingURL=LogisticsDashboardService.js.map