/**
 * Trade Service Facade
 *
 * Unified facade for trade and logistics operations.
 * Provides a single entry point for managing trading routes, logistics alerts,
 * supply chain dashboards, supplier management, and route optimization.
 *
 * This facade consolidates the following services:
 * - TradingService: Trading routes, price analysis, route optimization
 * - LogisticsAlertService: Inventory alerts and notifications
 * - LogisticsDashboardService: Logistics dashboards and reports
 * - SupplierManagementService: Supplier CRUD and performance tracking
 * - LogisticsRouteOptimizationService: Route optimization for logistics
 */

import {
  AlertFilterOptions,
  CreateAlertDto,
  LogisticsAlert,
  UpdateAlertDto,
} from '../../models/LogisticsAlert';
import { TradeTransactionStatus } from '../../models/TradeTransaction';
import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { invalidateTradeCache } from '../../utils/cacheInvalidation';
import { logger } from '../../utils/logger';
import { PaginatedResponse } from '../../utils/pagination';
import { cache } from '../../utils/redis';


import { LogisticsAlertService, RestockRecommendation } from './logistics/LogisticsAlertService';
import {
  AlertSummary,
  CategoryBreakdown,
  ConsumptionReport,
  DashboardMetrics,
  SupplierPerformance as DashboardSupplierPerformance,
  LogisticsDashboardService,
  OperationsSummary,
} from './logistics/LogisticsDashboardService';
import {
  LogisticsRouteOptimizationService,
  RouteOptimizationOptions as LogisticsRouteOptions,
  OptimizedLogisticsRoute,
  SupplyChainAnalysis,
} from './logistics/LogisticsRouteOptimizationService';
import {
  CreateSupplierDto,
  Supplier,
  SupplierComparison,
  SupplierFilterOptions,
  SupplierManagementService,
  SupplierOrder,
  UpdateSupplierDto,
} from './logistics/SupplierManagementService';
import { TradeAuditAction, tradeAuditLogger } from './TradeAuditLogger';
import {
  CreateTradingRouteDto,
  RouteOptimizationOptions,
  TradeOpportunity,
  TradingService,
  UpdateTradingRouteDto,
} from './trading/TradingService';

/**
 * Unified Trade Service Facade
 *
 * Provides a unified API for all trade and logistics operations,
 * simplifying access to trading routes, logistics alerts, dashboards,
 * supplier management, and logistics route optimization.
 */
export class TradeServiceFacade {
  private readonly tradingService: TradingService;
  private readonly alertService: LogisticsAlertService;
  private readonly dashboardService: LogisticsDashboardService;
  private readonly supplierService: SupplierManagementService;
  private readonly routeOptimizationService: LogisticsRouteOptimizationService;

  constructor(
    tradingService?: TradingService,
    alertService?: LogisticsAlertService,
    dashboardService?: LogisticsDashboardService,
    supplierService?: SupplierManagementService,
    routeOptimizationService?: LogisticsRouteOptimizationService
  ) {
    this.tradingService = tradingService || new TradingService();
    this.alertService = alertService || new LogisticsAlertService();
    this.dashboardService = dashboardService || new LogisticsDashboardService();
    this.supplierService = supplierService || new SupplierManagementService();
    this.routeOptimizationService =
      routeOptimizationService || new LogisticsRouteOptimizationService();
  }

  // ==================== TRADING OPERATIONS ====================

  /**
   * Create a new trading route
   */
  public async createTradingRoute(dto: CreateTradingRouteDto): Promise<TradingRoute> {
    logger.info('TradeServiceFacade.createTradingRoute: Creating trading route', {
      organizationId: dto.organizationId,
      name: dto.name,
    });
    const route = await this.tradingService.createRoute(dto);
    invalidateTradeCache(dto.organizationId);
    tradeAuditLogger.log({
      action: TradeAuditAction.TRADE_OFFER_CREATED,
      tradeId: route.id,
      traderId: dto.organizationId,
      organizationId: dto.organizationId,
      performedById: dto.organizationId,
      details: { name: route.name, routeId: route.id },
    });
    return route;
  }

  /**
   * Get all trading routes with filters
   * organizationId is required for tenant isolation
   */
  public async getTradingRoutes(filters: {
    creatorId?: string;
    organizationId: string;
    status?: RouteStatus;
    tags?: string[];
    includeShared?: boolean;
  }): Promise<TradingRoute[]> {
    return this.tradingService.getRoutes(filters);
  }

  /**
   * Get organization routes with pagination
   */
  public async getOrganizationRoutes(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: RouteStatus;
      includeShared?: boolean;
    }
  ): Promise<PaginatedResponse<TradingRoute>> {
    return this.tradingService.getOrganizationRoutes(organizationId, options);
  }

  /**
   * Get trading route by ID with required tenant scoping
   */
  public async getTradingRouteById(
    id: string,
    organizationId: string
  ): Promise<TradingRoute | null> {
    return this.tradingService.getRouteById(id, organizationId);
  }

  /**
   * Update trading route with required tenant scoping
   */
  public async updateTradingRoute(
    id: string,
    dto: UpdateTradingRouteDto,
    organizationId: string
  ): Promise<TradingRoute> {
    logger.info('TradeServiceFacade.updateTradingRoute: Updating trading route', {
      id,
      organizationId,
    });
    const route = await this.tradingService.updateRoute(id, dto, organizationId);
    invalidateTradeCache(organizationId);
    tradeAuditLogger.log({
      action: TradeAuditAction.TRADE_OFFER_CREATED,
      tradeId: id,
      traderId: organizationId,
      organizationId,
      performedById: organizationId,
      details: { updatedFields: Object.keys(dto) },
    });
    return route;
  }

  /**
   * Delete trading route with required tenant scoping
   */
  public async deleteTradingRoute(id: string, organizationId: string): Promise<void> {
    logger.info('TradeServiceFacade.deleteTradingRoute: Deleting trading route', {
      id,
      organizationId,
    });
    await this.tradingService.deleteRoute(id, organizationId);
    invalidateTradeCache(organizationId);
    tradeAuditLogger.log({
      action: TradeAuditAction.TRADE_OFFER_CANCELLED,
      tradeId: id,
      traderId: organizationId,
      organizationId,
      performedById: organizationId,
      details: {},
    });
  }

  /**
   * Record a completed route run with tenant scoping
   */
  public async recordRouteRun(
    id: string,
    profit: number,
    duration: number,
    organizationId: string,
    userId?: string,
    options?: {
      fleetId?: string;
      estimatedProfit?: number;
      successStatus?: TradeTransactionStatus;
    }
  ): Promise<TradingRoute> {
    logger.info('TradeServiceFacade.recordRouteRun: Recording route run', {
      id,
      profit,
      organizationId,
      userId,
    });
    const route = await this.tradingService.recordRouteRun(
      id,
      profit,
      duration,
      organizationId,
      userId,
      options
    );
    invalidateTradeCache(organizationId);
    tradeAuditLogger.log({
      action: TradeAuditAction.TRADE_COMPLETED,
      tradeId: id,
      traderId: userId ?? organizationId,
      organizationId,
      performedById: userId ?? organizationId,
      value: profit,
      details: { profit, duration, fleetId: options?.fleetId },
    });
    return route;
  }

  /**
   * Find best trade opportunities
   */
  public async findTradeOpportunities(
    startLocation: string,
    minProfitMargin?: number,
    limit?: number
  ): Promise<TradeOpportunity[]> {
    return this.tradingService.findTradeOpportunities(startLocation, minProfitMargin, limit);
  }

  /**
   * Optimize a trading route
   */
  public async optimizeRoute(options: RouteOptimizationOptions): Promise<unknown[]> {
    return this.tradingService.optimizeRoute(options);
  }

  /**
   * Get route profitability analysis
   */
  public async analyzeRouteProfitability(id: string): Promise<unknown> {
    return this.tradingService.analyzeRouteProfitability(id);
  }

  /**
   * Share a route with another organization
   */
  public async shareRoute(
    routeId: string,
    targetOrganizationId: string,
    sharedByUserId: string,
    ownerOrganizationId: string,
    permissions?: 'view' | 'use' | 'edit'
  ): Promise<unknown> {
    return this.tradingService.shareRoute(
      routeId,
      targetOrganizationId,
      sharedByUserId,
      ownerOrganizationId,
      permissions
    );
  }

  // ==================== LOGISTICS ALERT OPERATIONS ====================

  /**
   * Create a custom logistics alert
   */
  public async createLogisticsAlert(dto: CreateAlertDto): Promise<LogisticsAlert> {
    return this.alertService.createAlert(dto);
  }

  /**
   * Get logistics alerts with filtering
   */
  public async getLogisticsAlerts(filters: AlertFilterOptions): Promise<LogisticsAlert[]> {
    return this.alertService.getAlerts(filters);
  }

  /**
   * Get logistics alert by ID
   */
  public async getLogisticsAlertById(id: string): Promise<LogisticsAlert | null> {
    return this.alertService.getAlertById(id);
  }

  /**
   * Update logistics alert
   */
  public async updateLogisticsAlert(id: string, dto: UpdateAlertDto): Promise<LogisticsAlert> {
    return this.alertService.updateAlert(id, dto);
  }

  /**
   * Acknowledge logistics alert
   */
  public async acknowledgeLogisticsAlert(id: string, userId: string): Promise<LogisticsAlert> {
    return this.alertService.acknowledgeAlert(id, userId);
  }

  /**
   * Resolve logistics alert
   */
  public async resolveLogisticsAlert(
    id: string,
    userId: string,
    notes?: string
  ): Promise<LogisticsAlert> {
    return this.alertService.resolveAlert(id, userId, notes);
  }

  /**
   * Dismiss logistics alert
   */
  public async dismissLogisticsAlert(id: string): Promise<LogisticsAlert> {
    return this.alertService.dismissAlert(id);
  }

  /**
   * Delete logistics alert
   */
  public async deleteLogisticsAlert(id: string): Promise<void> {
    return this.alertService.deleteAlert(id);
  }

  /**
   * Check inventory and generate alerts
   */
  public async checkInventoryAndGenerateAlerts(fleetId?: string): Promise<LogisticsAlert[]> {
    return this.alertService.checkInventoryAndGenerateAlerts(fleetId);
  }

  /**
   * Auto-resolve alerts when conditions improve
   */
  public async autoResolveAlerts(): Promise<number> {
    return this.alertService.autoResolveAlerts();
  }

  /**
   * Get alert statistics
   */
  public async getAlertStatistics(fleetId: string): Promise<unknown> {
    return this.alertService.getAlertStatistics(fleetId);
  }

  /**
   * Get predictive restocking recommendations
   */
  public async getPredictiveRestockRecommendations(
    organizationId: string,
    fleetId?: string
  ): Promise<RestockRecommendation[]> {
    return this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId);
  }

  // ==================== LOGISTICS DASHBOARD OPERATIONS ====================

  /**
   * Get comprehensive dashboard metrics
   */
  public async getDashboardMetrics(fleetId: string): Promise<DashboardMetrics> {
    return this.dashboardService.getDashboardMetrics(fleetId);
  }

  /**
   * Get category breakdown
   */
  public async getCategoryBreakdown(fleetId: string): Promise<CategoryBreakdown[]> {
    return this.dashboardService.getCategoryBreakdown(fleetId);
  }

  /**
   * Get alert summary
   */
  public async getAlertSummary(fleetId: string): Promise<AlertSummary[]> {
    return this.dashboardService.getAlertSummary(fleetId);
  }

  /**
   * Get operations summary
   */
  public async getOperationsSummary(fleetId: string): Promise<OperationsSummary[]> {
    return this.dashboardService.getOperationsSummary(fleetId);
  }

  /**
   * Get supplier performance report
   */
  public async getSupplierPerformance(fleetId: string): Promise<DashboardSupplierPerformance[]> {
    return this.dashboardService.getSupplierPerformance(fleetId);
  }

  /**
   * Get consumption report
   */
  public async getConsumptionReport(fleetId: string, days?: number): Promise<ConsumptionReport[]> {
    return this.dashboardService.getConsumptionReport(fleetId, days);
  }

  /**
   * Get stock value trend
   */
  public async getStockValueTrend(fleetId: string, days?: number): Promise<unknown[]> {
    return this.dashboardService.getStockValueTrend(fleetId, days);
  }

  // ==================== COMBINED OPERATIONS ====================

  /**
   * Get comprehensive trade and logistics overview for an organization
   */
  public async getTradeOverview(
    organizationId: string,
    fleetId?: string
  ): Promise<{
    tradingRoutes: TradingRoute[];
    activeAlerts: LogisticsAlert[];
    dashboardMetrics: DashboardMetrics | null;
    restockRecommendations: RestockRecommendation[];
  }> {
    // Redis cache: 5 min TTL (Phase 5.10)
    const cacheKey = `org:${organizationId}:trade:overview:${fleetId ?? 'all'}`;
    const cached = await cache.get<{
      tradingRoutes: TradingRoute[];
      activeAlerts: LogisticsAlert[];
      dashboardMetrics: DashboardMetrics | null;
      restockRecommendations: RestockRecommendation[];
    }>(cacheKey);
    if (cached) {
      return cached;
    }
    const [tradingRoutes, activeAlerts, restockRecommendations] = await Promise.all([
      this.tradingService.getRoutes({ organizationId }),
      this.alertService.getAlerts({ fleetId, activeOnly: true }),
      this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId),
    ]);

    let dashboardMetrics: DashboardMetrics | null = null;
    if (fleetId) {
      dashboardMetrics = await this.dashboardService.getDashboardMetrics(fleetId);
    }

    const result = {
      tradingRoutes,
      activeAlerts,
      dashboardMetrics,
      restockRecommendations,
    };

    await cache.set(cacheKey, result, 300);

    return result;
  }

  // ==================== SUPPLIER MANAGEMENT OPERATIONS ====================

  /**
   * Create a new supplier
   */
  public async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    return this.supplierService.createSupplier(dto);
  }

  /**
   * Get supplier by ID
   */
  public async getSupplier(supplierId: string): Promise<Supplier | null> {
    return this.supplierService.getSupplier(supplierId);
  }

  /**
   * Get all suppliers for an organization
   */
  public async getSuppliers(
    organizationId: string,
    filters?: SupplierFilterOptions
  ): Promise<Supplier[]> {
    return this.supplierService.getSuppliers(organizationId, filters);
  }

  /**
   * Update a supplier
   */
  public async updateSupplier(
    supplierId: string,
    dto: UpdateSupplierDto
  ): Promise<Supplier | null> {
    return this.supplierService.updateSupplier(supplierId, dto);
  }

  /**
   * Delete a supplier
   */
  public async deleteSupplier(supplierId: string): Promise<boolean> {
    return this.supplierService.deleteSupplier(supplierId);
  }

  /**
   * Set supplier as preferred
   */
  public async setPreferredSupplier(
    supplierId: string,
    organizationId: string
  ): Promise<Supplier | null> {
    return this.supplierService.setPreferredSupplier(supplierId, organizationId);
  }

  /**
   * Record a supplier order
   */
  public async recordSupplierOrder(
    supplierId: string,
    organizationId: string,
    items: Array<{ name: string; quantity: number; unitPrice: number }>,
    expectedDeliveryDate: Date,
    notes?: string
  ): Promise<SupplierOrder> {
    return this.supplierService.recordOrder(
      supplierId,
      organizationId,
      items,
      expectedDeliveryDate,
      notes
    );
  }

  /**
   * Complete a supplier order
   */
  public async completeSupplierOrder(
    orderId: string,
    actualDeliveryDate: Date,
    qualityRating: number
  ): Promise<SupplierOrder | null> {
    return this.supplierService.completeOrder(orderId, actualDeliveryDate, qualityRating);
  }

  /**
   * Cancel a supplier order
   */
  public async cancelSupplierOrder(orderId: string): Promise<SupplierOrder | null> {
    return this.supplierService.cancelOrder(orderId);
  }

  /**
   * Get orders for a supplier
   */
  public async getSupplierOrders(
    supplierId: string,
    status?: SupplierOrder['status']
  ): Promise<SupplierOrder[]> {
    return this.supplierService.getSupplierOrders(supplierId, status);
  }

  /**
   * Get organization orders
   */
  public async getOrganizationOrders(
    organizationId: string,
    status?: SupplierOrder['status']
  ): Promise<SupplierOrder[]> {
    return this.supplierService.getOrganizationOrders(organizationId, status);
  }

  /**
   * Compare suppliers for a product
   */
  public async compareSuppliers(
    organizationId: string,
    product: string,
    weights?: {
      reliability?: number;
      quality?: number;
      price?: number;
      deliveryTime?: number;
    }
  ): Promise<SupplierComparison> {
    return this.supplierService.compareSuppliers(organizationId, product, weights);
  }

  /**
   * Get supplier performance report (from supplier service)
   */
  public async getSupplierPerformanceReport(organizationId: string): Promise<{
    totalSuppliers: number;
    activeSuppliers: number;
    preferredSuppliers: number;
    averageReliabilityScore: number;
    totalSpent: number;
    topSuppliers: Supplier[];
    lowPerformers: Supplier[];
  }> {
    return this.supplierService.getPerformanceReport(organizationId);
  }

  /**
   * Get recommended supplier for a product
   */
  public async getRecommendedSupplier(
    organizationId: string,
    product: string
  ): Promise<Supplier | null> {
    return this.supplierService.getRecommendedSupplier(organizationId, product);
  }

  // ==================== LOGISTICS ROUTE OPTIMIZATION OPERATIONS ====================

  /**
   * Optimize a logistics route
   */
  public async optimizeLogisticsRoute(
    options: LogisticsRouteOptions
  ): Promise<OptimizedLogisticsRoute> {
    return this.routeOptimizationService.optimizeRoute(options);
  }

  /**
   * Get optimized route by ID
   */
  public async getOptimizedRoute(routeId: string): Promise<OptimizedLogisticsRoute | null> {
    return this.routeOptimizationService.getRoute(routeId);
  }

  /**
   * Get all optimized routes for an organization
   */
  public async getOrganizationOptimizedRoutes(
    organizationId: string
  ): Promise<OptimizedLogisticsRoute[]> {
    return this.routeOptimizationService.getOrganizationRoutes(organizationId);
  }

  /**
   * Delete an optimized route
   */
  public async deleteOptimizedRoute(routeId: string): Promise<boolean> {
    return this.routeOptimizationService.deleteRoute(routeId);
  }

  /**
   * Analyze supply chain for an organization
   */
  public async analyzeSupplyChain(organizationId: string): Promise<SupplyChainAnalysis> {
    return this.routeOptimizationService.analyzeSupplyChain(organizationId);
  }

  // ==================== ENHANCED COMBINED OPERATIONS ====================

  /**
   * Get comprehensive trade, logistics, and supply chain overview
   */
  public async getFullOverview(
    organizationId: string,
    fleetId?: string
  ): Promise<{
    tradingRoutes: TradingRoute[];
    activeAlerts: LogisticsAlert[];
    dashboardMetrics: DashboardMetrics | null;
    restockRecommendations: RestockRecommendation[];
    supplierReport: {
      totalSuppliers: number;
      activeSuppliers: number;
      preferredSuppliers: number;
      averageReliabilityScore: number;
      totalSpent: number;
      topSuppliers: Supplier[];
      lowPerformers: Supplier[];
    };
    supplyChainAnalysis: SupplyChainAnalysis;
  }> {
    const [
      tradingRoutes,
      activeAlerts,
      restockRecommendations,
      supplierReport,
      supplyChainAnalysis,
    ] = await Promise.all([
      this.tradingService.getRoutes({ organizationId }),
      this.alertService.getAlerts({ fleetId, activeOnly: true }),
      this.alertService.getPredictiveRestockRecommendations(organizationId, fleetId),
      this.supplierService.getPerformanceReport(organizationId),
      this.routeOptimizationService.analyzeSupplyChain(organizationId),
    ]);

    let dashboardMetrics: DashboardMetrics | null = null;
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

// Export singleton instance
export const tradeServiceFacade = new TradeServiceFacade();
