export interface UEXTradeRoute {
    commodity: string;
    commodityCode: string;
    buyTerminal: string;
    buyLocation: string;
    buyPrice: number;
    buySystem: string;
    sellTerminal: string;
    sellLocation: string;
    sellPrice: number;
    sellSystem: string;
    profitPerScu: number;
    profitMargin: number;
    scuAvailable: number;
    maxProfit: number;
    lastUpdated: string;
}
export interface UEXRouteSearchParams {
    limit?: number;
    minMargin?: number;
    commodity?: string;
    starSystemStart?: string;
    starSystemEnd?: string;
    terminalStart?: string;
    terminalEnd?: string;
    investment?: number;
    scu?: number;
}
export interface UEXTerminalInfo {
    id: number;
    name: string;
    code: string;
    type?: string;
    starSystem: string;
    planet: string;
    orbit: string;
}
export interface UEXCommodityInfo {
    id: number;
    name: string;
    code: string;
    kind: string;
    avgBuyPrice: number;
    avgSellPrice: number;
    isBuyable: boolean;
    isSellable: boolean;
}
//# sourceMappingURL=UEXPriceFeed.types.d.ts.map