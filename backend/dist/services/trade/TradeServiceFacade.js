"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeServiceFacade = exports.TradeServiceFacade = void 0;
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const LogisticsAlertService_1 = require("./logistics/LogisticsAlertService");
const LogisticsDashboardService_1 = require("./logistics/LogisticsDashboardService");
const LogisticsRouteOptimizationService_1 = require("./logistics/LogisticsRouteOptimizationService");
const SupplierManagementService_1 = require("./logistics/SupplierManagementService");
const TradeAuditLogger_1 = require("./TradeAuditLogger");
const TradingService_1 = require("./trading/TradingService");
class TradeServiceFacade {
    tradingService;
    alertService;
    dashboardService;
    supplierService;
    routeOptimizationService;
    constructor(tradingService, alertService, dashboardService, supplierService, routeOptimizationService) {
        this.tradingService = tradingService || new TradingService_1.TradingService();
        this.alertService = alertService || new LogisticsAlertService_1.LogisticsAlertService();
        this.dashboardService = dashboardService || new LogisticsDashboardService_1.LogisticsDashboardService();
        this.supplierService = supplierService || new SupplierManagementService_1.SupplierManagementService();
        this.routeOptimizationService =
            routeOptimizationService || new LogisticsRouteOptimizationService_1.LogisticsRouteOptimizationService();
    }
    async createTradingRoute(dto) {
        logger_1.logger.info('TradeServiceFacade.createTradingRoute: Creating trading route', {
            organizationId: dto.organizationId,
            name: dto.name,
        });
        const route = await this.tradingService.createRoute(dto);
        (0, cacheInvalidation_1.invalidateTradeCache)(dto.organizationId);
        TradeAuditLogger_1.tradeAuditLogger.log({
            action: TradeAuditLogger_1.TradeAuditAction.TRADE_OFFER_CREATED,
            tradeId: route.id,
            traderId: dto.organizationId,
            organizationId: dto.organizationId,
            performedById: dto.organizationId,
            details: { name: route.name, routeId: route.id },
        });
        return route;
    }
    async getTradingRoutes(filters) {
        return this.tradingService.getRoutes(filters);
    }
    async getOrganizationRoutes(organizationId, options) {
        return this.tradingService.getOrganizationRoutes(organizationId, options);
    }
    async getTradingRouteById(id, organizationId) {
        return this.tradingService.getRouteById(id, organizationId);
    }
    async updateTradingRoute(id, dto, organizationId) {
        logger_1.logger.info('TradeServiceFacade.updateTradingRoute: Updating trading route', {
            id,
            organizationId,
        });
        const route = await this.tradingService.updateRoute(id, dto, organizationId);
        (0, cacheInvalidation_1.invalidateTradeCache)(organizationId);
        TradeAuditLogger_1.tradeAuditLogger.log({
            action: TradeAuditLogger_1.TradeAuditAction.TRADE_OFFER_CREATED,
            tradeId: id,
            traderId: organizationId,
            organizationId,
            performedById: organizationId,
            details: { updatedFields: Object.keys(dto) },
        });
        return route;
    }
    async deleteTradingRoute(id, organizationId) {
        logger_1.logger.info('TradeServiceFacade.deleteTradingRoute: Deleting trading route', {
            id,
            organizationId,
        });
        await this.tradingService.deleteRoute(id, organizationId);
        (0, cacheInvalidation_1.invalidateTradeCache)(organizationId);
        TradeAuditLogger_1.tradeAuditLogger.log({
            action: TradeAuditLogger_1.TradeAuditAction.TRADE_OFFER_CANCELLED,
            tradeId: id,
            traderId: organizationId,
            organizationId,
            performedById: organizationId,
            details: {},
        });
    }
    async recordRouteRun(id, profit, duration, organizationId, userId, options) {
        logger_1.logger.info('TradeServiceFacade.recordRouteRun: Recording route run', {
            id,
            profit,
            organizationId,
            userId,
        });
        const route = await this.tradingService.recordRouteRun(id, profit, duration, organizationId, userId, options);
        (0, cacheInvalidation_1.invalidateTradeCache)(organizationId);
        TradeAuditLogger_1.tradeAuditLogger.log({
            action: TradeAuditLogger_1.TradeAuditAction.TRADE_COMPLETED,
            tradeId: id,
            traderId: userId ?? organizationId,
            organizationId,
            performedById: userId ?? organizationId,
            value: profit,
            details: { profit, duration, fleetId: options?.fleetId },
        });
        return route;
    }
    async findTradeOpportunities(startLocation, minProfitMargin, limit) {
        return this.tradingService.findTradeOpportunities(startLocation, minProfitMargin, limit);
    }
    async optimizeRoute(options) {
        return this.tradingService.optimizeRoute(options);
    }
    async analyzeRouteProfitability(id) {
        return this.tradingService.analyzeRouteProfitability(id);
    }
    async shareRoute(routeId, targetOrganizationId, sharedByUserId, ownerOrganizationId, permissions) {
        return this.tradingService.shareRoute(routeId, targetOrganizationId, sharedByUserId, ownerOrganizationId, permissions);
    }
    async createLogisticsAlert(dto) {
        return this.alertService.createAlert(dto);
    }
    async getLogisticsAlerts(filters) {
        return this.alertService.getAlerts(filters);
    }
    async getLogisticsAlertById(id) {
        return this.alertService.getAlertById(id);
    }
    async updateLogisticsAlert(id, dto) {
        return this.alertService.updateAlert(id, dto);
    }
    async acknowledgeLogisticsAlert(id, userId) {
        return this.alertService.acknowledgeAlert(id, userId);
    }
    async resolveLogisticsAlert(id, userId, notes) {
        return this.alertService.resolveAlert(id, userId, notes);
    }
    async dismissLogisticsAlert(id) {
        return this.alertService.dismissAlert(id);
    }
    async deleteLogisticsAlert(id) {
        return this.alertService.deleteAlert(id);
    }
    async checkInventoryAndGenerateAlerts(fleetId) {
        return this.alertService.checkInventoryAndGenerateAlerts(fleetId);
    }
    async autoResolveAlerts() {
        return this.alertService.autoResolveAlerts();
    }
    async getAlertStatistics(fleetId) {
        return this.alertService.getAlertStatistics(fleetId);
    }
    async getPredictiveRestockRecommendations(organizationId, fleetId) {
        return this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId);
    }
    async getDashboardMetrics(fleetId) {
        return this.dashboardService.getDashboardMetrics(fleetId);
    }
    async getCategoryBreakdown(fleetId) {
        return this.dashboardService.getCategoryBreakdown(fleetId);
    }
    async getAlertSummary(fleetId) {
        return this.dashboardService.getAlertSummary(fleetId);
    }
    async getOperationsSummary(fleetId) {
        return this.dashboardService.getOperationsSummary(fleetId);
    }
    async getSupplierPerformance(fleetId) {
        return this.dashboardService.getSupplierPerformance(fleetId);
    }
    async getConsumptionReport(fleetId, days) {
        return this.dashboardService.getConsumptionReport(fleetId, days);
    }
    async getStockValueTrend(fleetId, days) {
        return this.dashboardService.getStockValueTrend(fleetId, days);
    }
    async getTradeOverview(organizationId, fleetId) {
        const cacheKey = `org:${organizationId}:trade:overview:${fleetId ?? 'all'}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [tradingRoutes, activeAlerts, restockRecommendations] = await Promise.all([
            this.tradingService.getRoutes({ organizationId }),
            this.alertService.getAlerts({ fleetId, activeOnly: true }),
            this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId),
        ]);
        let dashboardMetrics = null;
        if (fleetId) {
            dashboardMetrics = await this.dashboardService.getDashboardMetrics(fleetId);
        }
        const result = {
            tradingRoutes,
            activeAlerts,
            dashboardMetrics,
            restockRecommendations,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async createSupplier(dto) {
        return this.supplierService.createSupplier(dto);
    }
    async getSupplier(supplierId) {
        return this.supplierService.getSupplier(supplierId);
    }
    async getSuppliers(organizationId, filters) {
        return this.supplierService.getSuppliers(organizationId, filters);
    }
    async updateSupplier(supplierId, dto) {
        return this.supplierService.updateSupplier(supplierId, dto);
    }
    async deleteSupplier(supplierId) {
        return this.supplierService.deleteSupplier(supplierId);
    }
    async setPreferredSupplier(supplierId, organizationId) {
        return this.supplierService.setPreferredSupplier(supplierId, organizationId);
    }
    async recordSupplierOrder(supplierId, organizationId, items, expectedDeliveryDate, notes) {
        return this.supplierService.recordOrder(supplierId, organizationId, items, expectedDeliveryDate, notes);
    }
    async completeSupplierOrder(orderId, actualDeliveryDate, qualityRating) {
        return this.supplierService.completeOrder(orderId, actualDeliveryDate, qualityRating);
    }
    async cancelSupplierOrder(orderId) {
        return this.supplierService.cancelOrder(orderId);
    }
    async getSupplierOrders(supplierId, status) {
        return this.supplierService.getSupplierOrders(supplierId, status);
    }
    async getOrganizationOrders(organizationId, status) {
        return this.supplierService.getOrganizationOrders(organizationId, status);
    }
    async compareSuppliers(organizationId, product, weights) {
        return this.supplierService.compareSuppliers(organizationId, product, weights);
    }
    async getSupplierPerformanceReport(organizationId) {
        return this.supplierService.getPerformanceReport(organizationId);
    }
    async getRecommendedSupplier(organizationId, product) {
        return this.supplierService.getRecommendedSupplier(organizationId, product);
    }
    async optimizeLogisticsRoute(options) {
        return this.routeOptimizationService.optimizeRoute(options);
    }
    async getOptimizedRoute(routeId) {
        return this.routeOptimizationService.getRoute(routeId);
    }
    async getOrganizationOptimizedRoutes(organizationId) {
        return this.routeOptimizationService.getOrganizationRoutes(organizationId);
    }
    async deleteOptimizedRoute(routeId) {
        return this.routeOptimizationService.deleteRoute(routeId);
    }
    async analyzeSupplyChain(organizationId) {
        return this.routeOptimizationService.analyzeSupplyChain(organizationId);
    }
    async getFullOverview(organizationId, fleetId) {
        const [tradingRoutes, activeAlerts, restockRecommendations, supplierReport, supplyChainAnalysis,] = await Promise.all([
            this.tradingService.getRoutes({ organizationId }),
            this.alertService.getAlerts({ fleetId, activeOnly: true }),
            this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId),
            this.supplierService.getPerformanceReport(organizationId),
            this.routeOptimizationService.analyzeSupplyChain(organizationId),
        ]);
        let dashboardMetrics = null;
        if (fleetId) {
            dashboardMetrics = await this.dashboardService.getDashboardMetrics(fleetId);
        }
        return {
            tradingRoutes,
            activeAlerts,
            dashboardMetrics,
            restockRecommendations,
            supplierReport,
            supplyChainAnalysis,
        };
    }
}
exports.TradeServiceFacade = TradeServiceFacade;
exports.tradeServiceFacade = new TradeServiceFacade();
//# sourceMappingURL=TradeServiceFacade.js.map