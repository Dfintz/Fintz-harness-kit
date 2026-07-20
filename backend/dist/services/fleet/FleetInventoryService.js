"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetInventoryService = exports.FleetNotFoundError = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetInventory_1 = require("../../models/FleetInventory");
const logger_1 = require("../../utils/logger");
const UIFService_1 = require("../trade/trading/UIFService");
const MAX_BULK_OPERATION_LIMIT = 100;
const MAX_INVENTORY_LIMIT = 1000;
class FleetNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FleetNotFoundError';
    }
}
exports.FleetNotFoundError = FleetNotFoundError;
class FleetInventoryService {
    inventoryRepository = data_source_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory);
    fleetRepository = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
    async verifyFleetAccess(organizationId, fleetId) {
        const fleet = await this.fleetRepository.findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new FleetNotFoundError(`Fleet ${fleetId} not found or not accessible`);
        }
        return fleet;
    }
    async createInventoryItem(organizationId, dto) {
        try {
            await this.verifyFleetAccess(organizationId, dto.fleetId);
            const item = this.inventoryRepository.create({
                ...dto,
                status: this.calculateStockStatus(dto.quantity, dto.thresholds),
                totalValue: dto.unitCost ? dto.unitCost * dto.quantity : undefined,
                estimatedDaysRemaining: dto.averageConsumptionRate && dto.averageConsumptionRate > 0
                    ? Math.floor(dto.quantity / dto.averageConsumptionRate)
                    : undefined,
            });
            const savedItem = await this.inventoryRepository.save(item);
            logger_1.logger.info(`Created inventory item: ${savedItem.id} - ${savedItem.itemName}`, {
                organizationId,
            });
            return savedItem;
        }
        catch (error) {
            logger_1.logger.error('Error creating inventory item:', error);
            throw error;
        }
    }
    async getInventory(organizationId, filters) {
        try {
            if (filters.fleetId) {
                await this.verifyFleetAccess(organizationId, filters.fleetId);
            }
            const queryBuilder = this.inventoryRepository.createQueryBuilder('inventory');
            if (filters.fleetId) {
                queryBuilder.andWhere('inventory.fleetId = :fleetId', { fleetId: filters.fleetId });
            }
            if (filters.category) {
                if (Array.isArray(filters.category)) {
                    queryBuilder.andWhere('inventory.category IN (:...categories)', {
                        categories: filters.category,
                    });
                }
                else {
                    queryBuilder.andWhere('inventory.category = :category', { category: filters.category });
                }
            }
            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    queryBuilder.andWhere('inventory.status IN (:...statuses)', { statuses: filters.status });
                }
                else {
                    queryBuilder.andWhere('inventory.status = :status', { status: filters.status });
                }
            }
            if (filters.managerId) {
                queryBuilder.andWhere('inventory.managerId = :managerId', { managerId: filters.managerId });
            }
            if (filters.lowStockOnly) {
                queryBuilder.andWhere('inventory.status IN (:...statuses)', {
                    statuses: [FleetInventory_1.StockStatus.LOW, FleetInventory_1.StockStatus.CRITICAL, FleetInventory_1.StockStatus.OUT_OF_STOCK],
                });
            }
            if (filters.criticalOnly) {
                queryBuilder.andWhere('inventory.status IN (:...statuses)', {
                    statuses: [FleetInventory_1.StockStatus.CRITICAL, FleetInventory_1.StockStatus.OUT_OF_STOCK],
                });
            }
            if (filters.searchTerm) {
                queryBuilder.andWhere('(inventory.itemName LIKE :search OR inventory.description LIKE :search OR inventory.notes LIKE :search)', { search: `%${filters.searchTerm}%` });
            }
            const sortBy = filters.sortBy || 'status';
            const sortOrder = filters.sortOrder || 'DESC';
            queryBuilder.orderBy(`inventory.${sortBy}`, sortOrder);
            if (sortBy !== 'itemName') {
                queryBuilder.addOrderBy('inventory.itemName', 'ASC');
            }
            const page = filters.page || 1;
            const limit = filters.limit || 50;
            const skip = (page - 1) * limit;
            const total = await queryBuilder.getCount();
            queryBuilder.skip(skip).take(limit);
            const items = await queryBuilder.getMany();
            const totalPages = Math.ceil(total / limit);
            return {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting inventory:', error);
            throw error;
        }
    }
    async getInventoryItemById(organizationId, id) {
        try {
            const item = await this.inventoryRepository.findOne({ where: { id } });
            if (!item) {
                return null;
            }
            await this.verifyFleetAccess(organizationId, item.fleetId);
            return item;
        }
        catch (error) {
            if (error instanceof FleetNotFoundError) {
                return null;
            }
            logger_1.logger.error(`Error getting inventory item ${id}:`, error);
            throw error;
        }
    }
    async updateInventoryItem(organizationId, id, dto) {
        try {
            const item = await this.inventoryRepository.findOne({ where: { id } });
            if (!item) {
                throw new Error(`Inventory item ${id} not found`);
            }
            await this.verifyFleetAccess(organizationId, item.fleetId);
            Object.assign(item, dto);
            if (dto.quantity !== undefined || dto.thresholds) {
                item.status = this.calculateStockStatus(item.quantity, item.thresholds);
            }
            if (item.unitCost && (dto.quantity !== undefined || dto.unitCost !== undefined)) {
                item.totalValue = item.unitCost * item.quantity;
            }
            if (item.averageConsumptionRate && item.averageConsumptionRate > 0) {
                item.estimatedDaysRemaining = Math.floor(item.quantity / item.averageConsumptionRate);
            }
            const updatedItem = await this.inventoryRepository.save(item);
            logger_1.logger.info(`Updated inventory item: ${id}`, { organizationId });
            return updatedItem;
        }
        catch (error) {
            logger_1.logger.error(`Error updating inventory item ${id}:`, error);
            throw error;
        }
    }
    async adjustStock(organizationId, id, dto) {
        try {
            const item = await this.inventoryRepository.findOne({ where: { id } });
            if (!item) {
                throw new Error(`Inventory item ${id} not found`);
            }
            await this.verifyFleetAccess(organizationId, item.fleetId);
            const oldQuantity = item.quantity;
            item.quantity = Math.max(0, item.quantity + dto.quantity);
            item.status = this.calculateStockStatus(item.quantity, item.thresholds);
            if (item.unitCost) {
                item.totalValue = item.unitCost * item.quantity;
            }
            if (item.averageConsumptionRate && item.averageConsumptionRate > 0) {
                item.estimatedDaysRemaining = Math.floor(item.quantity / item.averageConsumptionRate);
            }
            if (dto.quantity > 0 && dto.quantity >= item.thresholds.lowLevel) {
                item.lastRestockDate = new Date();
            }
            const updatedItem = await this.inventoryRepository.save(item);
            logger_1.logger.info(`Adjusted stock for ${item.itemName}: ${oldQuantity} -> ${item.quantity} (${dto.reason}) by ${dto.adjustedBy}`, { organizationId });
            return updatedItem;
        }
        catch (error) {
            logger_1.logger.error(`Error adjusting stock for item ${id}:`, error);
            throw error;
        }
    }
    async updateConsumptionRates(organizationId, fleetId, days = 30) {
        try {
            await this.verifyFleetAccess(organizationId, fleetId);
            logger_1.logger.info(`Updating consumption rates for fleet ${fleetId} based on last ${days} days`, {
                organizationId,
            });
            return 0;
        }
        catch (error) {
            logger_1.logger.error('Error updating consumption rates:', error);
            throw error;
        }
    }
    async deleteInventoryItem(organizationId, id) {
        try {
            const item = await this.inventoryRepository.findOne({ where: { id } });
            if (!item) {
                throw new Error(`Inventory item ${id} not found`);
            }
            await this.verifyFleetAccess(organizationId, item.fleetId);
            const result = await this.inventoryRepository.delete(id);
            if (result.affected === 0) {
                throw new Error(`Inventory item ${id} not found`);
            }
            logger_1.logger.info(`Deleted inventory item: ${id}`, { organizationId });
        }
        catch (error) {
            logger_1.logger.error(`Error deleting inventory item ${id}:`, error);
            throw error;
        }
    }
    async getInventoryStatistics(organizationId, fleetId) {
        try {
            const result = await this.getInventory(organizationId, {
                fleetId,
                limit: MAX_INVENTORY_LIMIT,
            });
            const items = result.items;
            const stats = {
                totalItems: items.length,
                totalValue: items.reduce((sum, item) => sum + (item.totalValue || 0), 0),
                byStatus: {
                    adequate: items.filter(i => i.status === FleetInventory_1.StockStatus.ADEQUATE).length,
                    low: items.filter(i => i.status === FleetInventory_1.StockStatus.LOW).length,
                    critical: items.filter(i => i.status === FleetInventory_1.StockStatus.CRITICAL).length,
                    outOfStock: items.filter(i => i.status === FleetInventory_1.StockStatus.OUT_OF_STOCK).length,
                },
                byCategory: this.groupByCategory(items),
                alertsEnabled: items.filter(i => i.alertEnabled).length,
                itemsNeedingRestock: items.filter(i => i.status === FleetInventory_1.StockStatus.LOW ||
                    i.status === FleetInventory_1.StockStatus.CRITICAL ||
                    i.status === FleetInventory_1.StockStatus.OUT_OF_STOCK).length,
                averageDaysRemaining: this.calculateAverageDaysRemaining(items),
            };
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting inventory statistics:', error);
            throw error;
        }
    }
    async getInventoryByCategory(organizationId, fleetId) {
        try {
            const result = await this.getInventory(organizationId, {
                fleetId,
                limit: MAX_INVENTORY_LIMIT,
            });
            const items = result.items;
            const categories = Object.values(FleetInventory_1.InventoryCategory);
            const categoryResult = {};
            categories.forEach(category => {
                const categoryItems = items.filter(i => i.category === category);
                categoryResult[category] = {
                    total: categoryItems.length,
                    totalValue: categoryItems.reduce((sum, item) => sum + (item.totalValue || 0), 0),
                    lowStockCount: categoryItems.filter(i => i.status === FleetInventory_1.StockStatus.LOW ||
                        i.status === FleetInventory_1.StockStatus.CRITICAL ||
                        i.status === FleetInventory_1.StockStatus.OUT_OF_STOCK).length,
                    items: categoryItems.map(i => ({
                        id: i.id,
                        name: i.itemName,
                        quantity: i.quantity,
                        unit: i.unit,
                        status: i.status,
                        value: i.totalValue,
                    })),
                };
            });
            return categoryResult;
        }
        catch (error) {
            logger_1.logger.error('Error getting inventory by category:', error);
            throw error;
        }
    }
    async getLowStockReport(organizationId, fleetId) {
        try {
            const result = await this.getInventory(organizationId, {
                fleetId,
                lowStockOnly: true,
                limit: MAX_INVENTORY_LIMIT,
            });
            const items = result.items;
            const report = {
                timestamp: new Date(),
                fleetId,
                totalLowStockItems: items.length,
                critical: items.filter(i => i.status === FleetInventory_1.StockStatus.CRITICAL || i.status === FleetInventory_1.StockStatus.OUT_OF_STOCK),
                warning: items.filter(i => i.status === FleetInventory_1.StockStatus.LOW),
                estimatedRestockCost: items.reduce((sum, item) => {
                    if (item.unitCost) {
                        const needed = item.thresholds.targetLevel - item.quantity;
                        return sum + needed * item.unitCost;
                    }
                    return sum;
                }, 0),
                byCategory: this.groupByCategory(items),
            };
            return report;
        }
        catch (error) {
            logger_1.logger.error('Error generating low stock report:', error);
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
    groupByCategory(items) {
        const groups = {};
        items.forEach(item => {
            if (!groups[item.category]) {
                groups[item.category] = {
                    count: 0,
                    totalValue: 0,
                    items: [],
                };
            }
            groups[item.category].count++;
            groups[item.category].totalValue += item.totalValue || 0;
            groups[item.category].items.push({
                id: item.id,
                name: item.itemName,
                quantity: item.quantity,
                unit: item.unit,
                status: item.status,
            });
        });
        return groups;
    }
    calculateAverageDaysRemaining(items) {
        const itemsWithEstimate = items.filter(i => i.estimatedDaysRemaining !== undefined && i.estimatedDaysRemaining !== null);
        if (itemsWithEstimate.length === 0) {
            return 0;
        }
        const sum = itemsWithEstimate.reduce((acc, item) => acc + (item.estimatedDaysRemaining || 0), 0);
        return Math.round(sum / itemsWithEstimate.length);
    }
    async getItemMarketPrice(itemName) {
        try {
            const item = await UIFService_1.uifService.getItemDetails(itemName);
            if (!item) {
                logger_1.logger.warn(`No market data found for item: ${itemName}`);
                return { locations: [] };
            }
            const prices = item.locations
                .filter((loc) => typeof loc.price === 'number' && loc.price > 0)
                .map(loc => loc.price);
            return {
                minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
                maxPrice: prices.length > 0 ? Math.max(...prices) : undefined,
                averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined,
                locations: item.locations,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting market price for ${itemName}:`, error);
            return { locations: [] };
        }
    }
    async updateItemPricesFromMarket(organizationId, id) {
        try {
            const item = await this.inventoryRepository.findOne({ where: { id } });
            if (!item) {
                throw new Error(`Inventory item ${id} not found`);
            }
            await this.verifyFleetAccess(organizationId, item.fleetId);
            const marketData = await this.getItemMarketPrice(item.itemName);
            if (marketData.averagePrice) {
                item.unitCost = marketData.averagePrice;
                item.totalValue = item.unitCost * item.quantity;
                const updatedItem = await this.inventoryRepository.save(item);
                logger_1.logger.info(`Updated market price for ${item.itemName}: ${marketData.averagePrice} UEC`, {
                    organizationId,
                });
                return updatedItem;
            }
            logger_1.logger.warn(`No market price available for ${item.itemName}`);
            return item;
        }
        catch (error) {
            logger_1.logger.error(`Error updating item prices from market for ${id}:`, error);
            throw error;
        }
    }
    async findBestPurchaseLocation(itemName, nearLocation) {
        try {
            return await UIFService_1.uifService.findBestBuyLocation(itemName, nearLocation);
        }
        catch (error) {
            logger_1.logger.error(`Error finding best purchase location for ${itemName}:`, error);
            return null;
        }
    }
    async getRestockingRecommendations(organizationId, fleetId, currentLocation) {
        try {
            const result = await this.getInventory(organizationId, {
                fleetId,
                lowStockOnly: true,
                limit: MAX_INVENTORY_LIMIT,
            });
            const lowStockItems = result.items;
            const recommendations = [];
            for (const item of lowStockItems) {
                const quantityNeeded = item.thresholds.targetLevel - item.quantity;
                if (quantityNeeded <= 0) {
                    continue;
                }
                const marketData = await this.getItemMarketPrice(item.itemName);
                const bestLocation = await this.findBestPurchaseLocation(item.itemName, currentLocation);
                recommendations.push({
                    itemId: item.id,
                    itemName: item.itemName,
                    category: item.category,
                    currentQuantity: item.quantity,
                    targetQuantity: item.thresholds.targetLevel,
                    quantityNeeded,
                    currentStatus: item.status,
                    estimatedDaysRemaining: item.estimatedDaysRemaining,
                    marketPrice: marketData.averagePrice,
                    bestPurchaseLocation: bestLocation,
                    estimatedCost: bestLocation?.price
                        ? bestLocation.price * quantityNeeded
                        : marketData.averagePrice
                            ? marketData.averagePrice * quantityNeeded
                            : undefined,
                    priority: this.calculateRestockPriority(item),
                });
            }
            return recommendations.sort((a, b) => b.priority - a.priority);
        }
        catch (error) {
            logger_1.logger.error('Error generating restocking recommendations:', error);
            throw error;
        }
    }
    calculateRestockPriority(item) {
        let priority = 0;
        if (item.status === FleetInventory_1.StockStatus.OUT_OF_STOCK) {
            priority += 50;
        }
        else if (item.status === FleetInventory_1.StockStatus.CRITICAL) {
            priority += 35;
        }
        else if (item.status === FleetInventory_1.StockStatus.LOW) {
            priority += 20;
        }
        if (item.estimatedDaysRemaining !== undefined && item.estimatedDaysRemaining !== null) {
            if (item.estimatedDaysRemaining <= 1) {
                priority += 30;
            }
            else if (item.estimatedDaysRemaining <= 3) {
                priority += 20;
            }
            else if (item.estimatedDaysRemaining <= 7) {
                priority += 10;
            }
        }
        const criticalCategories = [
            FleetInventory_1.InventoryCategory.FUEL,
            FleetInventory_1.InventoryCategory.MEDICAL,
            FleetInventory_1.InventoryCategory.AMMUNITION,
        ];
        if (criticalCategories.includes(item.category)) {
            priority += 20;
        }
        return Math.min(priority, 100);
    }
    async bulkUpdatePricesFromMarket(organizationId, fleetId) {
        try {
            const result = await this.getInventory(organizationId, {
                fleetId,
                limit: MAX_INVENTORY_LIMIT,
            });
            const items = result.items;
            let updated = 0;
            let failed = 0;
            for (const item of items) {
                try {
                    await this.updateItemPricesFromMarket(organizationId, item.id);
                    updated++;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update price for ${item.itemName}:`, error);
                    failed++;
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            logger_1.logger.info(`Bulk price update complete: ${updated} updated, ${failed} failed`, {
                organizationId,
            });
            return { updated, failed };
        }
        catch (error) {
            logger_1.logger.error('Error during bulk price update:', error);
            throw error;
        }
    }
    async verifyMultipleFleetAccess(organizationId, fleetIds) {
        const uniqueFleetIds = [...new Set(fleetIds)];
        await Promise.all(uniqueFleetIds.map(fleetId => this.verifyFleetAccess(organizationId, fleetId)));
    }
    createInventoryItemEntity(dto) {
        return this.inventoryRepository.create({
            ...dto,
            status: this.calculateStockStatus(dto.quantity, dto.thresholds),
            totalValue: dto.unitCost ? dto.unitCost * dto.quantity : undefined,
            estimatedDaysRemaining: dto.averageConsumptionRate && dto.averageConsumptionRate > 0
                ? Math.floor(dto.quantity / dto.averageConsumptionRate)
                : undefined,
        });
    }
    recalculateItemDerivedFields(item, updates) {
        if (!updates || updates.quantity !== undefined || updates.thresholds) {
            item.status = this.calculateStockStatus(item.quantity, item.thresholds);
        }
        if (item.unitCost &&
            (!updates || updates.quantity !== undefined || updates.unitCost !== undefined)) {
            item.totalValue = item.unitCost * item.quantity;
        }
        if (item.averageConsumptionRate && item.averageConsumptionRate > 0) {
            item.estimatedDaysRemaining = Math.floor(item.quantity / item.averageConsumptionRate);
        }
    }
    handleBulkOperationRollback(result, error, count, items) {
        result.successful = [];
        result.successCount = 0;
        result.failureCount = count;
        result.failed = Array.from({ length: count }, (_, i) => ({
            id: items?.[i]?.id,
            error: i === 0
                ? error instanceof Error
                    ? error.message
                    : 'Transaction failed'
                : 'Rolled back due to earlier failure',
        }));
    }
    async bulkCreateInventoryItems(organizationId, items) {
        if (items.length === 0) {
            throw new Error('No inventory items provided for bulk create');
        }
        if (items.length > MAX_BULK_OPERATION_LIMIT) {
            throw new Error(`Cannot create more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`);
        }
        const fleetIds = items.map(item => item.fleetId);
        await this.verifyMultipleFleetAccess(organizationId, fleetIds);
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const result = {
            successful: [],
            failed: [],
            totalProcessed: items.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            for (const dto of items) {
                const item = this.createInventoryItemEntity(dto);
                const saved = await queryRunner.manager.save(item);
                result.successful.push(saved);
                result.successCount++;
            }
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk created ${result.successCount} inventory items`, { organizationId });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk create inventory items failed, transaction rolled back', {
                error,
                organizationId,
                count: items.length,
            });
            this.handleBulkOperationRollback(result, error, items.length);
        }
        finally {
            await queryRunner.release();
        }
        return result;
    }
    async bulkUpdateInventoryItems(organizationId, updates) {
        if (updates.length === 0) {
            throw new Error('No updates provided for bulk update');
        }
        if (updates.length > MAX_BULK_OPERATION_LIMIT) {
            throw new Error(`Cannot update more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`);
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const result = {
            successful: [],
            failed: [],
            totalProcessed: updates.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            for (const { id, data } of updates) {
                const item = await queryRunner.manager.findOne(FleetInventory_1.FleetInventory, {
                    where: { id },
                });
                if (!item) {
                    throw new Error(`Inventory item ${id} not found`);
                }
                await this.verifyFleetAccess(organizationId, item.fleetId);
                Object.assign(item, data);
                this.recalculateItemDerivedFields(item, data);
                const saved = await queryRunner.manager.save(item);
                result.successful.push(saved);
                result.successCount++;
            }
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk updated ${result.successCount} inventory items`, { organizationId });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk update inventory items failed, transaction rolled back', {
                error,
                organizationId,
                count: updates.length,
            });
            this.handleBulkOperationRollback(result, error, updates.length, updates);
        }
        finally {
            await queryRunner.release();
        }
        return result;
    }
    async bulkDeleteInventoryItems(organizationId, itemIds) {
        if (itemIds.length === 0) {
            throw new Error('No item IDs provided for bulk delete');
        }
        if (itemIds.length > MAX_BULK_OPERATION_LIMIT) {
            throw new Error(`Cannot delete more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`);
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const items = await queryRunner.manager.find(FleetInventory_1.FleetInventory, {
                where: { id: (0, typeorm_1.In)(itemIds) },
            });
            if (items.length !== itemIds.length) {
                const foundIds = new Set(items.map(i => i.id));
                const missingIds = itemIds.filter(id => !foundIds.has(id));
                throw new Error(`Inventory items not found: ${missingIds.join(', ')}`);
            }
            const fleetIds = items.map(item => item.fleetId);
            await this.verifyMultipleFleetAccess(organizationId, fleetIds);
            await queryRunner.manager.delete(FleetInventory_1.FleetInventory, { id: (0, typeorm_1.In)(itemIds) });
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk deleted ${itemIds.length} inventory items`, { organizationId });
            return { deletedCount: itemIds.length, errors: [] };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
            logger_1.logger.error('Bulk delete inventory items failed, transaction rolled back', {
                error,
                organizationId,
                count: itemIds.length,
            });
            return { deletedCount: 0, errors: [errorMessage] };
        }
        finally {
            await queryRunner.release();
        }
    }
    async bulkAdjustStock(organizationId, adjustments) {
        if (adjustments.length === 0) {
            throw new Error('No adjustments provided for bulk stock adjustment');
        }
        if (adjustments.length > MAX_BULK_OPERATION_LIMIT) {
            throw new Error(`Cannot adjust more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`);
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const result = {
            successful: [],
            failed: [],
            totalProcessed: adjustments.length,
            successCount: 0,
            failureCount: 0,
        };
        try {
            for (const { id, adjustment } of adjustments) {
                const item = await queryRunner.manager.findOne(FleetInventory_1.FleetInventory, {
                    where: { id },
                });
                if (!item) {
                    throw new Error(`Inventory item ${id} not found`);
                }
                await this.verifyFleetAccess(organizationId, item.fleetId);
                const oldQuantity = item.quantity;
                item.quantity = Math.max(0, item.quantity + adjustment.quantity);
                this.recalculateItemDerivedFields(item);
                if (adjustment.quantity > 0 && adjustment.quantity >= item.thresholds.lowLevel) {
                    item.lastRestockDate = new Date();
                }
                const saved = await queryRunner.manager.save(item);
                result.successful.push(saved);
                result.successCount++;
                logger_1.logger.debug(`Adjusted stock for ${item.itemName}: ${oldQuantity} -> ${item.quantity} (${adjustment.reason})`, { organizationId });
            }
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk adjusted stock for ${result.successCount} inventory items`, {
                organizationId,
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk stock adjustment failed, transaction rolled back', {
                error,
                organizationId,
                count: adjustments.length,
            });
            this.handleBulkOperationRollback(result, error, adjustments.length, adjustments);
        }
        finally {
            await queryRunner.release();
        }
        return result;
    }
}
exports.FleetInventoryService = FleetInventoryService;
//# sourceMappingURL=FleetInventoryService.js.map