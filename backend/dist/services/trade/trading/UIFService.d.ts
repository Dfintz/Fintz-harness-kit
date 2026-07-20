export interface UIFItemLocation {
    location: string;
    system?: string;
    planet?: string;
    station?: string;
    shop?: string;
    price?: number;
    type: 'buy' | 'sell';
    inStock?: boolean;
    lastUpdated?: string;
}
export interface UIFItem {
    name: string;
    category: string;
    subCategory?: string;
    description?: string;
    manufacturer?: string;
    size?: string;
    grade?: string;
    locations: UIFItemLocation[];
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    lastUpdated?: Date;
}
export interface UIFSearchOptions {
    query: string;
    category?: string;
    location?: string;
    maxResults?: number;
}
export interface UIFPriceComparison {
    item: string;
    bestBuyLocation?: UIFItemLocation;
    bestSellLocation?: UIFItemLocation;
    potentialProfit?: number;
    profitMargin?: number;
}
export declare class UIFService {
    private baseURL;
    private client;
    private cache;
    private cacheDuration;
    private useMockData;
    private apiAvailable;
    private lastApiCheck;
    private apiCheckInterval;
    private readonly circuitBreakerName;
    constructor();
    getCircuitStatus(): {
        name: string;
        state: string | null;
        healthy: boolean;
    };
    private checkApiAvailability;
    private executeWithCircuitBreaker;
    searchItems(options: UIFSearchOptions): Promise<UIFItem[]>;
    private searchMockItems;
    getItemDetails(itemName: string): Promise<UIFItem | null>;
    private getMockItemDetails;
    getItemPrices(itemName: string): Promise<UIFItemLocation[]>;
    findBestBuyLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;
    findBestSellLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;
    comparePrices(itemName: string): Promise<UIFPriceComparison | null>;
    getItemsByCategory(category: string): Promise<UIFItem[]>;
    getItemsAtLocation(location: string): Promise<UIFItem[]>;
    getTradingOpportunities(fromLocation: string, toLocation: string, minProfitMargin?: number): Promise<UIFPriceComparison[]>;
    updateItemPrice(itemName: string, location: string, price: number, type: 'buy' | 'sell'): void;
    private parseItem;
    private parseItems;
    private getCached;
    private setCache;
    clearCache(): void;
    clearItemCache(itemName: string): void;
}
export declare const uifService: UIFService;
//# sourceMappingURL=UIFService.d.ts.map