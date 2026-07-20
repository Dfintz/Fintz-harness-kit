"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsAlertService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../../data-source");
const FleetInventory_1 = require("../../../models/FleetInventory");
const LogisticsAlert_1 = require("../../../models/LogisticsAlert");
const logger_1 = require("../../../utils/logger");
class LogisticsAlertService {
    alertRepository = data_source_1.AppDataSource.getRepository(LogisticsAlert_1.LogisticsAlert);
    inventoryRepository = data_source_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory);
    async checkInventoryAndGenerateAlerts(fleetId) {
        try {
            const whereConditions = {};
            if (fleetId) {
                whereConditions.fleetId = fleetId;
            }
            whereConditions.alertEnabled = true;
            const inventoryItems = await this.inventoryRepository.find({
                where: whereConditions,
            });
            const generatedAlerts = [];
            for (const item of inventoryItems) {
                const oldStatus = item.status;
                item.status = this.calculateStockStatus(item.quantity, item.thresholds);
                if (item.status !== oldStatus) {
                    const alert = await this.generateAlertForItem(item);
                    if (alert) {
                        generatedAlerts.push(alert);
                    }
                }
                if (item.nextRestockDate && new Date() >= item.nextRestockDate) {
                    const restockAlert = await this.generateRestockDueAlert(item);
                    if (restockAlert) {
                        generatedAlerts.push(restockAlert);
                    }
                }
                if (item.averageConsumptionRate && item.estimatedDaysRemaining !== undefined) {
                    if (item.estimatedDaysRemaining < 7 && item.status === FleetInventory_1.StockStatus.ADEQUATE) {
                        const consumptionAlert = await this.generateConsumptionSpikeAlert(item);
                        if (consumptionAlert) {
                            generatedAlerts.push(consumptionAlert);
                        }
                    }
                }
                await this.inventoryRepository.save(item);
            }
            logger_1.logger.info(`Generated ${generatedAlerts.length} alerts for fleet ${fleetId || 'all'}`);
            return generatedAlerts;
        }
        catch (error) {
            logger_1.logger.error('Error checking inventory and generating alerts:', error);
            throw error;
        }
    }
    calculateStockStatus(quantity, thresholds) {
        if (quantity <= 0) {
            return FleetInventory_1.StockStatus.OUT_OF_STOCK;
        }
        else if (quantity <= thresholds.criticalLevel) {
            return FleetInventory_1.StockStatus.CRITICAL;
        }
        else if (quantity <= thresholds.lowLevel) {
            return FleetInventory_1.StockStatus.LOW;
        }
        return FleetInventory_1.StockStatus.ADEQUATE;
    }
    async generateAlertForItem(item) {
        try {
            const existingAlert = await this.alertRepository.findOne({
                where: {
                    inventoryItemId: item.id,
                    type: this.getAlertTypeForStatus(item.status),
                    status: (0, typeorm_1.In)([LogisticsAlert_1.AlertStatus.ACTIVE, LogisticsAlert_1.AlertStatus.ACKNOWLEDGED]),
                },
            });
            if (existingAlert) {
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
            const alert = this.alertRepository.create({
                fleetId: item.fleetId,
                inventoryItemId: item.id,
                itemName: item.itemName,
                type: this.getAlertTypeForStatus(item.status),
                severity: this.getSeverityForStatus(item.status),
                status: LogisticsAlert_1.AlertStatus.ACTIVE,
                title: this.getAlertTitle(item),
                message: this.getAlertMessage(item),
                metadata: {
                    currentQuantity: Number(item.quantity),
                    threshold: this.getThresholdForStatus(item.status, item.thresholds),
                    unit: item.unit,
                    category: item.category,
                    location: typeof item.location === 'string'
                        ? item.location
                        : item.location?.name || '',
                    daysRemaining: item.estimatedDaysRemaining,
                    consumptionRate: item.averageConsumptionRate
                        ? Number(item.averageConsumptionRate)
                        : undefined,
                },
                recipients: this.getRecipientsForItem(item),
                notificationChannels: [LogisticsAlert_1.NotificationChannel.IN_APP, LogisticsAlert_1.NotificationChannel.EMAIL],
                autoResolve: true,
                repeatCount: 1,
                lastTriggeredAt: new Date(),
            });
            const saved = await this.alertRepository.save(alert);
            return Array.isArray(saved) ? saved[0] : saved;
        }
        catch (error) {
            logger_1.logger.error(`Error generating alert for item ${item.id}:`, error);
            return null;
        }
    }
    async generateRestockDueAlert(item) {
        try {
            const alert = this.alertRepository.create({
                fleetId: item.fleetId,
                inventoryItemId: item.id,
                itemName: item.itemName,
                type: LogisticsAlert_1.AlertType.RESTOCK_DUE,
                severity: LogisticsAlert_1.AlertSeverity.WARNING,
                status: LogisticsAlert_1.AlertStatus.ACTIVE,
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
                notificationChannels: [LogisticsAlert_1.NotificationChannel.IN_APP, LogisticsAlert_1.NotificationChannel.EMAIL],
                autoResolve: false,
            });
            return await this.alertRepository.save(alert);
        }
        catch (error) {
            logger_1.logger.error(`Error generating restock alert for item ${item.id}:`, error);
            return null;
        }
    }
    async generateConsumptionSpikeAlert(item) {
        try {
            const alert = this.alertRepository.create({
                fleetId: item.fleetId,
                inventoryItemId: item.id,
                itemName: item.itemName,
                type: LogisticsAlert_1.AlertType.CONSUMPTION_SPIKE,
                severity: LogisticsAlert_1.AlertSeverity.INFO,
                status: LogisticsAlert_1.AlertStatus.ACTIVE,
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
                notificationChannels: [LogisticsAlert_1.NotificationChannel.IN_APP],
                autoResolve: true,
            });
            return await this.alertRepository.save(alert);
        }
        catch (error) {
            logger_1.logger.error(`Error generating consumption spike alert for item ${item.id}:`, error);
            return null;
        }
    }
    async createAlert(dto) {
        try {
            const alert = this.alertRepository.create({
                ...dto,
                status: LogisticsAlert_1.AlertStatus.ACTIVE,
                notificationSent: false,
                repeatCount: 1,
                lastTriggeredAt: new Date(),
            });
            const savedAlert = await this.alertRepository.save(alert);
            logger_1.logger.info(`Created custom alert: ${savedAlert.id}`);
            return savedAlert;
        }
        catch (error) {
            logger_1.logger.error('Error creating alert:', error);
            throw error;
        }
    }
    async getAlerts(filters) {
        try {
            const whereConditions = {};
            if (filters.fleetId) {
                whereConditions.fleetId = filters.fleetId;
            }
            if (filters.inventoryItemId) {
                whereConditions.inventoryItemId = filters.inventoryItemId;
            }
            if (filters.type) {
                whereConditions.type = Array.isArray(filters.type) ? (0, typeorm_1.In)(filters.type) : filters.type;
            }
            if (filters.severity) {
                whereConditions.severity = Array.isArray(filters.severity)
                    ? (0, typeorm_1.In)(filters.severity)
                    : filters.severity;
            }
            if (filters.status) {
                whereConditions.status = Array.isArray(filters.status)
                    ? (0, typeorm_1.In)(filters.status)
                    : filters.status;
            }
            if (filters.unacknowledgedOnly) {
                whereConditions.acknowledgedAt = (0, typeorm_1.IsNull)();
            }
            if (filters.activeOnly) {
                whereConditions.status = LogisticsAlert_1.AlertStatus.ACTIVE;
            }
            const alerts = await this.alertRepository.find({
                where: whereConditions,
                order: { createdAt: 'DESC' },
            });
            return alerts;
        }
        catch (error) {
            logger_1.logger.error('Error getting alerts:', error);
            throw error;
        }
    }
    async getAlertById(id) {
        try {
            return await this.alertRepository.findOne({ where: { id } });
        }
        catch (error) {
            logger_1.logger.error(`Error getting alert ${id}:`, error);
            throw error;
        }
    }
    async updateAlert(id, dto) {
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
                alert.status = LogisticsAlert_1.AlertStatus.ACKNOWLEDGED;
            }
            if (dto.resolvedBy) {
                alert.resolvedBy = dto.resolvedBy;
                alert.resolvedAt = new Date();
                alert.status = LogisticsAlert_1.AlertStatus.RESOLVED;
                alert.resolutionNotes = dto.resolutionNotes;
            }
            const updatedAlert = await this.alertRepository.save(alert);
            logger_1.logger.info(`Updated alert: ${id}`);
            return updatedAlert;
        }
        catch (error) {
            logger_1.logger.error(`Error updating alert ${id}:`, error);
            throw error;
        }
    }
    async acknowledgeAlert(id, userId) {
        return this.updateAlert(id, { acknowledgedBy: userId });
    }
    async resolveAlert(id, userId, notes) {
        return this.updateAlert(id, { resolvedBy: userId, resolutionNotes: notes });
    }
    async dismissAlert(id) {
        return this.updateAlert(id, { status: LogisticsAlert_1.AlertStatus.DISMISSED });
    }
    async deleteAlert(id) {
        try {
            await this.alertRepository.delete(id);
            logger_1.logger.info(`Deleted alert: ${id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error deleting alert ${id}:`, error);
            throw error;
        }
    }
    async autoResolveAlerts() {
        try {
            const activeAlerts = await this.alertRepository.find({
                where: {
                    status: (0, typeorm_1.In)([LogisticsAlert_1.AlertStatus.ACTIVE, LogisticsAlert_1.AlertStatus.ACKNOWLEDGED]),
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
                if (alert.type === LogisticsAlert_1.AlertType.LOW_STOCK && item.status !== FleetInventory_1.StockStatus.LOW) {
                    shouldResolve = true;
                }
                if (alert.type === LogisticsAlert_1.AlertType.CRITICAL_STOCK && item.status !== FleetInventory_1.StockStatus.CRITICAL) {
                    shouldResolve = true;
                }
                if (alert.type === LogisticsAlert_1.AlertType.OUT_OF_STOCK && item.status !== FleetInventory_1.StockStatus.OUT_OF_STOCK) {
                    shouldResolve = true;
                }
                if (shouldResolve) {
                    alert.status = LogisticsAlert_1.AlertStatus.RESOLVED;
                    alert.resolvedAt = new Date();
                    alert.resolvedBy = 'system';
                    alert.resolutionNotes = 'Auto-resolved: conditions no longer met';
                    await this.alertRepository.save(alert);
                    resolvedCount++;
                }
            }
            logger_1.logger.info(`Auto-resolved ${resolvedCount} alerts`);
            return resolvedCount;
        }
        catch (error) {
            logger_1.logger.error('Error auto-resolving alerts:', error);
            throw error;
        }
    }
    async getAlertStatistics(fleetId) {
        try {
            const alerts = await this.getAlerts({ fleetId });
            const stats = {
                total: alerts.length,
                active: alerts.filter(a => a.status === LogisticsAlert_1.AlertStatus.ACTIVE).length,
                acknowledged: alerts.filter(a => a.status === LogisticsAlert_1.AlertStatus.ACKNOWLEDGED).length,
                resolved: alerts.filter(a => a.status === LogisticsAlert_1.AlertStatus.RESOLVED).length,
                dismissed: alerts.filter(a => a.status === LogisticsAlert_1.AlertStatus.DISMISSED).length,
                bySeverity: {
                    critical: alerts.filter(a => a.severity === LogisticsAlert_1.AlertSeverity.CRITICAL).length,
                    urgent: alerts.filter(a => a.severity === LogisticsAlert_1.AlertSeverity.URGENT).length,
                    warning: alerts.filter(a => a.severity === LogisticsAlert_1.AlertSeverity.WARNING).length,
                    info: alerts.filter(a => a.severity === LogisticsAlert_1.AlertSeverity.INFO).length,
                },
                byType: {
                    lowStock: alerts.filter(a => a.type === LogisticsAlert_1.AlertType.LOW_STOCK).length,
                    criticalStock: alerts.filter(a => a.type === LogisticsAlert_1.AlertType.CRITICAL_STOCK).length,
                    outOfStock: alerts.filter(a => a.type === LogisticsAlert_1.AlertType.OUT_OF_STOCK).length,
                    restockDue: alerts.filter(a => a.type === LogisticsAlert_1.AlertType.RESTOCK_DUE).length,
                    consumptionSpike: alerts.filter(a => a.type === LogisticsAlert_1.AlertType.CONSUMPTION_SPIKE).length,
                },
            };
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting alert statistics:', error);
            throw error;
        }
    }
    getAlertTypeForStatus(status) {
        switch (status) {
            case FleetInventory_1.StockStatus.OUT_OF_STOCK:
                return LogisticsAlert_1.AlertType.OUT_OF_STOCK;
            case FleetInventory_1.StockStatus.CRITICAL:
                return LogisticsAlert_1.AlertType.CRITICAL_STOCK;
            case FleetInventory_1.StockStatus.LOW:
                return LogisticsAlert_1.AlertType.LOW_STOCK;
            default:
                return LogisticsAlert_1.AlertType.CUSTOM;
        }
    }
    getSeverityForStatus(status) {
        switch (status) {
            case FleetInventory_1.StockStatus.OUT_OF_STOCK:
                return LogisticsAlert_1.AlertSeverity.URGENT;
            case FleetInventory_1.StockStatus.CRITICAL:
                return LogisticsAlert_1.AlertSeverity.CRITICAL;
            case FleetInventory_1.StockStatus.LOW:
                return LogisticsAlert_1.AlertSeverity.WARNING;
            default:
                return LogisticsAlert_1.AlertSeverity.INFO;
        }
    }
    getThresholdForStatus(status, thresholds) {
        switch (status) {
            case FleetInventory_1.StockStatus.OUT_OF_STOCK:
                return 0;
            case FleetInventory_1.StockStatus.CRITICAL:
                return thresholds.criticalLevel;
            case FleetInventory_1.StockStatus.LOW:
                return thresholds.lowLevel;
            default:
                return thresholds.targetLevel || 0;
        }
    }
    getAlertTitle(item) {
        switch (item.status) {
            case FleetInventory_1.StockStatus.OUT_OF_STOCK:
                return `OUT OF STOCK: ${item.itemName}`;
            case FleetInventory_1.StockStatus.CRITICAL:
                return `CRITICAL: Low Stock - ${item.itemName}`;
            case FleetInventory_1.StockStatus.LOW:
                return `Low Stock Alert: ${item.itemName}`;
            default:
                return `Stock Alert: ${item.itemName}`;
        }
    }
    getAlertMessage(item) {
        const location = item.location
            ? `at ${item.location.shipName || item.location.stationName || 'unknown location'}`
            : '';
        switch (item.status) {
            case FleetInventory_1.StockStatus.OUT_OF_STOCK:
                return `${item.itemName} is out of stock ${location}. Immediate restocking required.`;
            case FleetInventory_1.StockStatus.CRITICAL:
                return `${item.itemName} stock is critically low ${location}. Current: ${item.quantity} ${item.unit}, Critical threshold: ${item.thresholds.criticalLevel} ${item.unit}`;
            case FleetInventory_1.StockStatus.LOW:
                return `${item.itemName} stock is running low ${location}. Current: ${item.quantity} ${item.unit}, Low threshold: ${item.thresholds.lowLevel} ${item.unit}`;
            default:
                return `Stock level change detected for ${item.itemName}.`;
        }
    }
    getRecipientsForItem(item) {
        return [{ userId: item.managerId }];
    }
    async getPredictiveRestockRecommendations(organizationId, fleetId) {
        try {
            const qb = this.inventoryRepository
                .createQueryBuilder('item')
                .where('item.organizationId = :organizationId', { organizationId })
                .andWhere('item.averageConsumptionRate > 0');
            if (fleetId) {
                qb.andWhere('item.fleetId = :fleetId', { fleetId });
            }
            const inventoryItems = await qb.getMany();
            const recommendations = [];
            for (const item of inventoryItems) {
                const recommendation = this.calculateRestockRecommendation(item);
                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }
            recommendations.sort((a, b) => a.predictedDaysUntilStockout - b.predictedDaysUntilStockout);
            logger_1.logger.info(`Generated ${recommendations.length} restock recommendations`, {
                organizationId,
                fleetId,
            });
            return recommendations;
        }
        catch (error) {
            logger_1.logger.error('Error generating predictive restock recommendations:', error);
            throw error;
        }
    }
    calculateRestockRecommendation(item) {
        if (!item.averageConsumptionRate || item.averageConsumptionRate <= 0) {
            return null;
        }
        const daysUntilStockout = Math.floor(item.quantity / item.averageConsumptionRate);
        if (daysUntilStockout > 90) {
            return null;
        }
        const orderLeadTimeDays = 7;
        const safetyStockDays = 14;
        const orderTriggerDays = orderLeadTimeDays + safetyStockDays;
        const recommendedRestockDate = new Date();
        recommendedRestockDate.setDate(recommendedRestockDate.getDate() + Math.max(0, daysUntilStockout - orderTriggerDays));
        const targetLevel = item.thresholds?.targetLevel || item.quantity * 2;
        const bufferDays = 30;
        const orderQuantity = Math.max(0, targetLevel - item.quantity + item.averageConsumptionRate * bufferDays);
        let confidenceLevel = 'medium';
        let reasoning = '';
        if (item.lastRestockDate) {
            const daysSinceRestock = Math.floor((new Date().getTime() - new Date(item.lastRestockDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceRestock >= 30) {
                confidenceLevel = 'high';
                reasoning = `Based on ${daysSinceRestock} days of consumption data since last restock.`;
            }
            else {
                confidenceLevel = 'medium';
                reasoning = `Limited data: Only ${daysSinceRestock} days since last restock. Prediction may be less accurate.`;
            }
        }
        else {
            confidenceLevel = 'low';
            reasoning = 'No historical restock data available. Using current consumption rate estimate.';
        }
        if (daysUntilStockout <= 7) {
            reasoning += ' URGENT: Stock will run out within a week.';
        }
        else if (daysUntilStockout <= 14) {
            reasoning += ' Order soon to avoid stockout.';
        }
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
    async getRestockSchedule(organizationId, days = 30) {
        const recommendations = await this.getPredictiveRestockRecommendations(organizationId);
        const schedule = new Map();
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
    async getConsumptionTrend(itemId, days = 30) {
        const item = await this.inventoryRepository.findOne({ where: { id: itemId } });
        if (!item) {
            throw new Error(`Inventory item ${itemId} not found`);
        }
        const averageDaily = item.averageConsumptionRate || 0;
        const trend = 'stable';
        const peakUsageDays = ['Monday', 'Friday'];
        const forecast = [];
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
exports.LogisticsAlertService = LogisticsAlertService;
//# sourceMappingURL=LogisticsAlertService.js.map