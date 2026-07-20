import { AlertFilterOptions, CreateAlertDto, LogisticsAlert, UpdateAlertDto } from '../../models/LogisticsAlert';
import { TradeTransactionStatus } from '../../models/TradeTransaction';
import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { PaginatedResponse } from '../../utils/pagination';
import { LogisticsAlertService, RestockRecommendation } from './logistics/LogisticsAlertService';
import { AlertSummary, CategoryBreakdown, ConsumptionReport, DashboardMetrics, SupplierPerformance as DashboardSupplierPerformance, LogisticsDashboardService, OperationsSummary } from './logistics/LogisticsDashboardService';
import { LogisticsRouteOptimizationService, RouteOptimizationOptions as LogisticsRouteOptions, OptimizedLogisticsRoute, SupplyChainAnalysis } from './logistics/LogisticsRouteOptimizationService';
import { CreateSupplierDto, Supplier, SupplierComparison, SupplierFilterOptions, SupplierManagementService, SupplierOrder, UpdateSupplierDto } from './logistics/SupplierManagementService';
import { CreateTradingRouteDto, RouteOptimizationOptions, TradeOpportunity, TradingService, UpdateTradingRouteDto } from './trading/TradingService';
export declare class TradeServiceFacade {
    private readonly tradingService;
    private readonly alertService;
    private readonly dashboardService;
    private readonly supplierService;
    private readonly routeOptimizationService;
    constructor(tradingService?: TradingService, alertService?: LogisticsAlertService, dashboardService?: LogisticsDashboardService, supplierService?: SupplierManagementService, routeOptimizationService?: LogisticsRouteOptimizationService);
    createTradingRoute(dto: CreateTradingRouteDto): Promise<TradingRoute>;
    getTradingRoutes(filters: {
        creatorId?: string;
        organizationId: string;
        status?: RouteStatus;
        tags?: string[];
        includeShared?: boolean;
    }): Promise<TradingRoute[]>;
    getOrganizationRoutes(organizationId: string, options?: {
        page?: number;
        limit?: number;
        status?: RouteStatus;
        includeShared?: boolean;
    }): Promise<PaginatedResponse<TradingRoute>>;
    getTradingRouteById(id: string, organizationId: string): Promise<TradingRoute | null>;
    updateTradingRoute(id: string, dto: UpdateTradingRouteDto, organizationId: string): Promise<TradingRoute>;
    deleteTradingRoute(id: string, organizationId: string): Promise<void>;
    recordRouteRun(id: string, profit: number, duration: number, organizationId: string, userId?: string, options?: {
        fleetId?: string;
        estimatedProfit?: number;
        successStatus?: TradeTransactionStatus;
    }): Promise<TradingRoute>;
    findTradeOpportunities(startLocation: string, minProfitMargin?: number, limit?: number): Promise<TradeOpportunity[]>;
    optimizeRoute(options: RouteOptimizationOptions): Promise<unknown[]>;
    analyzeRouteProfitability(id: string): Promise<unknown>;
    shareRoute(routeId: string, targetOrganizationId: string, sharedByUserId: string, ownerOrganizationId: string, permissions?: 'view' | 'use' | 'edit'): Promise<unknown>;
    createLogisticsAlert(dto: CreateAlertDto): Promise<LogisticsAlert>;
    getLogisticsAlerts(filters: AlertFilterOptions): Promise<LogisticsAlert[]>;
    getLogisticsAlertById(id: string): Promise<LogisticsAlert | null>;
    updateLogisticsAlert(id: string, dto: UpdateAlertDto): Promise<LogisticsAlert>;
    acknowledgeLogisticsAlert(id: string, userId: string): Promise<LogisticsAlert>;
    resolveLogisticsAlert(id: string, userId: string, notes?: string): Promise<LogisticsAlert>;
    dismissLogisticsAlert(id: string): Promise<LogisticsAlert>;
    deleteLogisticsAlert(id: string): Promise<void>;
    checkInventoryAndGenerateAlerts(fleetId?: string): Promise<LogisticsAlert[]>;
    autoResolveAlerts(): Promise<number>;
    getAlertStatistics(fleetId: string): Promise<unknown>;
    getPredictiveRestockRecommendations(organizationId: string, fleetId?: string): Promise<RestockRecommendation[]>;
    getDashboardMetrics(fleetId: string): Promise<DashboardMetrics>;
    getCategoryBreakdown(fleetId: string): Promise<CategoryBreakdown[]>;
    getAlertSummary(fleetId: string): Promise<AlertSummary[]>;
    getOperationsSummary(fleetId: string): Promise<OperationsSummary[]>;
    getSupplierPerformance(fleetId: string): Promise<DashboardSupplierPerformance[]>;
    getConsumptionReport(fleetId: string, days?: number): Promise<ConsumptionReport[]>;
    getStockValueTrend(fleetId: string, days?: number): Promise<unknown[]>;
    getTradeOverview(organizationId: string, fleetId?: string): Promise<{
        tradingRoutes: TradingRoute[];
        activeAlerts: LogisticsAlert[];
        dashboardMetrics: DashboardMetrics | null;
        restockRecommendations: RestockRecommendation[];
    }>;
    createSupplier(dto: CreateSupplierDto): Promise<Supplier>;
    getSupplier(supplierId: string): Promise<Supplier | null>;
    getSuppliers(organizationId: string, filters?: SupplierFilterOptions): Promise<Supplier[]>;
    updateSupplier(supplierId: string, dto: UpdateSupplierDto): Promise<Supplier | null>;
    deleteSupplier(supplierId: string): Promise<boolean>;
    setPreferredSupplier(supplierId: string, organizationId: string): Promise<Supplier | null>;
    recordSupplierOrder(supplierId: string, organizationId: string, items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
    }>, expectedDeliveryDate: Date, notes?: string): Promise<SupplierOrder>;
    completeSupplierOrder(orderId: string, actualDeliveryDate: Date, qualityRating: number): Promise<SupplierOrder | null>;
    cancelSupplierOrder(orderId: string): Promise<SupplierOrder | null>;
    getSupplierOrders(supplierId: string, status?: SupplierOrder['status']): Promise<SupplierOrder[]>;
    getOrganizationOrders(organizationId: string, status?: SupplierOrder['status']): Promise<SupplierOrder[]>;
    compareSuppliers(organizationId: string, product: string, weights?: {
        reliability?: number;
        quality?: number;
        price?: number;
        deliveryTime?: number;
    }): Promise<SupplierComparison>;
    getSupplierPerformanceReport(organizationId: string): Promise<{
        totalSuppliers: number;
        activeSuppliers: number;
        preferredSuppliers: number;
        averageReliabilityScore: number;
        totalSpent: number;
        topSuppliers: Supplier[];
        lowPerformers: Supplier[];
    }>;
    getRecommendedSupplier(organizationId: string, product: string): Promise<Supplier | null>;
    optimizeLogisticsRoute(options: LogisticsRouteOptions): Promise<OptimizedLogisticsRoute>;
    getOptimizedRoute(routeId: string): Promise<OptimizedLogisticsRoute | null>;
    getOrganizationOptimizedRoutes(organizationId: string): Promise<OptimizedLogisticsRoute[]>;
    deleteOptimizedRoute(routeId: string): Promise<boolean>;
    analyzeSupplyChain(organizationId: string): Promise<SupplyChainAnalysis>;
    getFullOverview(organizationId: string, fleetId?: string): Promise<{
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
    }>;
}
export declare const tradeServiceFacade: TradeServiceFacade;
//# sourceMappingURL=TradeServiceFacade.d.ts.map