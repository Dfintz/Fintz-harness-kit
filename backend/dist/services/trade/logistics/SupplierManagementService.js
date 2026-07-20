"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierManagementService = exports.SupplierManagementService = exports.SupplierCategory = exports.SupplierStatus = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../../../utils/logger");
var SupplierStatus;
(function (SupplierStatus) {
    SupplierStatus["ACTIVE"] = "active";
    SupplierStatus["INACTIVE"] = "inactive";
    SupplierStatus["SUSPENDED"] = "suspended";
    SupplierStatus["PREFERRED"] = "preferred";
})(SupplierStatus || (exports.SupplierStatus = SupplierStatus = {}));
var SupplierCategory;
(function (SupplierCategory) {
    SupplierCategory["FUEL"] = "fuel";
    SupplierCategory["AMMUNITION"] = "ammunition";
    SupplierCategory["MEDICAL"] = "medical";
    SupplierCategory["FOOD"] = "food";
    SupplierCategory["MINING"] = "mining";
    SupplierCategory["REPAIR"] = "repair";
    SupplierCategory["COMPONENTS"] = "components";
    SupplierCategory["GENERAL"] = "general";
})(SupplierCategory || (exports.SupplierCategory = SupplierCategory = {}));
class SupplierManagementService {
    suppliers = new Map();
    orders = new Map();
    static DEFAULT_PRICE_SCORE = 50;
    static DEFAULT_DELIVERY_SCORE = 50;
    constructor() {
        logger_1.logger.info('SupplierManagementService initialized');
    }
    async createSupplier(dto) {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const supplier = {
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
                reliabilityScore: 100
            },
            notes: dto.notes,
            createdAt: now,
            updatedAt: now
        };
        this.suppliers.set(id, supplier);
        logger_1.logger.info(`Created supplier: ${supplier.name}`, {
            supplierId: id,
            organizationId: dto.organizationId
        });
        return supplier;
    }
    async getSupplier(supplierId) {
        return this.suppliers.get(supplierId) || null;
    }
    async getSuppliers(organizationId, filters) {
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
                suppliers = suppliers.filter(s => s.metrics.reliabilityScore >= filters.minReliabilityScore);
            }
            if (filters.product) {
                const productLower = filters.product.toLowerCase();
                suppliers = suppliers.filter(s => s.products.some(p => p.toLowerCase().includes(productLower)));
            }
            if (filters.location) {
                const locationLower = filters.location.toLowerCase();
                suppliers = suppliers.filter(s => s.location.toLowerCase().includes(locationLower));
            }
        }
        return suppliers.sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore);
    }
    async updateSupplier(supplierId, dto) {
        const supplier = this.suppliers.get(supplierId);
        if (!supplier) {
            return null;
        }
        const updated = {
            ...supplier,
            ...dto,
            updatedAt: new Date()
        };
        this.suppliers.set(supplierId, updated);
        logger_1.logger.info(`Updated supplier: ${updated.name}`, { supplierId });
        return updated;
    }
    async deleteSupplier(supplierId) {
        const deleted = this.suppliers.delete(supplierId);
        if (deleted) {
            logger_1.logger.info(`Deleted supplier: ${supplierId}`);
        }
        return deleted;
    }
    async setPreferredSupplier(supplierId, organizationId) {
        const supplier = this.suppliers.get(supplierId);
        if (supplier?.organizationId !== organizationId) {
            return null;
        }
        for (const s of this.suppliers.values()) {
            if (s.organizationId === organizationId &&
                s.category === supplier.category &&
                s.status === SupplierStatus.PREFERRED) {
                s.status = SupplierStatus.ACTIVE;
            }
        }
        supplier.status = SupplierStatus.PREFERRED;
        supplier.updatedAt = new Date();
        logger_1.logger.info(`Set preferred supplier: ${supplier.name} for category ${supplier.category}`, {
            supplierId,
            organizationId
        });
        return supplier;
    }
    async recordOrder(supplierId, organizationId, items, expectedDeliveryDate, notes) {
        const supplier = this.suppliers.get(supplierId);
        if (!supplier) {
            throw new Error(`Supplier ${supplierId} not found`);
        }
        const id = (0, uuid_1.v4)();
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const order = {
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
        supplier.metrics.totalOrders++;
        supplier.metrics.lastOrderDate = new Date();
        supplier.updatedAt = new Date();
        logger_1.logger.info(`Recorded order for supplier: ${supplier.name}`, {
            orderId: id,
            supplierId,
            totalAmount
        });
        return order;
    }
    async completeOrder(orderId, actualDeliveryDate, qualityRating) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }
        const supplier = this.suppliers.get(order.supplierId);
        if (!supplier) {
            return null;
        }
        order.status = 'delivered';
        order.actualDeliveryDate = actualDeliveryDate;
        order.qualityRating = qualityRating;
        const metrics = supplier.metrics;
        metrics.completedOrders++;
        metrics.totalSpent += order.totalAmount;
        const isOnTime = actualDeliveryDate <= order.expectedDeliveryDate;
        if (isOnTime) {
            metrics.onTimeDeliveries++;
        }
        else {
            metrics.lateDeliveries++;
        }
        const deliveryHours = (actualDeliveryDate.getTime() - order.orderDate.getTime()) / (1000 * 60 * 60);
        metrics.averageDeliveryTime = ((metrics.averageDeliveryTime * (metrics.completedOrders - 1)) + deliveryHours) / metrics.completedOrders;
        metrics.averageQualityRating = ((metrics.averageQualityRating * (metrics.completedOrders - 1)) + qualityRating) / metrics.completedOrders;
        metrics.reliabilityScore = this.calculateReliabilityScore(metrics);
        supplier.updatedAt = new Date();
        logger_1.logger.info(`Completed order: ${orderId}`, {
            supplierId: order.supplierId,
            isOnTime,
            qualityRating,
            newReliabilityScore: metrics.reliabilityScore
        });
        return order;
    }
    async cancelOrder(orderId) {
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
        logger_1.logger.info(`Cancelled order: ${orderId}`, { supplierId: order.supplierId });
        return order;
    }
    async getSupplierOrders(supplierId, status) {
        let orders = Array.from(this.orders.values())
            .filter(o => o.supplierId === supplierId);
        if (status) {
            orders = orders.filter(o => o.status === status);
        }
        return orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    }
    async getOrganizationOrders(organizationId, status) {
        let orders = Array.from(this.orders.values())
            .filter(o => o.organizationId === organizationId);
        if (status) {
            orders = orders.filter(o => o.status === status);
        }
        return orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    }
    async compareSuppliers(organizationId, product, weights = {}) {
        const reliabilityWeight = weights.reliability ?? 0.35;
        const qualityWeight = weights.quality ?? 0.30;
        const priceWeight = weights.price ?? 0.20;
        const deliveryTimeWeight = weights.deliveryTime ?? 0.15;
        const suppliers = await this.getSuppliers(organizationId, { product });
        if (suppliers.length === 0) {
            return { suppliers: [], recommendation: null };
        }
        const scored = suppliers.map(supplier => {
            const metrics = supplier.metrics;
            const reliabilityScore = metrics.reliabilityScore;
            const qualityScore = (metrics.averageQualityRating / 5) * 100;
            const priceScore = SupplierManagementService.DEFAULT_PRICE_SCORE;
            const deliveryTimeScore = metrics.averageDeliveryTime > 0
                ? Math.max(0, 100 - metrics.averageDeliveryTime)
                : SupplierManagementService.DEFAULT_DELIVERY_SCORE;
            const totalScore = ((reliabilityScore * reliabilityWeight) +
                (qualityScore * qualityWeight) +
                (priceScore * priceWeight) +
                (deliveryTimeScore * deliveryTimeWeight));
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
        scored.sort((a, b) => b.score - a.score);
        return {
            suppliers: scored,
            recommendation: scored.length > 0 ? scored[0].supplier : null
        };
    }
    async getPerformanceReport(organizationId) {
        const suppliers = await this.getSuppliers(organizationId);
        const activeSuppliers = suppliers.filter(s => s.status === SupplierStatus.ACTIVE || s.status === SupplierStatus.PREFERRED);
        const preferredSuppliers = suppliers.filter(s => s.status === SupplierStatus.PREFERRED);
        const totalReliability = suppliers.reduce((sum, s) => sum + s.metrics.reliabilityScore, 0);
        const averageReliability = suppliers.length > 0
            ? Math.round(totalReliability / suppliers.length)
            : 0;
        const totalSpent = suppliers.reduce((sum, s) => sum + s.metrics.totalSpent, 0);
        const topSuppliers = [...suppliers]
            .sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore)
            .slice(0, 5);
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
    async getRecommendedSupplier(organizationId, product) {
        const suppliers = await this.getSuppliers(organizationId, {
            product,
            status: SupplierStatus.PREFERRED
        });
        if (suppliers.length > 0) {
            return suppliers[0];
        }
        const comparison = await this.compareSuppliers(organizationId, product);
        return comparison.recommendation;
    }
    calculateReliabilityScore(metrics) {
        if (metrics.totalOrders === 0) {
            return 100;
        }
        let score = 100;
        if (metrics.completedOrders > 0) {
            const onTimeRate = metrics.onTimeDeliveries / metrics.completedOrders;
            score -= (1 - onTimeRate) * 30;
        }
        if (metrics.totalOrders > 0) {
            const cancellationRate = metrics.cancelledOrders / metrics.totalOrders;
            score -= cancellationRate * 20;
        }
        if (metrics.averageQualityRating > 0) {
            const qualityScore = (metrics.averageQualityRating - 1) / 4;
            score -= (1 - qualityScore) * 25;
        }
        const experienceBonus = Math.min(metrics.completedOrders / 10, 1) * 10;
        score += experienceBonus;
        return Math.round(Math.max(0, Math.min(100, score)));
    }
}
exports.SupplierManagementService = SupplierManagementService;
exports.supplierManagementService = new SupplierManagementService();
//# sourceMappingURL=SupplierManagementService.js.map