export declare class ShipDataFetcher {
    private static readonly FETCH_TIMEOUT;
    private static readonly USER_AGENT;
    private static readonly MIN_CSV_RESPONSE_LENGTH;
    private static isFetching;
    private static scheduledTask;
    private static lastFetchStatus;
    static getLastFetchStatus(): typeof ShipDataFetcher.lastFetchStatus;
    static isCurrentlyFetching(): boolean;
    private static readonly FALLBACK_SHIP_URL;
    private static readonly FALLBACK_VEHICLE_URL;
    private static readonly BUNDLED_SHIP_CSV;
    private static readonly BUNDLED_VEHICLE_CSV;
    private static readonly erkulService;
    static loadFromLocalCsv(csvPath: string, isVehicle: boolean): Promise<number>;
    static importFromCsvContent(csvContent: string, isVehicle?: boolean): Promise<{
        processed: number;
        total: number;
        errors: string[];
    }>;
    static execute(): Promise<void>;
    private static fetchFromAllSources;
    private static tryFetchErkul;
    private static tryFetchSheet;
    private static tryFetchBundledCsvs;
    private static processErkulShips;
    private static mapErkulShipToModel;
    private static extractErkulMetadata;
    private static fetchAndUpdateShips;
    private static mapRecordToShip;
    private static generateShipId;
    private static parseString;
    private static parseNumber;
    private static parseDecimal;
    private static parseArray;
    private static parseSize;
    private static parseStatus;
    private static extractMetadata;
    static forceRefresh(): Promise<void>;
    static schedule(): void;
    static stop(): void;
}
//# sourceMappingURL=shipDataFetcher.d.ts.map