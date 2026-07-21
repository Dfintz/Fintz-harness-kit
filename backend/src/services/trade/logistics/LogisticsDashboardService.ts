import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { FleetInventory, InventoryCategory, StockStatus } from '../../../models/FleetInventory';
import { FleetLogistics, LogisticsStatus } from '../../../models/FleetLogistics';
import {
    AlertSeverity,
    AlertStatus,
    AlertType,
    LogisticsAlert,
} from '../../../models/LogisticsAlert';
import { logger } from '../../../utils/logger';

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
  averageResolutionTime?: number; // in minutes
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

/**
 * Service for generating logistics dashboards and reports
 * Provides comprehensive analytics and KPIs for fleet logistics
 */
export class LogisticsDashboardService {
  private inventoryRepository: Repository<FleetInventory>;
  private alertRepository: Repository<LogisticsAlert>;
  private logisticsRepository: Repository<FleetLogistics>;

  constructor(
    inventoryRepository?: Repository<FleetInventory>,
    alertRepository?: Repository<LogisticsAlert>,
    logisticsRepository?: Repository<FleetLogistics>
  ) {
    this.inventoryRepository = inventoryRepository || AppDataSource.getRepository(FleetInventory);
    this.alertRepository = alertRepository || AppDataSource.getRepository(LogisticsAlert);
    this.logisticsRepository = logisticsRepository || AppDataSource.getRepository(FleetLogistics);
  }

  /**
   * Get comprehensive dashboard metrics
   */
  public async getDashboardMetrics(fleetId: string): Promise<DashboardMetrics> {
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
    } catch (error: unknown) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get inventory metrics
   */
  private async getInventoryMetrics(fleetId: string): Promise<DashboardMetrics['inventory']> {
    // SQL aggregation — replaces loading all items into memory
    const stats = await this.inventoryRepository
      .createQueryBuilder('i')
      .select('COUNT(*)::int', 'totalItems')
      .addSelect('COALESCE(SUM(i."totalValue"), 0)', 'totalValue')
      .addSelect(
        'SUM(CASE WHEN i.status = :statusLow THEN 1 ELSE 0 END)::int',
        'lowStockItems'
      )
      .addSelect(
        'SUM(CASE WHEN i.status = :statusCritical THEN 1 ELSE 0 END)::int',
        'criticalItems'
      )
      .addSelect(
        'SUM(CASE WHEN i.status = :statusOos THEN 1 ELSE 0 END)::int',
        'outOfStockItems'
      )
      .addSelect(
        'SUM(CASE WHEN i.status = :statusAdequate THEN 1 ELSE 0 END)::int',
        'adequateItems'
      )
      .addSelect(
        'COALESCE(AVG(CASE WHEN i."estimatedDaysRemaining" IS NOT NULL THEN i."estimatedDaysRemaining" END)::int, 0)',
        'averageDaysRemaining'
      )
      .where('i."fleetId" = :fleetId', { fleetId })
      .setParameter('statusLow', StockStatus.LOW)
      .setParameter('statusCritical', StockStatus.CRITICAL)
      .setParameter('statusOos', StockStatus.OUT_OF_STOCK)
      .setParameter('statusAdequate', StockStatus.ADEQUATE)
      .getRawOne();

    const activeAlerts = await this.alertRepository.count({
      where: { fleetId, status: AlertStatus.ACTIVE },
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

  /**
   * Get alert metrics
   */
  private async getAlertMetrics(fleetId: string): Promise<DashboardMetrics['alerts']> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SQL aggregation — replaces loading all alerts into memory
    const stats = await this.alertRepository
      .createQueryBuilder('a')
      .select(
        'SUM(CASE WHEN a.status = :statusActive THEN 1 ELSE 0 END)::int',
        'active'
      )
      .addSelect(
        'SUM(CASE WHEN a.severity = :sevCritical AND a.status = :statusActive THEN 1 ELSE 0 END)::int',
        'critical'
      )
      .addSelect(
        'SUM(CASE WHEN a.severity = :sevWarning AND a.status = :statusActive THEN 1 ELSE 0 END)::int',
        'warning'
      )
      .addSelect(
        'SUM(CASE WHEN a."acknowledgedAt" IS NULL AND a.status = :statusActive THEN 1 ELSE 0 END)::int',
        'unacknowledged'
      )
      .addSelect(
        'SUM(CASE WHEN a."resolvedAt" >= :today THEN 1 ELSE 0 END)::int',
        'resolvedToday'
      )
      .where('a."fleetId" = :fleetId', { fleetId })
      .setParameter('statusActive', AlertStatus.ACTIVE)
      .setParameter('sevCritical', AlertSeverity.CRITICAL)
      .setParameter('sevWarning', AlertSeverity.WARNING)
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

  /**
   * Get operations metrics
   */
  private async getOperationsMetrics(fleetId: string): Promise<DashboardMetrics['operations']> {
    // SQL aggregation — replaces loading all operations into memory
    const stats = await this.logisticsRepository
      .createQueryBuilder('o')
      .select(
        'SUM(CASE WHEN o.status = :sInProgress THEN 1 ELSE 0 END)::int',
        'active'
      )
      .addSelect(
        'SUM(CASE WHEN o.status = :sPlanning THEN 1 ELSE 0 END)::int',
        'planning'
      )
      .addSelect(
        'SUM(CASE WHEN o.status = :sCompleted THEN 1 ELSE 0 END)::int',
        'completed'
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN json_array_length(COALESCE(o.ships, '[]')::json) ELSE 0 END)::int, 0)`,
        'totalShips'
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN o."totalCargoCapacity" ELSE 0 END)::int, 0)',
        'totalCargo'
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status IN (:...activeStatuses) THEN o."totalFuelCapacity" ELSE 0 END)::int, 0)',
        'totalFuel'
      )
      .where('o."fleetId" = :fleetId', { fleetId })
      .setParameter('sInProgress', LogisticsStatus.IN_PROGRESS)
      .setParameter('sPlanning', LogisticsStatus.PLANNING)
      .setParameter('sCompleted', LogisticsStatus.COMPLETED)
      .setParameter('activeStatuses', [LogisticsStatus.IN_PROGRESS, LogisticsStatus.READY])
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

  /**
   * Calculate trends
   */
  private async calculateTrends(_fleetId: string): Promise<DashboardMetrics['trends']> {
    // This would analyze historical data to determine trends
    // For now, returning placeholder values
    return {
      stockTrend: 'stable',
      alertTrend: 'stable',
      consumptionTrend: 'normal',
    };
  }

  /**
   * Get category breakdown
   */
  public async getCategoryBreakdown(fleetId: string): Promise<CategoryBreakdown[]> {
    try {
      const items = await this.inventoryRepository.find({
        where: { fleetId },
      });

      const categories = Object.values(InventoryCategory);
      const breakdown: CategoryBreakdown[] = [];

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
          lowStock: categoryItems.filter(i => i.status === StockStatus.LOW).length,
          criticalStock: categoryItems.filter(
            i => i.status === StockStatus.CRITICAL || i.status === StockStatus.OUT_OF_STOCK
          ).length,
          adequateStock: categoryItems.filter(i => i.status === StockStatus.ADEQUATE).length,
          topItems,
        });
      });

      return breakdown.sort((a, b) => b.totalValue - a.totalValue);
    } catch (error: unknown) {
      logger.error('Error getting category breakdown:', error);
      throw error;
    }
  }

  /**
   * Get alert summary by type
   */
  public async getAlertSummary(fleetId: string): Promise<AlertSummary[]> {
    try {
      const alerts = await this.alertRepository.find({
        where: { fleetId },
      });

      const types = Object.values(AlertType);
      const summary: AlertSummary[] = [];

      types.forEach(type => {
        const typeAlerts = alerts.filter(a => a.type === type);

        if (typeAlerts.length === 0) {
          return;
        }

        const resolvedAlerts = typeAlerts.filter(a => a.resolvedAt && a.createdAt);
        const avgResolutionTime =
          resolvedAlerts.length > 0
            ? resolvedAlerts.reduce((sum, a) => {
                // @ts-expect-error - Strict mode compatibility
                const diff = a.resolvedAt.getTime() - a.createdAt.getTime();
                return sum + diff;
              }, 0) /
              resolvedAlerts.length /
              60000 // Convert to minutes
            : undefined;

        const oldestActive = typeAlerts
          .filter(a => a.status === AlertStatus.ACTIVE)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        // Determine most common severity
        const severityCounts: Record<string, number> = {};
        typeAlerts.forEach(a => {
          severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
        });
        const mostCommonSeverity = Object.entries(severityCounts).sort(
          ([, a], [, b]) => b - a
        )[0][0] as AlertSeverity;

        summary.push({
          type,
          count: typeAlerts.length,
          severity: mostCommonSeverity,
          averageResolutionTime: avgResolutionTime ? Math.round(avgResolutionTime) : undefined,
          oldestAlert: oldestActive?.createdAt,
        });
      });

      return summary.sort((a, b) => b.count - a.count);
    } catch (error: unknown) {
      logger.error('Error getting alert summary:', error);
      throw error;
    }
  }

  /**
   * Get operations summary
   */
  public async getOperationsSummary(fleetId: string): Promise<OperationsSummary[]> {
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
          cargoUtilization:
            op.totalCargoCapacity > 0
              ? Math.round((op.totalCargoUsed / op.totalCargoCapacity) * 100)
              : 0,
          fuelStatus: this.getFuelStatus(op),
          estimatedDuration: op.estimatedDuration,
        }))
        .sort((a, b) => {
          // Sort by status priority
          const statusPriority: Record<string, number> = {
            [LogisticsStatus.IN_PROGRESS]: 1,
            [LogisticsStatus.READY]: 2,
            [LogisticsStatus.PLANNING]: 3,
            [LogisticsStatus.COMPLETED]: 4,
            [LogisticsStatus.CANCELLED]: 5,
          };
          return statusPriority[a.status] - statusPriority[b.status];
        });
    } catch (error: unknown) {
      logger.error('Error getting operations summary:', error);
      throw error;
    }
  }

  /**
   * Get supplier performance report
   */
  public async getSupplierPerformance(fleetId: string): Promise<SupplierPerformance[]> {
    try {
      const items = await this.inventoryRepository.find({
        where: { fleetId },
      });

      const supplierMap = new Map<
        string,
        {
          supplierId: string;
          supplierName: string;
          totalOrders: number;
          onTimeDeliveries: number;
          lateDeliveries: number;
          totalDeliveryTime: number;
          items: FleetInventory[];
        }
      >();

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
        if (!supplier) {return;}
        supplier.items.push(item);

        // Calculate delivery metrics (simplified - would need actual order data)
        if (item.lastRestockDate) {
          supplier.totalOrders++;
          // Assume on-time if stock is adequate
          if (item.status === StockStatus.ADEQUATE) {
            supplier.onTimeDeliveries++;
          } else {
            supplier.lateDeliveries++;
          }
        }
      });

      const performance: SupplierPerformance[] = [];

      supplierMap.forEach(supplier => {
        const onTimeRate =
          supplier.totalOrders > 0 ? supplier.onTimeDeliveries / supplier.totalOrders : 0;

        performance.push({
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          totalOrders: supplier.totalOrders,
          onTimeDeliveries: supplier.onTimeDeliveries,
          lateDeliveries: supplier.lateDeliveries,
          averageDeliveryTime: 0, // Would need actual order data
          reliabilityScore: Math.round(onTimeRate * 100),
        });
      });

      return performance.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    } catch (error: unknown) {
      logger.error('Error getting supplier performance:', error);
      throw error;
    }
  }

  /**
   * Get consumption report
   */
  public async getConsumptionReport(
    fleetId: string,
    days: number = 30
  ): Promise<ConsumptionReport[]> {
    try {
      // This would analyze historical transaction data
      // For now, returning estimated data based on consumption rates
      const items = await this.inventoryRepository.find({
        where: { fleetId },
      });

      const categoryMap = new Map<
        InventoryCategory,
        { totalConsumption: number; itemCount: number }
      >();

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
        if (!cat) {return;}
        cat.totalConsumption += Number(item.averageConsumptionRate) * days;
        cat.itemCount++;
      });

      const reports: ConsumptionReport[] = [];

      categoryMap.forEach((data, category) => {
        reports.push({
          period: `Last ${days} days`,
          category,
          totalConsumed: Math.round(data.totalConsumption),
          averageDaily: Math.round(data.totalConsumption / days),
          peakDate: new Date(), // Would need actual transaction data
          peakConsumption: Math.round((data.totalConsumption / days) * 1.5), // Estimate
          trend: 'stable',
        });
      });

      return reports.sort((a, b) => b.totalConsumed - a.totalConsumed);
    } catch (error: unknown) {
      logger.error('Error getting consumption report:', error);
      throw error;
    }
  }

  /**
   * Get stock value trend
   */
  public async getStockValueTrend(
    fleetId: string,
    days: number = 30
  ): Promise<{ date: string; totalValue: number; itemCount: number }[]> {
    try {
      // This would analyze historical data
      // For now, returning current snapshot
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
          totalValue: totalValue * (0.95 + Math.random() * 0.1), // Simulated variation
          itemCount: items.length,
        });
      }

      return trend;
    } catch (error: unknown) {
      logger.error('Error getting stock value trend:', error);
      throw error;
    }
  }

  // Helper methods
  private getFuelStatus(operation: FleetLogistics): string {
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

