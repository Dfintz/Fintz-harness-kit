export interface ErkulComponent {
    slot: string;
    name: string;
    type: string;
    size?: number;
    manufacturer?: string;
    grade?: string;
}
export interface ErkulLoadout {
    shipName: string;
    shipManufacturer?: string;
    gameVersion?: string;
    components: ErkulComponent[];
    statistics?: {
        dps?: number;
        burstDps?: number;
        sustainedDps?: number;
        shieldHp?: number;
        hullHp?: number;
        quantumSpeed?: number;
        quantumRange?: number;
        cargoCapacity?: number;
        hydrogenFuel?: number;
        quantumFuel?: number;
    };
    url: string;
    parsedAt: Date;
}
export interface ErkulImportResult {
    success: boolean;
    loadout?: ErkulLoadout;
    error?: string;
}
export interface ErkulShipData {
    name: string;
    manufacturer: string;
    manufacturerCode?: string;
    size?: string;
    role?: string;
    roles?: string[];
    crew?: number;
    minCrew?: number;
    maxCrew?: number;
    length?: number;
    beam?: number;
    height?: number;
    mass?: number;
    cargo?: number;
    price?: number;
    speed?: number;
    afterburnerSpeed?: number;
    quantumSpeed?: number;
    quantumFuelCapacity?: number;
    hydrogenFuelCapacity?: number;
    shields?: number;
    armor?: number;
    status?: string;
    isVehicle?: boolean;
    [key: string]: unknown;
}
export interface ErkulShipListResult {
    success: boolean;
    ships?: ErkulShipData[];
    error?: string;
    fetchedAt?: Date;
}
export declare class ErkulGamesService {
    private readonly baseUrl;
    private readonly serverBaseUrl;
    private readonly browserUserAgent;
    private static readonly MIN_REQUEST_INTERVAL_MS;
    private static readonly MAX_RETRY_ATTEMPTS;
    private static readonly MAX_BACKOFF_MS;
    private static readonly SESSION_TOKEN_CACHE_KEY;
    private static readonly SESSION_TOKEN_TTL_SECONDS;
    private static readonly shipSchemaGuard;
    private lastRequestAt;
    constructor();
    isValidErkulUrl(url: string): boolean;
    extractShipName(url: string): string | null;
    extractLoadoutId(url: string): string | null;
    parseErkulUrl(url: string): Promise<ErkulImportResult>;
    private fetchSharedLoadout;
    private parseSharedLoadoutResponse;
    generateErkulUrl(shipName: string, components?: ErkulComponent[], localName?: string): string;
    static generateSpviewerUrl(localName: string): string;
    validateAndParse(url: string): Promise<ErkulImportResult>;
    getComponentTypes(): string[];
    private getSessionToken;
    private extractSessionToken;
    private throttle;
    private fetchWithRetry;
    fetchShipList(): Promise<ErkulShipListResult>;
    private parseShipData;
    private validateShipPayloadShape;
    private static readonly MAPPED_SHIP_FIELDS;
    private parseShipEntry;
    private parseErkulServerEntry;
    private parseFlatShipEntry;
}
export declare const erkulGamesService: ErkulGamesService;
//# sourceMappingURL=ErkulGamesService.d.ts.map