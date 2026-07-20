import { RouteStatus, TradeStop, TradingRoute } from '../../models/TradingRoute';
import { SagaResult } from './SagaOrchestrator';
export interface CreateTradeOperationParams {
    organizationId: string;
    operationData: {
        name: string;
        description?: string;
        coordinatorId: string;
        stops: TradeStop[];
        commodities?: Array<{
            name: string;
            quantity: number;
            buyPrice?: number;
            sellPrice?: number;
        }>;
        estimatedProfit?: number;
    };
    routeOptions?: {
        optimizeForFuel?: boolean;
        maxStops?: number;
        preferredRefuelStops?: string[];
    };
    alertsConfig?: {
        priceThresholds?: Array<{
            commodityName: string;
            minPrice?: number;
            maxPrice?: number;
        }>;
        inventoryAlerts?: boolean;
    };
    supplierIds?: string[];
    notifyParticipants?: boolean;
    postToDiscord?: boolean;
    discordChannelId?: string;
}
export interface ExecuteTradeRunParams {
    organizationId: string;
    routeId: string;
    executedById: string;
    shipId?: string;
    actualBuyPrice?: number;
    actualSellPrice?: number;
    quantityTraded?: number;
    notes?: string;
}
export interface SupplyChainAnalysisParams {
    organizationId: string;
    commodities: string[];
    startLocation: string;
    endLocation?: string;
    budget?: number;
    includeSuppliers?: boolean;
}
export interface TradeOperationResult {
    route: TradingRoute;
    optimizedWaypoints?: unknown[];
    alerts?: unknown[];
    suppliers?: unknown[];
    notifications?: unknown[];
}
export interface SupplyChainAnalysisResult {
    commodities: Array<{
        name: string;
        bestBuyLocation: string;
        bestBuyPrice: number;
        bestSellLocation: string;
        bestSellPrice: number;
        potentialProfit: number;
    }>;
    optimizedRoute?: unknown;
    totalEstimatedProfit: number;
    riskFactors: string[];
    recommendations: string[];
}
export declare class TradeAggregatorService {
    private readonly tradeFacade;
    private readonly tradingService;
    private readonly alertService;
    private readonly supplierService;
    private readonly routeOptimizer;
    private readonly notificationService;
    private readonly discordService;
    constructor();
    createTradeOperation(params: CreateTradeOperationParams): Promise<SagaResult<Record<string, unknown>>>;
    executeTradeRun(params: ExecuteTradeRunParams): Promise<{
        route: TradingRoute | null;
        execution: {
            executedAt: Date;
            actualProfit?: number;
            performanceRating?: string;
        };
        recommendations: string[];
    }>;
    analyzeSupplyChain(params: SupplyChainAnalysisParams): Promise<SupplyChainAnalysisResult>;
    bulkUpdateRouteStatus(organizationId: string, routeIds: string[], newStatus: RouteStatus, updatedById: string, reason?: string): Promise<{
        successful: string[];
        failed: Array<{
            id: string;
            error: string;
        }>;
        notifications: number;
    }>;
    getTradeOperationOverview(organizationId: string): Promise<{
        activeRoutes: number;
        totalRoutes: number;
        activeAlerts: number;
        supplierCount: number;
        recentActivity: unknown[];
        topPerformingRoutes: unknown[];
    }>;
}
//# sourceMappingURL=TradeAggregatorService.d.ts.map