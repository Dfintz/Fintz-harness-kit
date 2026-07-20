import { CommissaryItem } from '../../models/CommissaryItem';
import { CommissaryPurchase } from '../../models/CommissaryPurchase';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface CreateCommissaryItemDTO {
    name: string;
    description?: string;
    price: number;
    category: string;
    stock?: number;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
}
export interface UpdateCommissaryItemDTO {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    stock?: number;
    isActive?: boolean;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
}
export interface PurchaseItemDTO {
    itemId: string;
    quantity: number;
}
export interface CommissaryFilters {
    category?: string;
    activeOnly?: boolean;
    searchTerm?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export declare class CommissaryService extends TenantService<CommissaryItem> {
    private readonly purchaseRepo;
    private readonly treasuryService;
    constructor();
    createItem(organizationId: string, creatorId: string, dto: CreateCommissaryItemDTO): Promise<CommissaryItem>;
    getItemById(organizationId: string, itemId: string): Promise<CommissaryItem | null>;
    listItems(organizationId: string, pagination: PaginationOptions, filters?: CommissaryFilters): Promise<PaginatedResponse<CommissaryItem>>;
    updateItem(organizationId: string, itemId: string, dto: UpdateCommissaryItemDTO): Promise<CommissaryItem>;
    deleteItem(organizationId: string, itemId: string): Promise<void>;
    purchaseItem(organizationId: string, buyerId: string, dto: PurchaseItemDTO): Promise<CommissaryPurchase>;
    getPurchaseHistory(organizationId: string, pagination: PaginationOptions, buyerId?: string): Promise<PaginatedResponse<CommissaryPurchase>>;
}
//# sourceMappingURL=CommissaryService.d.ts.map