import type { RegolithCachedData, RegolithFetchStatus } from '../services/content/RegolithDataTypes';
export declare class RegolithDataFetcher {
    private static readonly BASE_URL;
    private static readonly FETCH_TIMEOUT;
    private static readonly USER_AGENT;
    private static readonly MIN_RESPONSE_LENGTH;
    private static readonly DEFAULT_REFINERY_DURATION;
    private static readonly DEFAULT_REFINERY_EFFICIENCY;
    private static readonly DEFAULT_REFINERY_COST;
    private static cachedData;
    private static fetchStatuses;
    private static isFetching;
    private static scheduledTask;
    private static initialFetchTimeout;
    private static isExternalFetchesDisabled;
    private static isTestRuntime;
    private static readonly DATA_SOURCES;
    static getCachedData(): RegolithCachedData | null;
    static getFetchStatuses(): RegolithFetchStatus[];
    static isCurrentlyFetching(): boolean;
    static isDataStale(): boolean;
    static execute(): Promise<void>;
    private static fetchOres;
    private static fetchRockClasses;
    private static fetchClassLocations;
    private static fetchGems;
    private static fetchRefineries;
    private static fetchMarkets;
    private static updateFetchStatus;
    private static validateResponse;
    static forceRefresh(): Promise<void>;
    static clearCache(): void;
    static schedule(): void;
    static stop(): void;
}
//# sourceMappingURL=regolithDataFetcher.d.ts.map