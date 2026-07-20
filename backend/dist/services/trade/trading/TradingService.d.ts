import { TradeTransactionStatus } from '../../../models/TradeTransaction';
import { RouteStatus, RouteVisibility, TradeStop, TradingRoute } from '../../../models/TradingRoute';
import { PaginatedResponse } from '../../../utils/pagination';
export interface CreateTradingRouteDto {
    name: string;
    description: string;
    creatorId: string;
    organizationId: string;
    visibility?: RouteVisibility;
    stops: TradeStop[];
    estimatedProfit?: number;
    estimatedDuration?: number;
    minCargoCapacity?: number;
    tags?: string[];
    notes?: string;
}
export interface RouteShare {
    routeId: string;
    sharedWithOrganizationId: string;
    sharedByUserId: string;
    sharedAt: Date;
    permissions: 'view' | 'use' | 'edit';
}
export interface PriceHistoryPoint {
    timestamp: Date;
    commodity: string;
    location: string;
    buyPrice: number;
    sellPrice: number;
}
export type TradeTrend = 'up' | 'down' | 'stable';
export interface PriceChartData {
    commodity: string;
    history: Array<{
        date: string;
        buyPrice: number;
        sellPrice: number;
        profitMargin: number;
    }>;
    trend: TradeTrend;
    volatility: number;
}
export interface UpdateTradingRouteDto {
    name?: string;
    description?: string;
    stops?: TradeStop[];
    estimatedProfit?: number;
    estimatedDuration?: number;
    minCargoCapacity?: number;
    status?: RouteStatus;
    tags?: string[];
    notes?: string;
}
export interface TradeOpportunity {
    commodity: string;
    buyLocation: string;
    sellLocation: string;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    profitMargin: number;
    distance?: number;
    estimatedTime?: number;
}
export interface RouteOptimizationOptions {
    startLocation: string;
    cargoCapacity: number;
    maxStops?: number;
    minProfitMargin?: number;
    avoidLocations?: string[];
    preferredCommodities?: string[];
}
export declare class TradingService {
    private readonly routeRepository;
    private readonly routeShares;
    private readonly sharedRoutesByOrg;
    private readonly priceHistory;
    private readonly notificationService;
    private findRouteById;
    createRoute(dto: CreateTradingRouteDto): Promise<TradingRoute>;
    getRoutes(filters: {
        creatorId?: string;
        organizationId: string;
        status?: RouteStatus;
        visibility?: RouteVisibility;
        tags?: string[];
        includeShared?: boolean;
    }): Promise<TradingRoute[]>;
    getOrganizationRoutes(organizationId: string, options?: {
        page?: number;
        limit?: number;
        status?: RouteStatus;
        includeShared?: boolean;
    }): Promise<PaginatedResponse<TradingRoute>>;
    shareRoute(routeId: string, targetOrganizationId: string, sharedByUserId: string, ownerOrganizationId: string, permissions?: 'view' | 'use' | 'edit'): Promise<RouteShare>;
    revokeRouteShare(routeId: string, targetOrganizationId: string): Promise<boolean>;
    getRouteShares(routeId: string): Promise<RouteShare[]>;
    private getSharedRouteIds;
    recordPriceData(commodity: string, location: string, buyPrice: number, sellPrice: number): Promise<void>;
    getPriceChartData(commodity: string, location?: string, days?: number): Promise<PriceChartData>;
    getMarketTrends(commodities: string[], days?: number): Promise<Array<{
        commodity: string;
        currentPrice: number;
        priceChange: number;
        trend: TradeTrend;
    }>>;
    getRouteById(id: string, organizationId: string): Promise<TradingRoute | null>;
    updateRoute(id: string, dto: UpdateTradingRouteDto, organizationId: string): Promise<TradingRoute>;
    deleteRoute(id: string, organizationId: string): Promise<void>;
    recordRouteRun(id: string, profit: number, duration: number, organizationId: string, userId?: string, options?: {
        fleetId?: string;
        estimatedProfit?: number;
        successStatus?: TradeTransactionStatus;
    }): Promise<TradingRoute>;
    findTradeOpportunities(startLocation: string, minProfitMargin?: number, limit?: number): Promise<TradeOpportunity[]>;
    private shouldSkipOpportunity;
    private addCommodityToStop;
    optimizeRoute(options: RouteOptimizationOptions): Promise<TradeStop[]>;
    private processStopGoods;
    private calculateRouteProfit;
    analyzeRouteProfitability(id: string, organizationId?: string): Promise<Record<string, unknown>>;
    refreshAllRouteProfits(): Promise<{
        updated: number;
        failed: number;
    }>;
}
export declare const tradingService: TradingService;
//# sourceMappingURL=TradingService.d.ts.map