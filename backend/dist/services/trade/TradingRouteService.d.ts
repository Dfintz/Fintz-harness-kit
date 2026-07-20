import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { UEXPriceFeed } from './trading/UEXPriceFeed';
export interface ListOrgRoutesParams {
    limit: number;
    offset: number;
    sort: {
        field: string;
        order: 'ASC' | 'DESC';
    } | null;
    filters: Record<string, string>;
    search: string | null;
    fields: string[] | null;
}
export interface CreateRouteInput {
    name: string;
    description?: string;
    stops?: unknown[];
    estimatedProfit?: number;
    estimatedDuration?: number;
    minCargoCapacity?: number;
    tags?: unknown[];
    notes?: string;
}
export interface ListOrgRoutesResult {
    routes: TradingRoute[];
    total: number;
}
export interface UpdateRouteResult {
    route: TradingRoute;
    statusChanged: boolean;
    oldStatus: RouteStatus;
}
export declare class TradingRouteService {
    private readonly uexPriceFeed;
    constructor(uexPriceFeed: UEXPriceFeed);
    findById(routeId: string, organizationId?: string): Promise<TradingRoute | null>;
    listOrgRoutes(orgId: string, params: ListOrgRoutesParams): Promise<ListOrgRoutesResult>;
    createRoute(orgId: string, userId: string, data: CreateRouteInput): Promise<TradingRoute>;
    updateRoute(routeId: string, orgId: string, updates: Partial<TradingRoute>): Promise<UpdateRouteResult>;
    deleteRoute(routeId: string, orgId: string): Promise<void>;
    calculateRouteRating(route: TradingRoute): number;
    private applyRouteUpdates;
}
export declare const tradingRouteService: TradingRouteService;
//# sourceMappingURL=TradingRouteService.d.ts.map