import type { RegolithCachedData, RegolithFetchStatus } from './RegolithDataTypes';
export interface MiningLocation {
    name: string;
    system: string;
    body?: string;
    coordinates?: string;
    resources: MineralResource[];
    accessibility: 'Easy' | 'Moderate' | 'Difficult' | 'Extreme';
    environment?: string;
    notes?: string;
}
export interface MineralResource {
    name: string;
    symbol: string;
    percentage: number;
    quality?: string;
    price?: number;
    sellLocations?: string[];
}
export interface MiningDataSummary {
    location: string;
    system: string;
    totalResources: number;
    topResources: Array<{
        name: string;
        symbol: string;
        percentage: number;
        estimatedValue?: number;
        price?: number;
        sellLocations?: string[];
    }>;
    accessibility: string;
    recommendedShips: string[];
    estimatedProfitPerHour?: number;
    notes: string;
}
export declare class RegolithService {
    private static readonly REGOLITH_BASE_URL;
    private static readonly CACHE_DURATION;
    private static cache;
    private static toPercentage;
    static getMiningData(locationName: string): Promise<MiningLocation | null>;
    private static getLiveMiningData;
    private static determineAccessibility;
    static getDataFetchStatus(): {
        hasLiveData: boolean;
        lastUpdated: Date | null;
        sources: RegolithFetchStatus[];
        isStale: boolean;
    };
    static forceDataRefresh(): Promise<void>;
    static getAllLiveLocations(): Promise<string[]>;
    static getRefineriesData(): RegolithCachedData['refineries'];
    static getMarketsData(): RegolithCachedData['markets'];
    static getGemsData(): RegolithCachedData['gems'];
    static startScheduledFetch(): void;
    static stopScheduledFetch(): void;
    static generateMiningDescription(location: string, systemLocation?: string): Promise<string>;
    static getMiningDataSummary(location: string): Promise<MiningDataSummary | null>;
    private static getRecommendedMiningShips;
    private static estimateProfitPerHour;
    private static getFallbackMiningData;
    private static readonly ALL_LOCATIONS;
    static searchByResource(resourceName: string): Promise<MiningLocation[]>;
    static getAllLocations(): Promise<MiningLocation[]>;
    static clearCache(): void;
}
//# sourceMappingURL=RegolithService.d.ts.map