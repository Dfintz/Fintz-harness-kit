export interface TradingRoute {
    id: string;
    name?: string;
    origin?: string;
    destination?: string;
    commodity?: string;
    profitPerUnit?: number;
    status?: string;
    [key: string]: unknown;
}
export interface TradingOpportunity {
    id: string;
    commodity: string;
    buyLocation: string;
    sellLocation: string;
    profitMargin: number;
    [key: string]: unknown;
}
export interface MarketData {
    location?: string;
    commodity?: string;
    prices?: Record<string, number>;
    [key: string]: unknown;
}
export interface TradingEvent {
    type: 'trading:route_created' | 'trading:route_updated' | 'trading:route_deleted' | 'trading:route_status_changed' | 'trading:opportunity_discovered' | 'trading:market_updated' | 'trading:price_changed';
    organizationId?: string;
    routeId?: string;
    data: TradingRoute | TradingOpportunity | MarketData | Record<string, unknown>;
    timestamp: number;
    userId?: string;
}
export declare const emitRouteCreated: (organizationId: string, route: TradingRoute, userId?: string) => void;
export declare const emitRouteUpdated: (organizationId: string, route: TradingRoute, userId?: string) => void;
export declare const emitRouteDeleted: (organizationId: string, routeId: string, userId?: string) => void;
export declare const emitRouteStatusChanged: (organizationId: string, routeId: string, oldStatus: string, newStatus: string, userId?: string) => void;
export declare const emitOpportunityDiscovered: (opportunity: TradingOpportunity) => void;
export declare const emitMarketUpdated: (marketData: MarketData) => void;
export declare const emitPriceChanged: (commodity: string, location: string, oldPrice: number, newPrice: number) => void;
//# sourceMappingURL=tradingWebSocketController.d.ts.map