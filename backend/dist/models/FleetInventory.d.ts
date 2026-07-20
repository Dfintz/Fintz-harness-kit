export declare enum InventoryCategory {
    FUEL = "fuel",
    AMMUNITION = "ammunition",
    MEDICAL = "medical",
    FOOD = "food",
    MINING = "mining",
    REPAIR = "repair",
    TRADE = "trade",
    COMPONENTS = "components",
    CONSUMABLES = "consumables",
    OTHER = "other"
}
export declare enum InventoryUnit {
    UNITS = "units",
    SCU = "scu",
    LITERS = "liters",
    KILOGRAMS = "kilograms",
    TONNES = "tonnes"
}
export declare enum StockStatus {
    ADEQUATE = "adequate",
    LOW = "low",
    CRITICAL = "critical",
    OUT_OF_STOCK = "out_of_stock"
}
export interface StockThresholds {
    criticalLevel: number;
    lowLevel: number;
    targetLevel: number;
    maxLevel: number;
}
export interface InventoryLocation {
    shipId?: string;
    shipName?: string;
    stationName?: string;
    systemName?: string;
    planetName?: string;
}
export declare class FleetInventory {
    id: string;
    organizationId: string;
    fleetId: string;
    itemName: string;
    description?: string;
    category: InventoryCategory;
    quantity: number;
    unit: InventoryUnit;
    thresholds: StockThresholds;
    status: StockStatus;
    location?: InventoryLocation;
    unitCost?: number;
    totalValue?: number;
    supplierId?: string;
    supplierName?: string;
    alertEnabled: boolean;
    lastRestockDate?: Date;
    nextRestockDate?: Date;
    averageConsumptionRate?: number;
    estimatedDaysRemaining?: number;
    notes?: string;
    managerId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateInventoryItemDto {
    fleetId: string;
    itemName: string;
    description?: string;
    category: InventoryCategory;
    quantity: number;
    unit: InventoryUnit;
    thresholds: StockThresholds;
    location?: InventoryLocation;
    unitCost?: number;
    supplierId?: string;
    supplierName?: string;
    alertEnabled?: boolean;
    averageConsumptionRate?: number;
    notes?: string;
    managerId: string;
}
export interface UpdateInventoryItemDto {
    itemName?: string;
    description?: string;
    category?: InventoryCategory;
    quantity?: number;
    unit?: InventoryUnit;
    thresholds?: StockThresholds;
    location?: InventoryLocation;
    unitCost?: number;
    supplierId?: string;
    supplierName?: string;
    alertEnabled?: boolean;
    lastRestockDate?: Date;
    nextRestockDate?: Date;
    averageConsumptionRate?: number;
    notes?: string;
    managerId?: string;
}
export interface InventoryFilterOptions {
    fleetId?: string;
    category?: InventoryCategory | InventoryCategory[];
    status?: StockStatus | StockStatus[];
    managerId?: string;
    lowStockOnly?: boolean;
    criticalOnly?: boolean;
    searchTerm?: string;
    page?: number;
    limit?: number;
    sortBy?: 'itemName' | 'quantity' | 'status' | 'category' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
}
export interface StockAdjustmentDto {
    quantity: number;
    reason: string;
    adjustedBy: string;
}
//# sourceMappingURL=FleetInventory.d.ts.map