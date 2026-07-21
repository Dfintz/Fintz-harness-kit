import { In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import {
  CreateInventoryItemDto,
  FleetInventory,
  InventoryCategory,
  InventoryFilterOptions,
  StockAdjustmentDto,
  StockStatus,
  UpdateInventoryItemDto,
} from '../../models/FleetInventory';
import { logger } from '../../utils/logger';
import { UIFItemLocation, uifService } from '../trade/trading/UIFService';

/**
 * Maximum number of items allowed in a single bulk operation
 * Prevents memory issues and transaction timeouts
 */
const MAX_BULK_OPERATION_LIMIT = 100;

/**
 * Bulk operation result
 */
export interface BulkInventoryOperationResult<T> {
  successful: T[];
  failed: Array<{ id?: string; error: string }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Maximum number of items to fetch in a single inventory query
 * Used to prevent memory issues with very large inventories
 */
const MAX_INVENTORY_LIMIT = 1000;

/**
 * Error thrown when a fleet is not found or not accessible
 */
export class FleetNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetNotFoundError';
  }
}

/**
 * Service for managing fleet inventory
 * Handles CRUD operations and stock management
 *
 * Multi-tenancy: All operations require organizationId to verify fleet ownership
 */
export class FleetInventoryService {
  private readonly inventoryRepository = AppDataSource.getRepository(FleetInventory);
  private readonly fleetRepository = AppDataSource.getRepository(Fleet);

  /**
   * Verify fleet belongs to organization
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID to verify
   * @throws FleetNotFoundError if fleet not found or doesn't belong to organization
   */
  private async verifyFleetAccess(organizationId: string, fleetId: string): Promise<Fleet> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, organizationId },
    });

    if (!fleet) {
      throw new FleetNotFoundError(`Fleet ${fleetId} not found or not accessible`);
    }

    return fleet;
  }

  /**
   * Create a new inventory item
   * @param organizationId - Organization (tenant) ID
   * @param dto - Inventory item creation data
   */
  public async createInventoryItem(
    organizationId: string,
    dto: CreateInventoryItemDto
  ): Promise<FleetInventory> {
    try {
      // Verify fleet ownership before creating inventory item
      await this.verifyFleetAccess(organizationId, dto.fleetId);

      const item = this.inventoryRepository.create({
        ...dto,
        status: this.calculateStockStatus(dto.quantity, dto.thresholds),
        totalValue: dto.unitCost ? dto.unitCost * dto.quantity : undefined,
        estimatedDaysRemaining:
          dto.averageConsumptionRate && dto.averageConsumptionRate > 0
            ? Math.floor(dto.quantity / dto.averageConsumptionRate)
            : undefined,
      });

      const savedItem = await this.inventoryRepository.save(item);
      logger.info(`Created inventory item: ${savedItem.id} - ${savedItem.itemName}`, {
        organizationId,
      });
      return savedItem;
    } catch (error: unknown) {
      logger.error('Error creating inventory item:', error);
      throw error;
    }
  }

  /**
   * Get inventory items with filtering and pagination
   * @param organizationId - Organization (tenant) ID
   * @param filters - Filter options including pagination
   * @returns Paginated inventory items
   */
  public async getInventory(
    organizationId: string,
    filters: InventoryFilterOptions
  ): Promise<{
    items: FleetInventory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      // If filtering by fleetId, verify fleet access
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
        } else {
          queryBuilder.andWhere('inventory.category = :category', { category: filters.category });
        }
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          queryBuilder.andWhere('inventory.status IN (:...statuses)', { statuses: filters.status });
        } else {
          queryBuilder.andWhere('inventory.status = :status', { status: filters.status });
        }
      }

      if (filters.managerId) {
        queryBuilder.andWhere('inventory.managerId = :managerId', { managerId: filters.managerId });
      }

      if (filters.lowStockOnly) {
        queryBuilder.andWhere('inventory.status IN (:...statuses)', {
          statuses: [StockStatus.LOW, StockStatus.CRITICAL, StockStatus.OUT_OF_STOCK],
        });
      }

      if (filters.criticalOnly) {
        queryBuilder.andWhere('inventory.status IN (:...statuses)', {
          statuses: [StockStatus.CRITICAL, StockStatus.OUT_OF_STOCK],
        });
      }

      if (filters.searchTerm) {
        queryBuilder.andWhere(
          '(inventory.itemName LIKE :search OR inventory.description LIKE :search OR inventory.notes LIKE :search)',
          { search: `%${filters.searchTerm}%` }
        );
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'status';
      const sortOrder = filters.sortOrder || 'DESC';
      queryBuilder.orderBy(`inventory.${sortBy}`, sortOrder);

      if (sortBy !== 'itemName') {
        queryBuilder.addOrderBy('inventory.itemName', 'ASC');
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const skip = (page - 1) * limit;

      // Get total count before pagination
      const total = await queryBuilder.getCount();

      // Apply pagination
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
    } catch (error: unknown) {
      logger.error('Error getting inventory:', error);
      throw error;
    }
  }

  /**
   * Get inventory item by ID with tenant verification
   * @param organizationId - Organization (tenant) ID
   * @param id - Inventory item ID
   */
  public async getInventoryItemById(
    organizationId: string,
    id: string
  ): Promise<FleetInventory | null> {
    try {
      const item = await this.inventoryRepository.findOne({ where: { id } });

      if (!item) {
        return null;
      }

      // Verify the item's fleet belongs to this organization
      await this.verifyFleetAccess(organizationId, item.fleetId);

      return item;
    } catch (error: unknown) {
      if (error instanceof FleetNotFoundError) {
        return null; // Item exists but not accessible
      }
      logger.error(`Error getting inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update inventory item
   * @param organizationId - Organization (tenant) ID
   * @param id - Inventory item ID
   * @param dto - Update data
   */
  public async updateInventoryItem(
    organizationId: string,
    id: string,
    dto: UpdateInventoryItemDto
  ): Promise<FleetInventory> {
    try {
      const item = await this.inventoryRepository.findOne({ where: { id } });

      if (!item) {
        throw new Error(`Inventory item ${id} not found`);
      }

      // Verify the item's fleet belongs to this organization
      await this.verifyFleetAccess(organizationId, item.fleetId);

      Object.assign(item, dto);

      // Recalculate status if quantity or thresholds changed
      if (dto.quantity !== undefined || dto.thresholds) {
        item.status = this.calculateStockStatus(item.quantity, item.thresholds);
      }

      // Recalculate total value if cost or quantity changed
      if (item.unitCost && (dto.quantity !== undefined || dto.unitCost !== undefined)) {
        item.totalValue = item.unitCost * item.quantity;
      }

      // Recalculate days remaining
      if (item.averageConsumptionRate && item.averageConsumptionRate > 0) {
        item.estimatedDaysRemaining = Math.floor(item.quantity / item.averageConsumptionRate);
      }

      const updatedItem = await this.inventoryRepository.save(item);
      logger.info(`Updated inventory item: ${id}`, { organizationId });
      return updatedItem;
    } catch (error: unknown) {
      logger.error(`Error updating inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Adjust stock quantity
   * @param organizationId - Organization (tenant) ID
   * @param id - Inventory item ID
   * @param dto - Stock adjustment data
   */
  public async adjustStock(
    organizationId: string,
    id: string,
    dto: StockAdjustmentDto
  ): Promise<FleetInventory> {
    try {
      const item = await this.inventoryRepository.findOne({ where: { id } });

      if (!item) {
        throw new Error(`Inventory item ${id} not found`);
      }

      // Verify the item's fleet belongs to this organization
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

      // Update restock date if quantity increased significantly
      if (dto.quantity > 0 && dto.quantity >= item.thresholds.lowLevel) {
        item.lastRestockDate = new Date();
      }

      const updatedItem = await this.inventoryRepository.save(item);

      logger.info(
        `Adjusted stock for ${item.itemName}: ${oldQuantity} -> ${item.quantity} (${dto.reason}) by ${dto.adjustedBy}`,
        { organizationId }
      );

      return updatedItem;
    } catch (error: unknown) {
      logger.error(`Error adjusting stock for item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk update consumption rates based on actual usage
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   * @param days - Number of days to analyze (default 30)
   */
  public async updateConsumptionRates(
    organizationId: string,
    fleetId: string,
    days: number = 30
  ): Promise<number> {
    try {
      // Verify fleet ownership before updating
      await this.verifyFleetAccess(organizationId, fleetId);

      // This would calculate consumption rates based on historical data
      // For now, this is a placeholder that would integrate with transaction logs
      logger.info(`Updating consumption rates for fleet ${fleetId} based on last ${days} days`, {
        organizationId,
      });
      return 0;
    } catch (error: unknown) {
      logger.error('Error updating consumption rates:', error);
      throw error;
    }
  }

  /**
   * Delete inventory item
   * @param organizationId - Organization (tenant) ID
   * @param id - Inventory item ID
   */
  public async deleteInventoryItem(organizationId: string, id: string): Promise<void> {
    try {
      const item = await this.inventoryRepository.findOne({ where: { id } });

      if (!item) {
        throw new Error(`Inventory item ${id} not found`);
      }

      // Verify the item's fleet belongs to this organization
      await this.verifyFleetAccess(organizationId, item.fleetId);

      const result = await this.inventoryRepository.delete(id);

      if (result.affected === 0) {
        throw new Error(`Inventory item ${id} not found`);
      }

      logger.info(`Deleted inventory item: ${id}`, { organizationId });
    } catch (error: unknown) {
      logger.error(`Error deleting inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get inventory statistics
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   */
  public async getInventoryStatistics(
    organizationId: string,
    fleetId: string
  ): Promise<Record<string, unknown>> {
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
          adequate: items.filter(i => i.status === StockStatus.ADEQUATE).length,
          low: items.filter(i => i.status === StockStatus.LOW).length,
          critical: items.filter(i => i.status === StockStatus.CRITICAL).length,
          outOfStock: items.filter(i => i.status === StockStatus.OUT_OF_STOCK).length,
        },
        byCategory: this.groupByCategory(items),
        alertsEnabled: items.filter(i => i.alertEnabled).length,
        itemsNeedingRestock: items.filter(
          i =>
            i.status === StockStatus.LOW ||
            i.status === StockStatus.CRITICAL ||
            i.status === StockStatus.OUT_OF_STOCK
        ).length,
        averageDaysRemaining: this.calculateAverageDaysRemaining(items),
      };

      return stats;
    } catch (error: unknown) {
      logger.error('Error getting inventory statistics:', error);
      throw error;
    }
  }

  /**
   * Get items by category with totals
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   */
  public async getInventoryByCategory(
    organizationId: string,
    fleetId: string
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.getInventory(organizationId, {
        fleetId,
        limit: MAX_INVENTORY_LIMIT,
      });
      const items = result.items;

      const categories = Object.values(InventoryCategory);
      const categoryResult: Record<string, Record<string, unknown>> = {};

      categories.forEach(category => {
        const categoryItems = items.filter(i => i.category === category);
        categoryResult[category] = {
          total: categoryItems.length,
          totalValue: categoryItems.reduce((sum, item) => sum + (item.totalValue || 0), 0),
          lowStockCount: categoryItems.filter(
            i =>
              i.status === StockStatus.LOW ||
              i.status === StockStatus.CRITICAL ||
              i.status === StockStatus.OUT_OF_STOCK
          ).length,
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
    } catch (error: unknown) {
      logger.error('Error getting inventory by category:', error);
      throw error;
    }
  }

  /**
   * Get low stock report
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   */
  public async getLowStockReport(
    organizationId: string,
    fleetId: string
  ): Promise<Record<string, unknown>> {
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
        critical: items.filter(
          i => i.status === StockStatus.CRITICAL || i.status === StockStatus.OUT_OF_STOCK
        ),
        warning: items.filter(i => i.status === StockStatus.LOW),
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
    } catch (error: unknown) {
      logger.error('Error generating low stock report:', error);
      throw error;
    }
  }

  // Helper methods
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

  private groupByCategory(
    items: FleetInventory[]
  ): Record<
    string,
    {
      count: number;
      totalValue: number;
      items: Array<{ id: string; name: string; quantity: number; unit: string; status: string }>;
    }
  > {
    const groups: Record<
      string,
      {
        count: number;
        totalValue: number;
        items: Array<{ id: string; name: string; quantity: number; unit: string; status: string }>;
      }
    > = {};

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

  private calculateAverageDaysRemaining(items: FleetInventory[]): number {
    const itemsWithEstimate = items.filter(
      i => i.estimatedDaysRemaining !== undefined && i.estimatedDaysRemaining !== null
    );

    if (itemsWithEstimate.length === 0) {
      return 0;
    }

    const sum = itemsWithEstimate.reduce(
      (acc, item) => acc + (item.estimatedDaysRemaining || 0),
      0
    );
    return Math.round(sum / itemsWithEstimate.length);
  }

  /**
   * Get current market price for an item from UIF
   * Note: This is market data, not tenant-scoped
   */
  public async getItemMarketPrice(
    itemName: string
  ): Promise<{
    minPrice?: number;
    maxPrice?: number;
    averagePrice?: number;
    locations: UIFItemLocation[];
  }> {
    try {
      const item = await uifService.getItemDetails(itemName);

      if (!item) {
        logger.warn(`No market data found for item: ${itemName}`);
        return { locations: [] };
      }

      const prices = item.locations
        .filter(
          (loc): loc is typeof loc & { price: number } =>
            typeof loc.price === 'number' && loc.price > 0
        )
        .map(loc => loc.price);

      return {
        minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
        maxPrice: prices.length > 0 ? Math.max(...prices) : undefined,
        averagePrice:
          prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined,
        locations: item.locations,
      };
    } catch (error: unknown) {
      logger.error(`Error getting market price for ${itemName}:`, error);
      return { locations: [] };
    }
  }

  /**
   * Update inventory item prices from UIF
   * @param organizationId - Organization (tenant) ID
   * @param id - Inventory item ID
   */
  public async updateItemPricesFromMarket(
    organizationId: string,
    id: string
  ): Promise<FleetInventory> {
    try {
      const item = await this.inventoryRepository.findOne({ where: { id } });

      if (!item) {
        throw new Error(`Inventory item ${id} not found`);
      }

      // Verify the item's fleet belongs to this organization
      await this.verifyFleetAccess(organizationId, item.fleetId);

      const marketData = await this.getItemMarketPrice(item.itemName);

      if (marketData.averagePrice) {
        item.unitCost = marketData.averagePrice;
        item.totalValue = item.unitCost * item.quantity;

        const updatedItem = await this.inventoryRepository.save(item);
        logger.info(`Updated market price for ${item.itemName}: ${marketData.averagePrice} UEC`, {
          organizationId,
        });
        return updatedItem;
      }

      logger.warn(`No market price available for ${item.itemName}`);
      return item;
    } catch (error: unknown) {
      logger.error(`Error updating item prices from market for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find best purchase locations for an item
   * Note: This is market data, not tenant-scoped
   */
  public async findBestPurchaseLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    try {
      return await uifService.findBestBuyLocation(itemName, nearLocation);
    } catch (error: unknown) {
      logger.error(`Error finding best purchase location for ${itemName}:`, error);
      return null;
    }
  }

  /**
   * Get restocking recommendations with price information
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   * @param currentLocation - Current location for best purchase location calculation
   */
  public async getRestockingRecommendations(
    organizationId: string,
    fleetId: string,
    currentLocation?: string
  ): Promise<unknown[]> {
    try {
      const result = await this.getInventory(organizationId, {
        fleetId,
        lowStockOnly: true,
        limit: MAX_INVENTORY_LIMIT,
      });
      const lowStockItems = result.items;

      interface RestockRecommendation {
        itemId: string;
        itemName: string;
        category: InventoryCategory;
        currentQuantity: number;
        targetQuantity: number;
        quantityNeeded: number;
        currentStatus: StockStatus;
        estimatedDaysRemaining: number | undefined;
        marketPrice: number | undefined;
        bestPurchaseLocation: UIFItemLocation | null;
        estimatedCost: number | undefined;
        priority: number;
      }

      const recommendations: RestockRecommendation[] = [];

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

      // Sort by priority
      return recommendations.sort((a, b) => b.priority - a.priority);
    } catch (error: unknown) {
      logger.error('Error generating restocking recommendations:', error);
      throw error;
    }
  }

  /**
   * Calculate restock priority (0-100)
   */
  private calculateRestockPriority(item: FleetInventory): number {
    let priority = 0;

    // Status-based priority
    if (item.status === StockStatus.OUT_OF_STOCK) {
      priority += 50;
    } else if (item.status === StockStatus.CRITICAL) {
      priority += 35;
    } else if (item.status === StockStatus.LOW) {
      priority += 20;
    }

    // Days remaining priority
    if (item.estimatedDaysRemaining !== undefined && item.estimatedDaysRemaining !== null) {
      if (item.estimatedDaysRemaining <= 1) {
        priority += 30;
      } else if (item.estimatedDaysRemaining <= 3) {
        priority += 20;
      } else if (item.estimatedDaysRemaining <= 7) {
        priority += 10;
      }
    }

    // Category priority (critical categories get higher priority)
    const criticalCategories = [
      InventoryCategory.FUEL,
      InventoryCategory.MEDICAL,
      InventoryCategory.AMMUNITION,
    ];
    if (criticalCategories.includes(item.category)) {
      priority += 20;
    }

    return Math.min(priority, 100);
  }

  /**
   * Bulk update all item prices from market data
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   */
  public async bulkUpdatePricesFromMarket(
    organizationId: string,
    fleetId: string
  ): Promise<{ updated: number; failed: number }> {
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
        } catch (error: unknown) {
          logger.error(`Failed to update price for ${item.itemName}:`, error);
          failed++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`Bulk price update complete: ${updated} updated, ${failed} failed`, {
        organizationId,
      });
      return { updated, failed };
    } catch (error: unknown) {
      logger.error('Error during bulk price update:', error);
      throw error;
    }
  }

  // ==================== BULK OPERATIONS WITH TRANSACTIONS ====================

  /**
   * Helper method to verify fleet access for multiple fleets in parallel
   * @param organizationId - Organization (tenant) ID
   * @param fleetIds - Array of fleet IDs to verify
   * @throws FleetNotFoundError if any fleet not found or doesn't belong to organization
   */
  private async verifyMultipleFleetAccess(
    organizationId: string,
    fleetIds: string[]
  ): Promise<void> {
    const uniqueFleetIds = [...new Set(fleetIds)];
    await Promise.all(
      uniqueFleetIds.map(fleetId => this.verifyFleetAccess(organizationId, fleetId))
    );
  }

  /**
   * Helper method to create a new inventory item entity from DTO
   * Calculates derived fields like status, totalValue, and estimatedDaysRemaining
   * @param dto - Inventory item creation data
   * @returns Created FleetInventory entity (unsaved)
   */
  private createInventoryItemEntity(dto: CreateInventoryItemDto): FleetInventory {
    return this.inventoryRepository.create({
      ...dto,
      status: this.calculateStockStatus(dto.quantity, dto.thresholds),
      totalValue: dto.unitCost ? dto.unitCost * dto.quantity : undefined,
      estimatedDaysRemaining:
        dto.averageConsumptionRate && dto.averageConsumptionRate > 0
          ? Math.floor(dto.quantity / dto.averageConsumptionRate)
          : undefined,
    });
  }

  /**
   * Helper method to recalculate derived fields on an inventory item
   * @param item - Inventory item to update
   * @param updates - Update data that was applied
   */
  private recalculateItemDerivedFields(
    item: FleetInventory,
    updates?: UpdateInventoryItemDto
  ): void {
    // Recalculate status if quantity or thresholds changed
    if (!updates || updates.quantity !== undefined || updates.thresholds) {
      item.status = this.calculateStockStatus(item.quantity, item.thresholds);
    }

    // Recalculate total value if cost or quantity changed
    if (
      item.unitCost &&
      (!updates || updates.quantity !== undefined || updates.unitCost !== undefined)
    ) {
      item.totalValue = item.unitCost * item.quantity;
    }

    // Recalculate days remaining
    if (item.averageConsumptionRate && item.averageConsumptionRate > 0) {
      item.estimatedDaysRemaining = Math.floor(item.quantity / item.averageConsumptionRate);
    }
  }

  /**
   * Helper method to handle bulk operation transaction rollback
   * @param result - Bulk operation result to update
   * @param error - Error that caused the rollback
   * @param count - Total number of items in the operation
   * @param items - Optional array of items with IDs for error reporting
   */
  private handleBulkOperationRollback<T>(
    result: BulkInventoryOperationResult<T>,
    error: unknown,
    count: number,
    items?: Array<{ id?: string }>
  ): void {
    result.successful = [];
    result.successCount = 0;
    result.failureCount = count;
    result.failed = Array.from({ length: count }, (_, i) => ({
      id: items?.[i]?.id,
      error:
        i === 0
          ? error instanceof Error
            ? error.message
            : 'Transaction failed'
          : 'Rolled back due to earlier failure',
    }));
  }

  /**
   * Bulk create inventory items with transaction support
   * All items are created atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param items - Array of inventory item creation data (max 100)
   * @returns Promise resolving to bulk operation result
   */
  public async bulkCreateInventoryItems(
    organizationId: string,
    items: CreateInventoryItemDto[]
  ): Promise<BulkInventoryOperationResult<FleetInventory>> {
    if (items.length === 0) {
      throw new Error('No inventory items provided for bulk create');
    }

    if (items.length > MAX_BULK_OPERATION_LIMIT) {
      throw new Error(
        `Cannot create more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`
      );
    }

    // Verify all fleets belong to the organization (in parallel)
    const fleetIds = items.map(item => item.fleetId);
    await this.verifyMultipleFleetAccess(organizationId, fleetIds);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const result: BulkInventoryOperationResult<FleetInventory> = {
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
      logger.info(`Bulk created ${result.successCount} inventory items`, { organizationId });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk create inventory items failed, transaction rolled back', {
        error,
        organizationId,
        count: items.length,
      });
      this.handleBulkOperationRollback(result, error, items.length);
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  /**
   * Bulk update inventory items with transaction support
   * All updates are applied atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param updates - Array of {id, data} objects for updating (max 100)
   * @returns Promise resolving to bulk operation result
   */
  public async bulkUpdateInventoryItems(
    organizationId: string,
    updates: Array<{ id: string; data: UpdateInventoryItemDto }>
  ): Promise<BulkInventoryOperationResult<FleetInventory>> {
    if (updates.length === 0) {
      throw new Error('No updates provided for bulk update');
    }

    if (updates.length > MAX_BULK_OPERATION_LIMIT) {
      throw new Error(
        `Cannot update more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`
      );
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const result: BulkInventoryOperationResult<FleetInventory> = {
      successful: [],
      failed: [],
      totalProcessed: updates.length,
      successCount: 0,
      failureCount: 0,
    };

    try {
      for (const { id, data } of updates) {
        const item = await queryRunner.manager.findOne(FleetInventory, {
          where: { id },
        });

        if (!item) {
          throw new Error(`Inventory item ${id} not found`);
        }

        // Verify the item's fleet belongs to this organization
        await this.verifyFleetAccess(organizationId, item.fleetId);

        Object.assign(item, data);
        this.recalculateItemDerivedFields(item, data);

        const saved = await queryRunner.manager.save(item);
        result.successful.push(saved);
        result.successCount++;
      }

      await queryRunner.commitTransaction();
      logger.info(`Bulk updated ${result.successCount} inventory items`, { organizationId });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk update inventory items failed, transaction rolled back', {
        error,
        organizationId,
        count: updates.length,
      });
      this.handleBulkOperationRollback(result, error, updates.length, updates);
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  /**
   * Bulk delete inventory items with transaction support
   * All deletions are applied atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param itemIds - Array of inventory item IDs to delete (max 100)
   * @returns Promise resolving to number of deleted items and any errors
   */
  public async bulkDeleteInventoryItems(
    organizationId: string,
    itemIds: string[]
  ): Promise<{ deletedCount: number; errors: string[] }> {
    if (itemIds.length === 0) {
      throw new Error('No item IDs provided for bulk delete');
    }

    if (itemIds.length > MAX_BULK_OPERATION_LIMIT) {
      throw new Error(
        `Cannot delete more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`
      );
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find all items and verify they belong to organization's fleets
      const items = await queryRunner.manager.find(FleetInventory, {
        where: { id: In(itemIds) },
      });

      if (items.length !== itemIds.length) {
        const foundIds = new Set(items.map(i => i.id));
        const missingIds = itemIds.filter(id => !foundIds.has(id));
        throw new Error(`Inventory items not found: ${missingIds.join(', ')}`);
      }

      // Verify all items' fleets belong to the organization (in parallel)
      const fleetIds = items.map(item => item.fleetId);
      await this.verifyMultipleFleetAccess(organizationId, fleetIds);

      // Delete all items
      await queryRunner.manager.delete(FleetInventory, { id: In(itemIds) });

      await queryRunner.commitTransaction();
      logger.info(`Bulk deleted ${itemIds.length} inventory items`, { organizationId });

      return { deletedCount: itemIds.length, errors: [] };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      logger.error('Bulk delete inventory items failed, transaction rolled back', {
        error,
        organizationId,
        count: itemIds.length,
      });

      return { deletedCount: 0, errors: [errorMessage] };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk adjust stock quantities with transaction support
   * All adjustments are applied atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param adjustments - Array of {id, adjustment} objects (max 100)
   * @returns Promise resolving to bulk operation result
   */
  public async bulkAdjustStock(
    organizationId: string,
    adjustments: Array<{ id: string; adjustment: StockAdjustmentDto }>
  ): Promise<BulkInventoryOperationResult<FleetInventory>> {
    if (adjustments.length === 0) {
      throw new Error('No adjustments provided for bulk stock adjustment');
    }

    if (adjustments.length > MAX_BULK_OPERATION_LIMIT) {
      throw new Error(
        `Cannot adjust more than ${MAX_BULK_OPERATION_LIMIT} items in a single bulk operation`
      );
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const result: BulkInventoryOperationResult<FleetInventory> = {
      successful: [],
      failed: [],
      totalProcessed: adjustments.length,
      successCount: 0,
      failureCount: 0,
    };

    try {
      for (const { id, adjustment } of adjustments) {
        const item = await queryRunner.manager.findOne(FleetInventory, {
          where: { id },
        });

        if (!item) {
          throw new Error(`Inventory item ${id} not found`);
        }

        // Verify the item's fleet belongs to this organization
        await this.verifyFleetAccess(organizationId, item.fleetId);

        const oldQuantity = item.quantity;
        item.quantity = Math.max(0, item.quantity + adjustment.quantity);
        this.recalculateItemDerivedFields(item);

        // Update restock date if quantity increased significantly
        if (adjustment.quantity > 0 && adjustment.quantity >= item.thresholds.lowLevel) {
          item.lastRestockDate = new Date();
        }

        const saved = await queryRunner.manager.save(item);
        result.successful.push(saved);
        result.successCount++;

        logger.debug(
          `Adjusted stock for ${item.itemName}: ${oldQuantity} -> ${item.quantity} (${adjustment.reason})`,
          { organizationId }
        );
      }

      await queryRunner.commitTransaction();
      logger.info(`Bulk adjusted stock for ${result.successCount} inventory items`, {
        organizationId,
      });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk stock adjustment failed, transaction rolled back', {
        error,
        organizationId,
        count: adjustments.length,
      });
      this.handleBulkOperationRollback(result, error, adjustments.length, adjustments);
    } finally {
      await queryRunner.release();
    }

    return result;
  }
}

