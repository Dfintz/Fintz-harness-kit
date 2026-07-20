export declare enum OrganizationInventoryCategory {
    SHIPS = "ships",
    COMPONENTS = "components",
    COMMODITIES = "commodities"
}
export declare class OrganizationInventory {
    id: string;
    organizationId: string;
    itemName: string;
    description?: string;
    category: OrganizationInventoryCategory;
    quantity: number;
    unit?: string;
    unitValue: number;
    totalValue: number;
    notes?: string;
    location?: string;
    assignedTo?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateOrganizationInventoryDto {
    itemName: string;
    description?: string;
    category: OrganizationInventoryCategory;
    quantity: number;
    unit?: string;
    unitValue: number;
    notes?: string;
    location?: string;
    assignedTo?: string;
}
export interface UpdateOrganizationInventoryDto {
    itemName?: string;
    description?: string;
    category?: OrganizationInventoryCategory;
    quantity?: number;
    unit?: string;
    unitValue?: number;
    notes?: string;
    location?: string;
    assignedTo?: string;
}
export interface OrganizationInventoryFilterOptions {
    category?: OrganizationInventoryCategory | OrganizationInventoryCategory[];
    searchTerm?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
    sortBy?: 'itemName' | 'quantity' | 'totalValue' | 'category' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
}
export interface OrganizationInventoryStatistics {
    totalItems: number;
    totalValue: number;
    byCategory: {
        ships: {
            count: number;
            value: number;
        };
        components: {
            count: number;
            value: number;
        };
        commodities: {
            count: number;
            value: number;
        };
    };
}
//# sourceMappingURL=OrganizationInventory.d.ts.map