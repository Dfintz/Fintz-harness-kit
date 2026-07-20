import { OrganizationInventory, CreateOrganizationInventoryDto, UpdateOrganizationInventoryDto, OrganizationInventoryFilterOptions, OrganizationInventoryStatistics } from '../../models/OrganizationInventory';
export declare class OrganizationInventoryService {
    private inventoryRepository;
    private static readonly DEFAULT_SORT_BY;
    private static readonly DEFAULT_PAGE;
    private static readonly DEFAULT_LIMIT;
    private static readonly ALLOWED_SORT_FIELDS;
    constructor();
    createInventoryItem(organizationId: string, dto: CreateOrganizationInventoryDto): Promise<OrganizationInventory>;
    getInventory(organizationId: string, filters?: OrganizationInventoryFilterOptions): Promise<{
        items: OrganizationInventory[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getInventoryItemById(organizationId: string, id: string): Promise<OrganizationInventory | null>;
    updateInventoryItem(organizationId: string, id: string, dto: UpdateOrganizationInventoryDto): Promise<OrganizationInventory>;
    deleteInventoryItem(organizationId: string, id: string): Promise<void>;
    getInventoryStatistics(organizationId: string): Promise<OrganizationInventoryStatistics>;
    getTotalInventoryValue(organizationId: string): Promise<number>;
    getInventoryItemCount(organizationId: string): Promise<number>;
}
//# sourceMappingURL=OrganizationInventoryService.d.ts.map