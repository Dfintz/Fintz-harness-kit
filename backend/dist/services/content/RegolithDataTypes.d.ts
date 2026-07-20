export interface OreData {
    name: string;
    symbol: string;
    type: 'ore' | 'gem' | 'raw';
    basePrice?: number;
    tradeable: boolean;
}
export interface RockClassData {
    name: string;
    oreTypes: string[];
    description?: string;
}
export interface ClassLocationData {
    location: string;
    system: string;
    body?: string;
    rockClasses: string[];
    orePercentages: Record<string, number>;
}
export interface GemData {
    name: string;
    symbol: string;
    basePrice: number;
    locations: string[];
}
export interface RefineryData {
    name: string;
    location: string;
    system: string;
    methods: RefineryMethod[];
    ores: string[];
}
export interface RefineryMethod {
    name: string;
    duration: number;
    efficiency: number;
    cost: number;
}
export interface MarketData {
    location: string;
    system: string;
    type: 'buy' | 'sell' | 'both';
    commodities: CommodityPrice[];
}
export interface CommodityPrice {
    name: string;
    symbol: string;
    buyPrice?: number;
    sellPrice?: number;
    inventory?: number;
    demand?: number;
}
export interface RegolithCachedData {
    lastUpdated: Date;
    ores: OreData[];
    rockClasses: RockClassData[];
    classLocations: ClassLocationData[];
    gems: GemData[];
    refineries: RefineryData[];
    markets: MarketData[];
}
export interface RegolithFetchStatus {
    source: string;
    url: string;
    success: boolean;
    lastFetch: Date;
    recordCount: number;
    error?: string;
}
//# sourceMappingURL=RegolithDataTypes.d.ts.map