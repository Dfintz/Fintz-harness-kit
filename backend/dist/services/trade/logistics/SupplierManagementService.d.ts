export declare enum SupplierStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    SUSPENDED = "suspended",
    PREFERRED = "preferred"
}
export declare enum SupplierCategory {
    FUEL = "fuel",
    AMMUNITION = "ammunition",
    MEDICAL = "medical",
    FOOD = "food",
    MINING = "mining",
    REPAIR = "repair",
    COMPONENTS = "components",
    GENERAL = "general"
}
export interface Supplier {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    category: SupplierCategory;
    status: SupplierStatus;
    contactEmail?: string;
    contactName?: string;
    location: string;
    systemName?: string;
    products: string[];
    metrics: SupplierMetrics;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SupplierMetrics {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    averageDeliveryTime: number;
    averageQualityRating: number;
    totalSpent: number;
    lastOrderDate?: Date;
    reliabilityScore: number;
}
export interface CreateSupplierDto {
    organizationId: string;
    name: string;
    description?: string;
    category: SupplierCategory;
    contactEmail?: string;
    contactName?: string;
    location: string;
    systemName?: string;
    products: string[];
    notes?: string;
}
export interface UpdateSupplierDto {
    name?: string;
    description?: string;
    category?: SupplierCategory;
    status?: SupplierStatus;
    contactEmail?: string;
    contactName?: string;
    location?: string;
    systemName?: string;
    products?: string[];
    notes?: string;
}
export interface SupplierOrder {
    id: string;
    supplierId: string;
    organizationId: string;
    items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
    }>;
    totalAmount: number;
    orderDate: Date;
    expectedDeliveryDate: Date;
    actualDeliveryDate?: Date;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    qualityRating?: number;
    notes?: string;
}
export interface SupplierFilterOptions {
    category?: SupplierCategory;
    status?: SupplierStatus;
    minReliabilityScore?: number;
    product?: string;
    location?: string;
}
export interface SupplierComparison {
    suppliers: Array<{
        supplier: Supplier;
        score: number;
        breakdown: {
            reliabilityWeight: number;
            qualityWeight: number;
            priceWeight: number;
            deliveryTimeWeight: number;
        };
    }>;
    recommendation: Supplier | null;
}
export declare class SupplierManagementService {
    private suppliers;
    private orders;
    private static readonly DEFAULT_PRICE_SCORE;
    private static readonly DEFAULT_DELIVERY_SCORE;
    constructor();
    createSupplier(dto: CreateSupplierDto): Promise<Supplier>;
    getSupplier(supplierId: string): Promise<Supplier | null>;
    getSuppliers(organizationId: string, filters?: SupplierFilterOptions): Promise<Supplier[]>;
    updateSupplier(supplierId: string, dto: UpdateSupplierDto): Promise<Supplier | null>;
    deleteSupplier(supplierId: string): Promise<boolean>;
    setPreferredSupplier(supplierId: string, organizationId: string): Promise<Supplier | null>;
    recordOrder(supplierId: string, organizationId: string, items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
    }>, expectedDeliveryDate: Date, notes?: string): Promise<SupplierOrder>;
    completeOrder(orderId: string, actualDeliveryDate: Date, qualityRating: number): Promise<SupplierOrder | null>;
    cancelOrder(orderId: string): Promise<SupplierOrder | null>;
    getSupplierOrders(supplierId: string, status?: SupplierOrder['status']): Promise<SupplierOrder[]>;
    getOrganizationOrders(organizationId: string, status?: SupplierOrder['status']): Promise<SupplierOrder[]>;
    compareSuppliers(organizationId: string, product: string, weights?: {
        reliability?: number;
        quality?: number;
        price?: number;
        deliveryTime?: number;
    }): Promise<SupplierComparison>;
    getPerformanceReport(organizationId: string): Promise<{
        totalSuppliers: number;
        activeSuppliers: number;
        preferredSuppliers: number;
        averageReliabilityScore: number;
        totalSpent: number;
        topSuppliers: Supplier[];
        lowPerformers: Supplier[];
    }>;
    getRecommendedSupplier(organizationId: string, product: string): Promise<Supplier | null>;
    private calculateReliabilityScore;
}
export declare const supplierManagementService: SupplierManagementService;
//# sourceMappingURL=SupplierManagementService.d.ts.map