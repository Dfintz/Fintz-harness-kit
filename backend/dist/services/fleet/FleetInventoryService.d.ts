import { CreateInventoryItemDto, FleetInventory, InventoryFilterOptions, StockAdjustmentDto, UpdateInventoryItemDto } from '../../models/FleetInventory';
import { UIFItemLocation } from '../trade/trading/UIFService';
export interface BulkInventoryOperationResult<T> {
    successful: T[];
    failed: Array<{
        id?: string;
        error: string;
    }>;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
}
export declare class FleetNotFoundError extends Error {
    constructor(message: string);
}
export declare class FleetInventoryService {
    private readonly inventoryRepository;
    private readonly fleetRepository;
    private verifyFleetAccess;
    createInventoryItem(organizationId: string, dto: CreateInventoryItemDto): Promise<FleetInventory>;
    getInventory(organizationId: string, filters: InventoryFilterOptions): Promise<{
        items: FleetInventory[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getInventoryItemById(organizationId: string, id: string): Promise<FleetInventory | null>;
    updateInventoryItem(organizationId: string, id: string, dto: UpdateInventoryItemDto): Promise<FleetInventory>;
    adjustStock(organizationId: string, id: string, dto: StockAdjustmentDto): Promise<FleetInventory>;
    updateConsumptionRates(organizationId: string, fleetId: string, days?: number): Promise<number>;
    deleteInventoryItem(organizationId: string, id: string): Promise<void>;
    getInventoryStatistics(organizationId: string, fleetId: string): Promise<Record<string, unknown>>;
    getInventoryByCategory(organizationId: string, fleetId: string): Promise<Record<string, unknown>>;
    getLowStockReport(organizationId: string, fleetId: string): Promise<Record<string, unknown>>;
    private calculateStockStatus;
    private groupByCategory;
    private calculateAverageDaysRemaining;
    getItemMarketPrice(itemName: string): Promise<{
        minPrice?: number;
        maxPrice?: number;
        averagePrice?: number;
        locations: UIFItemLocation[];
    }>;
    updateItemPricesFromMarket(organizationId: string, id: string): Promise<FleetInventory>;
    findBestPurchaseLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;
    getRestockingRecommendations(organizationId: string, fleetId: string, currentLocation?: string): Promise<unknown[]>;
    private calculateRestockPriority;
    bulkUpdatePricesFromMarket(organizationId: string, fleetId: string): Promise<{
        updated: number;
        failed: number;
    }>;
    private verifyMultipleFleetAccess;
    private createInventoryItemEntity;
    private recalculateItemDerivedFields;
    private handleBulkOperationRollback;
    bulkCreateInventoryItems(organizationId: string, items: CreateInventoryItemDto[]): Promise<BulkInventoryOperationResult<FleetInventory>>;
    bulkUpdateInventoryItems(organizationId: string, updates: Array<{
        id: string;
        data: UpdateInventoryItemDto;
    }>): Promise<BulkInventoryOperationResult<FleetInventory>>;
    bulkDeleteInventoryItems(organizationId: string, itemIds: string[]): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
    bulkAdjustStock(organizationId: string, adjustments: Array<{
        id: string;
        adjustment: StockAdjustmentDto;
    }>): Promise<BulkInventoryOperationResult<FleetInventory>>;
}
//# sourceMappingURL=FleetInventoryService.d.ts.map