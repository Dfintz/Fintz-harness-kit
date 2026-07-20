interface UploadedLogFile {
    name: string;
    content: string;
}
interface FileParseQuality {
    fileName: string;
    sessionDetected: boolean;
    shipEvents: number;
    loadoutEvents: number;
    purchaseEvents: number;
    extractedCategories: string[];
    warnings: string[];
}
interface LogCsvBuildResult {
    csvFiles: {
        playtime?: string;
        loadoutTop?: string;
        loadoutDetail?: string;
        purchases?: string;
        ships?: string;
    };
    meta: {
        filesProcessed: number;
        sessionsParsed: number;
        shipSessionsParsed: number;
        loadoutEventsParsed: number;
        purchaseEventsParsed: number;
        shipsAggregated: number;
        loadoutsAggregated: number;
        purchasesAggregated: number;
        categoriesExtracted: Array<'playtime' | 'loadoutTop' | 'loadoutDetail' | 'purchases' | 'ships'>;
        parseQuality: FileParseQuality[];
    };
}
export declare class SCStatsLogImportService {
    buildCsvImports(logFiles: UploadedLogFile[]): LogCsvBuildResult;
    private parseLogFile;
    private buildParseQuality;
    private consumeLogLine;
    private updateSessionBounds;
    private captureEnvSession;
    private captureShipGrant;
    private captureShipRelease;
    private captureLoadoutEvent;
    private capturePurchaseEvent;
    private accumulateShip;
    private mergeShipAggregates;
    private mergeLoadoutAggregates;
    private mergePurchaseAggregates;
    private buildPlaytimeCsv;
    private buildShipsCsv;
    private buildLoadoutCsv;
    private buildPurchasesCsv;
    private parseVersionParts;
    private formatVersionDigits;
    private extractTimestamp;
    private normalizeShipName;
    private parseNumeric;
    private formatHours;
    private capitalize;
    private escapeCsv;
}
export declare const scstatsLogImportService: SCStatsLogImportService;
export {};
//# sourceMappingURL=SCStatsLogImportService.d.ts.map