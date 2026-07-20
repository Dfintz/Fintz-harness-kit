import type { UIFItem, UIFItemLocation, UIFPriceComparison } from './UIFService';
export type { UIFItem, UIFItemLocation, UIFPriceComparison };
export interface PriceFeedSearchOptions {
    query: string;
    category?: string;
    location?: string;
    maxResults?: number;
}
export interface IPriceFeedProvider {
    readonly name: string;
    searchItems(options: PriceFeedSearchOptions): Promise<UIFItem[]>;
    getItemDetails(itemName: string): Promise<UIFItem | null>;
    getItemPrices(itemName: string): Promise<UIFItemLocation[]>;
    findBestBuyLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;
    findBestSellLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;
    comparePrices(itemName: string): Promise<UIFPriceComparison | null>;
    getItemsAtLocation(location: string): Promise<UIFItem[]>;
    getTradingOpportunities(from: string, to: string, minMargin?: number): Promise<UIFPriceComparison[]>;
    clearCache(): void;
    clearItemCache(itemName: string): void;
    getStatus(): {
        name: string;
        healthy: boolean;
        details?: Record<string, unknown>;
    };
}
//# sourceMappingURL=IPriceFeedProvider.d.ts.map