/**
 * Regolith Data Types
 * 
 * Type definitions for data scraped from regolith.rocks tables
 */

/**
 * Ore survey data from /survey/ores
 */
export interface OreData {
    name: string;
    symbol: string;
    type: 'ore' | 'gem' | 'raw';
    basePrice?: number;
    tradeable: boolean;
}

/**
 * Rock class data from /survey/rock_class
 */
export interface RockClassData {
    name: string;
    oreTypes: string[];
    description?: string;
}

/**
 * Class location mapping from /survey/class_location
 */
export interface ClassLocationData {
    location: string;
    system: string;
    body?: string;
    rockClasses: string[];
    orePercentages: Record<string, number>;
}

/**
 * Gem data from /survey/gems
 */
export interface GemData {
    name: string;
    symbol: string;
    basePrice: number;
    locations: string[];
}

/**
 * Refinery data from /tables/refinery
 */
export interface RefineryData {
    name: string;
    location: string;
    system: string;
    methods: RefineryMethod[];
    ores: string[];
}

export interface RefineryMethod {
    name: string;
    duration: number; // in seconds
    efficiency: number; // percentage
    cost: number; // aUEC per unit
}

/**
 * Market data from /tables/market
 */
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

/**
 * Combined Regolith data cache
 */
export interface RegolithCachedData {
    lastUpdated: Date;
    ores: OreData[];
    rockClasses: RockClassData[];
    classLocations: ClassLocationData[];
    gems: GemData[];
    refineries: RefineryData[];
    markets: MarketData[];
}

/**
 * Fetch status for each data source
 */
export interface RegolithFetchStatus {
    source: string;
    url: string;
    success: boolean;
    lastFetch: Date;
    recordCount: number;
    error?: string;
}

