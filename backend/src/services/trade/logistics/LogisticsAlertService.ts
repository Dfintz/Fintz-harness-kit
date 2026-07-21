import { In, IsNull } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { FleetInventory, StockStatus } from '../../../models/FleetInventory';
import {
  AlertFilterOptions,
  AlertRecipient,
  AlertSeverity,
  AlertStatus,
  AlertType,
  CreateAlertDto,
  LogisticsAlert,
  NotificationChannel,
  UpdateAlertDto,
} from '../../../models/LogisticsAlert';
import { logger } from '../../../utils/logger';

/**
 * Predictive restocking recommendation
 */
export interface RestockRecommendation {
  itemId: string;
  itemName: string;
  category: string;
  currentQuantity: number;
  predictedDaysUntilStockout: number;
  recommendedRestockDate: Date;
  recommendedOrderQuantity: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  priceEstimate?: number;
  suggestedSupplier?: string;
}

/**
 * Service for managing logistics alerts and notifications
 * Handles automated alert generation, notification sending, and alert lifecycle
 */
export class LogisticsAlertService {
  private alertRepository = AppDataSource.getRepository(LogisticsAlert);
  private inventoryRepository = AppDataSource.getRepository(FleetInventory);

  /**
   * Check inventory levels and generate alerts for low stock
   * Should be called periodically (e.g., every hour)
   */
  public async checkInventoryAndGenerateAlerts(fleetId?: string): Promise<LogisticsAlert[]> {
    try {
      const whereConditions: Record<string, unknown> = {};
      if (fleetId) {
        whereConditions.fleetId = fleetId;
      }
      whereConditions.alertEnabled = true;

      const inventoryItems = await this.inventoryRepository.find({
        where: whereConditions,
      });

      const generatedAlerts: LogisticsAlert[] = [];

      for (const item of inventoryItems) {
        // Update stock status based on thresholds
        const oldStatus = item.status;
        item.status = this.calculateStockStatus(item.quantity, item.thresholds);

        // Generate alerts based on status changes
        if (item.status !== oldStatus) {
          const alert = await this.generateAlertForItem(item);
          if (alert) {
            generatedAlerts.push(alert);
          }
        }

        // Check for restock due dates
        if (item.nextRestockDate && new Date() >= item.nextRestockDate) {
          const restockAlert = await this.generateRestockDueAlert(item);
          if (restockAlert) {
            generatedAlerts.push(restockAlert);
          }
        }

        // Check consumption rate spikes
        if (item.averageConsumptionRate && item.estimatedDaysRemaining !== undefined) {
          if (item.estimatedDaysRemaining < 7 && item.status === StockStatus.ADEQUATE) {
            const consumptionAlert = await this.generateConsumptionSpikeAlert(item);
            if (consumptionAlert) {
              generatedAlerts.push(consumptionAlert);
            }
          }
        }

        await this.inventoryRepository.save(item);
      }

      logger.info(`Generated ${generatedAlerts.length} alerts for fleet ${fleetId || 'all'}`);
      return generatedAlerts;
    } catch (error: unknown) {
      logger.error('Error checking inventory and generating alerts:', error);
      throw error;
    }
  }

  /**
   * Calculate stock status based on quantity and thresholds
   */
  private calculateStockStatus(
    quantity: number,
    thresholds: { criticalLevel: number; lowLevel: number }
  ): StockStatus {
    if (quantity <= 0) {
      return StockStatus.OUT_OF_STOCK;
    } else if (quantity <= thresholds.criticalLevel) {
      return StockStatus.CRITICAL;
    } else if (quantity <= thresholds.lowLevel) {
      return StockStatus.LOW;
    }
    return StockStatus.ADEQUATE;
  }

  /**
   * Generate alert for inventory item based on status
   */
  private async generateAlertForItem(item: FleetInventory): Promise<LogisticsAlert | null> {
    try {
      // Check if similar alert already exists and is active
      const existingAlert = await this.alertRepository.findOne({
        where: {
          inventoryItemId: item.id,
          type: this.getAlertTypeForStatus(item.status),
          status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
        },
      });

      if (existingAlert) {
        // Update existing alert
        existingAlert.repeatCount += 1;
        existingAlert.lastTriggeredAt = new Date();
        existingAlert.metadata = {
          ...existingAlert.metadata,
          currentQuantity: Number(item.quantity),
          threshold: this.getThresholdForStatus(item.status, item.thresholds),
          unit: item.unit,
          category: item.category,
          daysRemaining: item.estimatedDaysRemaining,
        };
        return await this.alertRepository.save(existingAlert);
      }

      // Create new alert
      const alert = this.alertRepository.create({
        fleetId: item.fleetId,
        inventoryItemId: item.id,
        itemName: item.itemName,
        type: this.getAlertTypeForStatus(item.status),
        severity: this.getSeverityForStatus(item.status),
        status: AlertStatus.ACTIVE,
        title: this.getAlertTitle(item),
        message: this.getAlertMessage(item),
        metadata: {
          currentQuantity: Number(item.quantity),
          threshold: this.getThresholdForStatus(item.status, item.thresholds),
          unit: item.unit,
          category: item.category,
          location:
            typeof item.location === 'string'
              ? item.location
              : ((item.location as Record<string, unknown>)?.name as string) || '',
          daysRemaining: item.estimatedDaysRemaining,
          consumptionRate: item.averageConsumptionRate
            ? Number(item.averageConsumptionRate)
            : undefined,
        },
        recipients: this.getRecipientsForItem(item),
        notificationChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        autoResolve: true,
        repeatCount: 1,
        lastTriggeredAt: new Date(),
      });

      const saved = await this.alertRepository.save(alert);
      return Array.isArray(saved) ? saved[0] : saved;
    } catch (error: unknown) {
      logger.error(`Error generating alert for item ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Generate restock due alert
   */
  private async generateRestockDueAlert(item: FleetInventory): Promise<LogisticsAlert | null> {
    try {
      const alert = this.alertRepository.create({
        fleetId: item.fleetId,
        inventoryItemId: item.id,
        itemName: item.itemName,
        type: AlertType.RESTOCK_DUE,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        title: `Restock Due: ${item.itemName}`,
        message: `Scheduled restock date has passed for ${item.itemName}. Current quantity: ${item.quantity} ${item.unit}`,
        metadata: {
          currentQuantity: Number(item.quantity),
          unit: item.unit,
          category: item.category,
          nextRestockDate: item.nextRestockDate,
          supplier: item.supplierName,
        },
        recipients: this.getRecipientsForItem(item),
        notificationChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        autoResolve: false,
      });

      return await this.alertRepository.save(alert);
    } catch (error: unknown) {
      logger.error(`Error generating restock alert for item ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Generate consumption spike alert
   */
  private async generateConsumptionSpikeAlert(
    item: FleetInventory
  ): Promise<LogisticsAlert | null> {
    try {
      const alert = this.alertRepository.create({
        fleetId: item.fleetId,
        inventoryItemId: item.id,
        itemName: item.itemName,
        type: AlertType.CONSUMPTION_SPIKE,
        severity: AlertSeverity.INFO,
        status: AlertStatus.ACTIVE,
        title: `High Consumption Rate: ${item.itemName}`,
        message: `Consumption rate is higher than expected. Estimated ${item.estimatedDaysRemaining} days remaining.`,
        metadata: {
          currentQuantity: Number(item.quantity),
          unit: item.unit,
          daysRemaining: item.estimatedDaysRemaining,
          consumptionRate: item.averageConsumptionRate
            ? Number(item.averageConsumptionRate)
            : undefined,
          category: item.category,
        },
        recipients: this.getRecipientsForItem(item),
        notificationChannels: [NotificationChannel.IN_APP],
        autoResolve: true,
      });

      return await this.alertRepository.save(alert);
    } catch (error: unknown) {
      logger.error(`Error generating consumption spike alert for item ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Create a custom alert
   */
  public async createAlert(dto: CreateAlertDto): Promise<LogisticsAlert> {
    try {
      const alert = this.alertRepository.create({
        ...dto,
        status: AlertStatus.ACTIVE,
        notificationSent: false,
        repeatCount: 1,
        lastTriggeredAt: new Date(),
      });

      const savedAlert = await this.alertRepository.save(alert);
      logger.info(`Created custom alert: ${savedAlert.id}`);
      return savedAlert;
    } catch (error: unknown) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Get alerts with filtering
   */
  public async getAlerts(filters: AlertFilterOptions): Promise<LogisticsAlert[]> {
    try {
      const whereConditions: Record<string, unknown> = {};

      if (filters.fleetId) {
        whereConditions.fleetId = filters.fleetId;
      }

      if (filters.inventoryItemId) {
        whereConditions.inventoryItemId = filters.inventoryItemId;
      }

      if (filters.type) {
        whereConditions.type = Array.isArray(filters.type) ? In(filters.type) : filters.type;
      }

      if (filters.severity) {
        whereConditions.severity = Array.isArray(filters.severity)
          ? In(filters.severity)
          : filters.severity;
      }

      if (filters.status) {
        whereConditions.status = Array.isArray(filters.status)
          ? In(filters.status)
          : filters.status;
      }

      if (filters.unacknowledgedOnly) {
        whereConditions.acknowledgedAt = IsNull();
      }

      if (filters.activeOnly) {
        whereConditions.status = AlertStatus.ACTIVE;
      }

      const alerts = await this.alertRepository.find({
        where: whereConditions,
        order: { createdAt: 'DESC' },
      });

      return alerts;
    } catch (error: unknown) {
      logger.error('Error getting alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert by ID
   */
  public async getAlertById(id: string): Promise<LogisticsAlert | null> {
    try {
      return await this.alertRepository.findOne({ where: { id } });
    } catch (error: unknown) {
      logger.error(`Error getting alert ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update alert
   */
  public async updateAlert(id: string, dto: UpdateAlertDto): Promise<LogisticsAlert> {
    try {
      const alert = await this.alertRepository.findOne({ where: { id } });

      if (!alert) {
        throw new Error(`Alert ${id} not found`);
      }

      if (dto.status) {
        alert.status = dto.status;
      }

      if (dto.acknowledgedBy) {
        alert.acknowledgedBy = dto.acknowledgedBy;
        alert.acknowledgedAt = new Date();
        alert.status = AlertStatus.ACKNOWLEDGED;
      }

      if (dto.resolvedBy) {
        alert.resolvedBy = dto.resolvedBy;
        alert.resolvedAt = new Date();
        alert.status = AlertStatus.RESOLVED;
        alert.resolutionNotes = dto.resolutionNotes;
      }

      const updatedAlert = await this.alertRepository.save(alert);
      logger.info(`Updated alert: ${id}`);
      return updatedAlert;
    } catch (error: unknown) {
      logger.error(`Error updating alert ${id}:`, error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  public async acknowledgeAlert(id: string, userId: string): Promise<LogisticsAlert> {
    return this.updateAlert(id, { acknowledgedBy: userId });
  }

  /**
   * Resolve alert
   */
  public async resolveAlert(id: string, userId: string, notes?: string): Promise<LogisticsAlert> {
    return this.updateAlert(id, { resolvedBy: userId, resolutionNotes: notes });
  }

  /**
   * Dismiss alert
   */
  public async dismissAlert(id: string): Promise<LogisticsAlert> {
    return this.updateAlert(id, { status: AlertStatus.DISMISSED });
  }

  /**
   * Delete alert
   */
  public async deleteAlert(id: string): Promise<void> {
    try {
      await this.alertRepository.delete(id);
      logger.info(`Deleted alert: ${id}`);
    } catch (error: unknown) {
      logger.error(`Error deleting alert ${id}:`, error);
      throw error;
    }
  }

  /**
   * Auto-resolve alerts when conditions are no longer met
   */
  public async autoResolveAlerts(): Promise<number> {
    try {
      const activeAlerts = await this.alertRepository.find({
        where: {
          status: In([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
          autoResolve: true,
        },
      });

      let resolvedCount = 0;

      for (const alert of activeAlerts) {
        const item = await this.inventoryRepository.findOne({
          where: { id: alert.inventoryItemId },
        });

        if (!item) {
          continue;
        }

        let shouldResolve = false;

        // Check if conditions for alert are no longer met
        if (alert.type === AlertType.LOW_STOCK && item.status !== StockStatus.LOW) {
          shouldResolve = true;
        }
        if (alert.type === AlertType.CRITICAL_STOCK && item.status !== StockStatus.CRITICAL) {
          shouldResolve = true;
        }
        if (alert.type === AlertType.OUT_OF_STOCK && item.status !== StockStatus.OUT_OF_STOCK) {
          shouldResolve = true;
        }

        if (shouldResolve) {
          alert.status = AlertStatus.RESOLVED;
          alert.resolvedAt = new Date();
          alert.resolvedBy = 'system';
          alert.resolutionNotes = 'Auto-resolved: conditions no longer met';
          await this.alertRepository.save(alert);
          resolvedCount++;
        }
      }

      logger.info(`Auto-resolved ${resolvedCount} alerts`);
      return resolvedCount;
    } catch (error: unknown) {
      logger.error('Error auto-resolving alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  public async getAlertStatistics(fleetId: string): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    dismissed: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    try {
      const alerts = await this.getAlerts({ fleetId });

      const stats = {
        total: alerts.length,
        active: alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
        acknowledged: alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length,
        resolved: alerts.filter(a => a.status === AlertStatus.RESOLVED).length,
        dismissed: alerts.filter(a => a.status === AlertStatus.DISMISSED).length,
        bySeverity: {
          critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
          urgent: alerts.filter(a => a.severity === AlertSeverity.URGENT).length,
          warning: alerts.filter(a => a.severity === AlertSeverity.WARNING).length,
          info: alerts.filter(a => a.severity === AlertSeverity.INFO).length,
        },
        byType: {
          lowStock: alerts.filter(a => a.type === AlertType.LOW_STOCK).length,
          criticalStock: alerts.filter(a => a.type === AlertType.CRITICAL_STOCK).length,
          outOfStock: alerts.filter(a => a.type === AlertType.OUT_OF_STOCK).length,
          restockDue: alerts.filter(a => a.type === AlertType.RESTOCK_DUE).length,
          consumptionSpike: alerts.filter(a => a.type === AlertType.CONSUMPTION_SPIKE).length,
        },
      };

      return stats;
    } catch (error: unknown) {
      logger.error('Error getting alert statistics:', error);
      throw error;
    }
  }

  // Helper methods
  private getAlertTypeForStatus(status: StockStatus): AlertType {
    switch (status) {
      case StockStatus.OUT_OF_STOCK:
        return AlertType.OUT_OF_STOCK;
      case StockStatus.CRITICAL:
        return AlertType.CRITICAL_STOCK;
      case StockStatus.LOW:
        return AlertType.LOW_STOCK;
      default:
        return AlertType.CUSTOM;
    }
  }

  private getSeverityForStatus(status: StockStatus): AlertSeverity {
    switch (status) {
      case StockStatus.OUT_OF_STOCK:
        return AlertSeverity.URGENT;
      case StockStatus.CRITICAL:
        return AlertSeverity.CRITICAL;
      case StockStatus.LOW:
        return AlertSeverity.WARNING;
      default:
        return AlertSeverity.INFO;
    }
  }

  private getThresholdForStatus(
    status: StockStatus,
    thresholds: { criticalLevel: number; lowLevel: number; targetLevel?: number }
  ): number {
    switch (status) {
      case StockStatus.OUT_OF_STOCK:
        return 0;
      case StockStatus.CRITICAL:
        return thresholds.criticalLevel;
      case StockStatus.LOW:
        return thresholds.lowLevel;
      default:
        return thresholds.targetLevel || 0;
    }
  }

  private getAlertTitle(item: FleetInventory): string {
    switch (item.status) {
      case StockStatus.OUT_OF_STOCK:
        return `OUT OF STOCK: ${item.itemName}`;
      case StockStatus.CRITICAL:
        return `CRITICAL: Low Stock - ${item.itemName}`;
      case StockStatus.LOW:
        return `Low Stock Alert: ${item.itemName}`;
      default:
        return `Stock Alert: ${item.itemName}`;
    }
  }

  private getAlertMessage(item: FleetInventory): string {
    const location = item.location
      ? `at ${item.location.shipName || item.location.stationName || 'unknown location'}`
      : '';

    switch (item.status) {
      case StockStatus.OUT_OF_STOCK:
        return `${item.itemName} is out of stock ${location}. Immediate restocking required.`;
      case StockStatus.CRITICAL:
        return `${item.itemName} stock is critically low ${location}. Current: ${item.quantity} ${item.unit}, Critical threshold: ${item.thresholds.criticalLevel} ${item.unit}`;
      case StockStatus.LOW:
        return `${item.itemName} stock is running low ${location}. Current: ${item.quantity} ${item.unit}, Low threshold: ${item.thresholds.lowLevel} ${item.unit}`;
      default:
        return `Stock level change detected for ${item.itemName}.`;
    }
  }

  private getRecipientsForItem(item: FleetInventory): AlertRecipient[] {
    // In production, this would fetch actual recipients from database
    return [{ userId: item.managerId }];
  }

  // ==================== PREDICTIVE RESTOCKING ====================

  /**
   * Get predictive restocking recommendations for a fleet or organization
   * Uses consumption patterns and historical data to predict when items will need restocking
   * @param organizationId - Organization ID
   * @param fleetId - Optional fleet ID to filter
   * @returns Array of restock recommendations
   */
  public async getPredictiveRestockRecommendations(
    organizationId: string,
    fleetId?: string
  ): Promise<RestockRecommendation[]> {
    try {
      // Load only items that have consumption data and could need restocking
      // (items with no consumption rate or very high stock are filtered at DB level)
      const qb = this.inventoryRepository
        .createQueryBuilder('item')
        .where('item.organizationId = :organizationId', { organizationId })
        .andWhere('item.averageConsumptionRate > 0');

      if (fleetId) {
        qb.andWhere('item.fleetId = :fleetId', { fleetId });
      }

      const inventoryItems = await qb.getMany();

      const recommendations: RestockRecommendation[] = [];

      for (const item of inventoryItems) {
        const recommendation = this.calculateRestockRecommendation(item);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      // Sort by urgency (days until stockout)
      recommendations.sort((a, b) => a.predictedDaysUntilStockout - b.predictedDaysUntilStockout);

      logger.info(`Generated ${recommendations.length} restock recommendations`, {
        organizationId,
        fleetId,
      });

      return recommendations;
    } catch (error: unknown) {
      logger.error('Error generating predictive restock recommendations:', error);
      throw error;
    }
  }

  /**
   * Calculate restocking recommendation for a single inventory item
   */
  private calculateRestockRecommendation(item: FleetInventory): RestockRecommendation | null {
    // Only generate recommendations for items with consumption data
    if (!item.averageConsumptionRate || item.averageConsumptionRate <= 0) {
      return null;
    }

    // Calculate days until stockout
    const daysUntilStockout = Math.floor(item.quantity / item.averageConsumptionRate);

    // Skip items that have plenty of stock (more than 90 days)
    if (daysUntilStockout > 90) {
      return null;
    }

    // Calculate recommended restock date (order when 14 days of stock remaining)
    const orderLeadTimeDays = 7; // Assume 7 days for delivery
    const safetyStockDays = 14; // Keep 14 days of safety stock
    const orderTriggerDays = orderLeadTimeDays + safetyStockDays;

    const recommendedRestockDate = new Date();
    recommendedRestockDate.setDate(
      recommendedRestockDate.getDate() + Math.max(0, daysUntilStockout - orderTriggerDays)
    );

    // Calculate order quantity to bring stock up to target level + buffer
    const targetLevel = item.thresholds?.targetLevel || item.quantity * 2;
    const bufferDays = 30; // Order enough for 30 days beyond target
    const orderQuantity = Math.max(
      0,
      targetLevel - item.quantity + item.averageConsumptionRate * bufferDays
    );

    // Determine confidence level based on data quality
    let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
    let reasoning = '';

    if (item.lastRestockDate) {
      const daysSinceRestock = Math.floor(
        (new Date().getTime() - new Date(item.lastRestockDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRestock >= 30) {
        confidenceLevel = 'high';
        reasoning = `Based on ${daysSinceRestock} days of consumption data since last restock.`;
      } else {
        confidenceLevel = 'medium';
        reasoning = `Limited data: Only ${daysSinceRestock} days since last restock. Prediction may be less accurate.`;
      }
    } else {
      confidenceLevel = 'low';
      reasoning = 'No historical restock data available. Using current consumption rate estimate.';
    }

    // Add urgency context
    if (daysUntilStockout <= 7) {
      reasoning += ' URGENT: Stock will run out within a week.';
    } else if (daysUntilStockout <= 14) {
      reasoning += ' Order soon to avoid stockout.';
    }

    // Estimate price if unit cost available
    const priceEstimate = item.unitCost
      ? Math.round(item.unitCost * orderQuantity * 100) / 100
      : undefined;

    return {
      itemId: item.id,
      itemName: item.itemName,
      category: item.category,
      currentQuantity: item.quantity,
      predictedDaysUntilStockout: daysUntilStockout,
      recommendedRestockDate,
      recommendedOrderQuantity: Math.round(orderQuantity * 100) / 100,
      confidenceLevel,
      reasoning,
      priceEstimate,
      suggestedSupplier: item.supplierName,
    };
  }

  /**
   * Get restocking schedule for upcoming period
   * @param organizationId - Organization ID
   * @param days - Number of days to forecast (default 30)
   * @returns Grouped restock schedule by date
   */
  public async getRestockSchedule(
    organizationId: string,
    days: number = 30
  ): Promise<Map<string, RestockRecommendation[]>> {
    const recommendations = await this.getPredictiveRestockRecommendations(organizationId);

    const schedule = new Map<string, RestockRecommendation[]>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    for (const rec of recommendations) {
      if (rec.recommendedRestockDate <= cutoffDate) {
        const dateKey = rec.recommendedRestockDate.toISOString().split('T')[0];
        const existing = schedule.get(dateKey) || [];
        existing.push(rec);
        schedule.set(dateKey, existing);
      }
    }

    return schedule;
  }

  /**
   * Get consumption trend analysis for an item
   * @param itemId - Inventory item ID
   * @param days - Number of days to analyze (default 30)
   * @returns Consumption trend data
   */
  public async getConsumptionTrend(
    itemId: string,
    days: number = 30
  ): Promise<{
    averageDaily: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    peakUsageDays: string[];
    forecast: Array<{ date: string; predictedStock: number }>;
  }> {
    const item = await this.inventoryRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new Error(`Inventory item ${itemId} not found`);
    }

    const averageDaily = item.averageConsumptionRate || 0;

    // In a real implementation, this would analyze historical consumption data
    // For now, we generate a simple forecast based on average consumption
    const trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const peakUsageDays: string[] = ['Monday', 'Friday']; // Placeholder

    const forecast: Array<{ date: string; predictedStock: number }> = [];
    let currentStock = item.quantity;
    const forecastDate = new Date();

    for (let i = 0; i < days; i++) {
      forecastDate.setDate(forecastDate.getDate() + 1);
      currentStock = Math.max(0, currentStock - averageDaily);

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predictedStock: Math.round(currentStock * 100) / 100,
      });
    }

    return {
      averageDaily,
      trend,
      peakUsageDays,
      forecast,
    };
  }
}

