import { RouteStatus } from '../../models/TradingRoute';
export interface TradingRouteStats {
    activeRoutes: number;
    totalRoutes: number;
    totalProfit: number;
    avgProfitPerRoute: number;
    topRoutes: Array<{
        id: string;
        name: string;
        estimatedProfit: number;
        status: RouteStatus;
        runCount: number;
        avgProfit: number;
    }>;
}
export interface RouteRecommendation {
    routeId: string;
    routeName: string;
    estimatedProfit: number;
    estimatedDuration: number;
    minCargoCapacity: number;
    suitableShips: number;
    profitPerMinute: number;
    difficulty: string;
}
export declare class OrganizationTradingService {
    private routeRepository;
    private fleetRepository;
    private static readonly DEFAULT_CARGO_CAPACITY;
    private static readonly MAX_PROFIT_BY_ROUTE_RESULTS;
    constructor();
    getActiveRouteCount(organizationId: string): Promise<number>;
    getRouteStats(organizationId: string): Promise<TradingRouteStats>;
    getRouteRecommendations(organizationId: string, limit?: number): Promise<RouteRecommendation[]>;
    getProfitSummary(organizationId: string): Promise<{
        totalEstimatedProfit: number;
        totalActualProfit: number;
        totalRuns: number;
        avgProfitPerRun: number;
        profitByRoute: Array<{
            routeId: string;
            routeName: string;
            estimatedProfit: number;
            actualProfit: number;
            runs: number;
            efficiency: number;
        }>;
    }>;
}
//# sourceMappingURL=OrganizationTradingService.d.ts.map