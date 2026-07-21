/**
 * Supplier Management Service
 * 
 * Manages suppliers for fleet inventory, tracks supplier performance,
 * and provides supplier analytics and recommendations.
 * 
 * Features:
 * - Supplier CRUD operations with organization scoping
 * - Supplier performance tracking (on-time delivery, quality ratings)
 * - Supplier comparison and ranking
 * - Preferred supplier management
 * - Supplier order history
 */

import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../../utils/logger';

/**
 * Supplier status enum
 */
export enum SupplierStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
    PREFERRED = 'preferred'
}

/**
 * Supplier category enum
 */
export enum SupplierCategory {
    FUEL = 'fuel',
    AMMUNITION = 'ammunition',
    MEDICAL = 'medical',
    FOOD = 'food',
    MINING = 'mining',
    REPAIR = 'repair',
    COMPONENTS = 'components',
    GENERAL = 'general'
}

/**
 * Supplier entity
 */
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

/**
 * Supplier performance metrics
 */
export interface SupplierMetrics {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    averageDeliveryTime: number; // in hours
    averageQualityRating: number; // 1-5
    totalSpent: number;
    lastOrderDate?: Date;
    reliabilityScore: number; // calculated 0-100
}

/**
 * Create supplier DTO
 */
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

/**
 * Update supplier DTO
 */
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

/**
 * Supplier order for tracking
 */
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

/**
 * Supplier filter options
 */
export interface SupplierFilterOptions {
    category?: SupplierCategory;
    status?: SupplierStatus;
    minReliabilityScore?: number;
    product?: string;
    location?: string;
}

/**
 * Supplier comparison result
 */
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

/**
 * Service for managing suppliers and their performance
 */
export class SupplierManagementService {
    // In-memory storage (would be replaced with database in production)
    private suppliers: Map<string, Supplier> = new Map();
    private orders: Map<string, SupplierOrder> = new Map();

    /**
     * Default price score when comparison data is unavailable.
     * A neutral score of 50 indicates no preference due to lack of pricing data.
     */
    private static readonly DEFAULT_PRICE_SCORE = 50;

    /**
     * Default delivery time score when no delivery history exists.
     * A neutral score of 50 indicates no preference due to lack of delivery data.
     */
    private static readonly DEFAULT_DELIVERY_SCORE = 50;

    constructor() {
        logger.info('SupplierManagementService initialized');
    }

    // ==================== SUPPLIER CRUD ====================

    /**
     * Create a new supplier
     */
    public async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
        const id = uuidv4();
        const now = new Date();

        const supplier: Supplier = {
            id,
            organizationId: dto.organizationId,
            name: dto.name,
            description: dto.description,
            category: dto.category,
            status: SupplierStatus.ACTIVE,
            contactEmail: dto.contactEmail,
            contactName: dto.contactName,
            location: dto.location,
            systemName: dto.systemName,
            products: dto.products,
            metrics: {
                totalOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                onTimeDeliveries: 0,
                lateDeliveries: 0,
                averageDeliveryTime: 0,
                averageQualityRating: 0,
                totalSpent: 0,
                reliabilityScore: 100 // Start with perfect score
            },
            notes: dto.notes,
            createdAt: now,
            updatedAt: now
        };

        this.suppliers.set(id, supplier);
        
        logger.info(`Created supplier: ${supplier.name}`, {
            supplierId: id,
            organizationId: dto.organizationId
        });

        return supplier;
    }

    /**
     * Get supplier by ID
     */
    public async getSupplier(supplierId: string): Promise<Supplier | null> {
        return this.suppliers.get(supplierId) || null;
    }

    /**
     * Get suppliers for an organization
     */
    public async getSuppliers(
        organizationId: string,
        filters?: SupplierFilterOptions
    ): Promise<Supplier[]> {
        let suppliers = Array.from(this.suppliers.values())
            .filter(s => s.organizationId === organizationId);

        if (filters) {
            if (filters.category) {
                suppliers = suppliers.filter(s => s.category === filters.category);
            }
            if (filters.status) {
                suppliers = suppliers.filter(s => s.status === filters.status);
            }
            if (filters.minReliabilityScore !== undefined) {
                // @ts-expect-error - Strict mode compatibility
                suppliers = suppliers.filter(s => s.metrics.reliabilityScore >= filters.minReliabilityScore);
            }
            if (filters.product) {
                const productLower = filters.product.toLowerCase();
                suppliers = suppliers.filter(s => 
                    s.products.some(p => p.toLowerCase().includes(productLower))
                );
            }
            if (filters.location) {
                const locationLower = filters.location.toLowerCase();
                suppliers = suppliers.filter(s => 
                    s.location.toLowerCase().includes(locationLower)
                );
            }
        }

        return suppliers.sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore);
    }

    /**
     * Update a supplier
     */
    public async updateSupplier(
        supplierId: string,
        dto: UpdateSupplierDto
    ): Promise<Supplier | null> {
        const supplier = this.suppliers.get(supplierId);
        if (!supplier) {
            return null;
        }

        const updated: Supplier = {
            ...supplier,
            ...dto,
            updatedAt: new Date()
        };

        this.suppliers.set(supplierId, updated);

        logger.info(`Updated supplier: ${updated.name}`, { supplierId });

        return updated;
    }

    /**
     * Delete a supplier
     */
    public async deleteSupplier(supplierId: string): Promise<boolean> {
        const deleted = this.suppliers.delete(supplierId);
        
        if (deleted) {
            logger.info(`Deleted supplier: ${supplierId}`);
        }

        return deleted;
    }

    /**
     * Set supplier as preferred
     */
    public async setPreferredSupplier(
        supplierId: string,
        organizationId: string
    ): Promise<Supplier | null> {
        const supplier = this.suppliers.get(supplierId);
        if (supplier?.organizationId !== organizationId) {
            return null;
        }

        // Remove preferred status from other suppliers in same category
        for (const s of this.suppliers.values()) {
            if (s.organizationId === organizationId && 
                s.category === supplier.category && 
                s.status === SupplierStatus.PREFERRED) {
                s.status = SupplierStatus.ACTIVE;
            }
        }

        supplier.status = SupplierStatus.PREFERRED;
        supplier.updatedAt = new Date();
        
        logger.info(`Set preferred supplier: ${supplier.name} for category ${supplier.category}`, {
            supplierId,
            organizationId
        });

        return supplier;
    }

    // ==================== ORDER TRACKING ====================

    /**
     * Record a supplier order
     */
    public async recordOrder(
        supplierId: string,
        organizationId: string,
        items: Array<{ name: string; quantity: number; unitPrice: number }>,
        expectedDeliveryDate: Date,
        notes?: string
    ): Promise<SupplierOrder> {
        const supplier = this.suppliers.get(supplierId);
        if (!supplier) {
            throw new Error(`Supplier ${supplierId} not found`);
        }

        const id = uuidv4();
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        const order: SupplierOrder = {
            id,
            supplierId,
            organizationId,
            items,
            totalAmount,
            orderDate: new Date(),
            expectedDeliveryDate,
            status: 'pending',
            notes
        };

        this.orders.set(id, order);

        // Update supplier metrics
        supplier.metrics.totalOrders++;
        supplier.metrics.lastOrderDate = new Date();
        supplier.updatedAt = new Date();

        logger.info(`Recorded order for supplier: ${supplier.name}`, {
            orderId: id,
            supplierId,
            totalAmount
        });

        return order;
    }

    /**
     * Complete a supplier order
     */
    public async completeOrder(
        orderId: string,
        actualDeliveryDate: Date,
        qualityRating: number // 1-5
    ): Promise<SupplierOrder | null> {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        const supplier = this.suppliers.get(order.supplierId);
        if (!supplier) {
            return null;
        }

        // Update order
        order.status = 'delivered';
        order.actualDeliveryDate = actualDeliveryDate;
        order.qualityRating = qualityRating;

        // Update supplier metrics
        const metrics = supplier.metrics;
        metrics.completedOrders++;
        metrics.totalSpent += order.totalAmount;

        // Calculate if on time
        const isOnTime = actualDeliveryDate <= order.expectedDeliveryDate;
        if (isOnTime) {
            metrics.onTimeDeliveries++;
        } else {
            metrics.lateDeliveries++;
        }

        // Update delivery time average
        const deliveryHours = (actualDeliveryDate.getTime() - order.orderDate.getTime()) / (1000 * 60 * 60);
        metrics.averageDeliveryTime = (
            (metrics.averageDeliveryTime * (metrics.completedOrders - 1)) + deliveryHours
        ) / metrics.completedOrders;

        // Update quality rating average
        metrics.averageQualityRating = (
            (metrics.averageQualityRating * (metrics.completedOrders - 1)) + qualityRating
        ) / metrics.completedOrders;

        // Recalculate reliability score
        metrics.reliabilityScore = this.calculateReliabilityScore(metrics);
        supplier.updatedAt = new Date();

        logger.info(`Completed order: ${orderId}`, {
            supplierId: order.supplierId,
            isOnTime,
            qualityRating,
            newReliabilityScore: metrics.reliabilityScore
        });

        return order;
    }

    /**
     * Cancel a supplier order
     */
    public async cancelOrder(orderId: string): Promise<SupplierOrder | null> {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        const supplier = this.suppliers.get(order.supplierId);
        if (!supplier) {
            return null;
        }

        order.status = 'cancelled';
        supplier.metrics.cancelledOrders++;
        supplier.metrics.reliabilityScore = this.calculateReliabilityScore(supplier.metrics);
        supplier.updatedAt = new Date();

        logger.info(`Cancelled order: ${orderId}`, { supplierId: order.supplierId });

        return order;
    }

    /**
     * Get orders for a supplier
     */
    public async getSupplierOrders(
        supplierId: string,
        status?: SupplierOrder['status']
    ): Promise<SupplierOrder[]> {
        let orders = Array.from(this.orders.values())
            .filter(o => o.supplierId === supplierId);

        if (status) {
            orders = orders.filter(o => o.status === status);
        }

        return orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    }

    /**
     * Get organization orders
     */
    public async getOrganizationOrders(
        organizationId: string,
        status?: SupplierOrder['status']
    ): Promise<SupplierOrder[]> {
        let orders = Array.from(this.orders.values())
            .filter(o => o.organizationId === organizationId);

        if (status) {
            orders = orders.filter(o => o.status === status);
        }

        return orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    }

    // ==================== ANALYTICS & RECOMMENDATIONS ====================

    /**
     * Compare suppliers for a product
     */
    public async compareSuppliers(
        organizationId: string,
        product: string,
        weights: {
            reliability?: number;
            quality?: number;
            price?: number;
            deliveryTime?: number;
        } = {}
    ): Promise<SupplierComparison> {
        // Default weights
        const reliabilityWeight = weights.reliability ?? 0.35;
        const qualityWeight = weights.quality ?? 0.30;
        const priceWeight = weights.price ?? 0.20;
        const deliveryTimeWeight = weights.deliveryTime ?? 0.15;

        // Get suppliers that provide this product
        const suppliers = await this.getSuppliers(organizationId, { product });

        if (suppliers.length === 0) {
            return { suppliers: [], recommendation: null };
        }

        // Calculate scores for each supplier
        const scored = suppliers.map(supplier => {
            const metrics = supplier.metrics;
            
            // Normalize metrics to 0-100 scale
            const reliabilityScore = metrics.reliabilityScore;
            const qualityScore = (metrics.averageQualityRating / 5) * 100;
            
            // For price and delivery time, lower is better
            // Use default neutral scores when comparison data is unavailable
            const priceScore = SupplierManagementService.DEFAULT_PRICE_SCORE;
            const deliveryTimeScore = metrics.averageDeliveryTime > 0 
                ? Math.max(0, 100 - metrics.averageDeliveryTime) 
                : SupplierManagementService.DEFAULT_DELIVERY_SCORE;

            const totalScore = (
                (reliabilityScore * reliabilityWeight) +
                (qualityScore * qualityWeight) +
                (priceScore * priceWeight) +
                (deliveryTimeScore * deliveryTimeWeight)
            );

            return {
                supplier,
                score: Math.round(totalScore * 100) / 100,
                breakdown: {
                    reliabilityWeight: Math.round(reliabilityScore * reliabilityWeight),
                    qualityWeight: Math.round(qualityScore * qualityWeight),
                    priceWeight: Math.round(priceScore * priceWeight),
                    deliveryTimeWeight: Math.round(deliveryTimeScore * deliveryTimeWeight)
                }
            };
        });

        // Sort by score (highest first)
        scored.sort((a, b) => b.score - a.score);

        return {
            suppliers: scored,
            recommendation: scored.length > 0 ? scored[0].supplier : null
        };
    }

    /**
     * Get supplier performance report
     */
    public async getPerformanceReport(
        organizationId: string
    ): Promise<{
        totalSuppliers: number;
        activeSuppliers: number;
        preferredSuppliers: number;
        averageReliabilityScore: number;
        totalSpent: number;
        topSuppliers: Supplier[];
        lowPerformers: Supplier[];
    }> {
        const suppliers = await this.getSuppliers(organizationId);

        const activeSuppliers = suppliers.filter(s => 
            s.status === SupplierStatus.ACTIVE || s.status === SupplierStatus.PREFERRED
        );

        const preferredSuppliers = suppliers.filter(s => 
            s.status === SupplierStatus.PREFERRED
        );

        const totalReliability = suppliers.reduce((sum, s) => sum + s.metrics.reliabilityScore, 0);
        const averageReliability = suppliers.length > 0 
            ? Math.round(totalReliability / suppliers.length) 
            : 0;

        const totalSpent = suppliers.reduce((sum, s) => sum + s.metrics.totalSpent, 0);

        // Top 5 suppliers by reliability score
        const topSuppliers = [...suppliers]
            .sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore)
            .slice(0, 5);

        // Bottom 5 suppliers (with at least 1 order) by reliability score
        const lowPerformers = [...suppliers]
            .filter(s => s.metrics.totalOrders > 0)
            .sort((a, b) => a.metrics.reliabilityScore - b.metrics.reliabilityScore)
            .slice(0, 5);

        return {
            totalSuppliers: suppliers.length,
            activeSuppliers: activeSuppliers.length,
            preferredSuppliers: preferredSuppliers.length,
            averageReliabilityScore: averageReliability,
            totalSpent,
            topSuppliers,
            lowPerformers
        };
    }

    /**
     * Get recommended supplier for a product
     */
    public async getRecommendedSupplier(
        organizationId: string,
        product: string
    ): Promise<Supplier | null> {
        // First check for preferred supplier
        const suppliers = await this.getSuppliers(organizationId, {
            product,
            status: SupplierStatus.PREFERRED
        });

        if (suppliers.length > 0) {
            return suppliers[0];
        }

        // Otherwise use comparison to find best
        const comparison = await this.compareSuppliers(organizationId, product);
        return comparison.recommendation;
    }

    // ==================== HELPER METHODS ====================

    /**
     * Calculate reliability score based on metrics
     */
    private calculateReliabilityScore(metrics: SupplierMetrics): number {
        if (metrics.totalOrders === 0) {
            return 100; // New suppliers start with perfect score
        }

        let score = 100;

        // Deduct for late deliveries (up to 30 points)
        if (metrics.completedOrders > 0) {
            const onTimeRate = metrics.onTimeDeliveries / metrics.completedOrders;
            score -= (1 - onTimeRate) * 30;
        }

        // Deduct for cancellations (up to 20 points)
        if (metrics.totalOrders > 0) {
            const cancellationRate = metrics.cancelledOrders / metrics.totalOrders;
            score -= cancellationRate * 20;
        }

        // Deduct for low quality (up to 25 points)
        if (metrics.averageQualityRating > 0) {
            const qualityScore = (metrics.averageQualityRating - 1) / 4; // Normalize 1-5 to 0-1
            score -= (1 - qualityScore) * 25;
        }

        // Bonus for experience (up to 10 points)
        const experienceBonus = Math.min(metrics.completedOrders / 10, 1) * 10;
        score += experienceBonus;

        // Clamp between 0 and 100
        return Math.round(Math.max(0, Math.min(100, score)));
    }
}

// Export singleton instance
export const supplierManagementService = new SupplierManagementService();


