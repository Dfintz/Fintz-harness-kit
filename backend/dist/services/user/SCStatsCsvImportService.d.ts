import type { SCStatsCsvCategoryStatus, SCStatsCsvData, SCStatsCsvSummary, SCStatsLoadoutRow, SCStatsPlaytimeRow, SCStatsPurchaseRow, SCStatsShipRow } from '@sc-fleet-manager/shared-types';
import { SCStatsCsvImport } from '../../models/SCStatsCsvImport';
export declare class SCStatsCsvImportService {
    private readonly repo;
    private readonly preferencesRepo;
    private readonly shipService;
    constructor();
    parsePlaytimeCsv(content: string): SCStatsPlaytimeRow[];
    parseLoadoutCsv(content: string, isTopItems: boolean): SCStatsLoadoutRow[];
    parsePurchasesCsv(content: string): SCStatsPurchaseRow[];
    parseShipsCsv(content: string): SCStatsShipRow[];
    importCsvData(userId: string, files: {
        playtime?: string;
        loadoutTop?: string;
        loadoutDetail?: string;
        purchases?: string;
        ships?: string;
    }, consentGranted: boolean): Promise<{
        record: SCStatsCsvImport;
        summary: SCStatsCsvSummary;
        counts: Partial<SCStatsCsvData>;
    }>;
    private parseProvidedFiles;
    private applyParsedDataToRecord;
    private buildEffectiveData;
    private fetchCareerMap;
    private buildImportedCounts;
    getData(userId: string): Promise<{
        hasData: boolean;
        lastImport: Date | null;
        consentGranted: boolean;
        summary: SCStatsCsvSummary | null;
        data: SCStatsCsvData | null;
        categoryStatus: SCStatsCsvCategoryStatus | null;
    }>;
    private syncToGameplayPreferences;
    deleteData(userId: string): Promise<void>;
    computeSummary(data: SCStatsCsvData, careerMap?: Map<string, string>): SCStatsCsvSummary;
    private aggregateHoursByCareer;
    private parseCsvContent;
    parseTimeToHours(timeStr: string): number;
    private static readonly SCSTATS_ALIASES;
    static normalizeSCStatsShipName(rawName: string): string;
    private parseAuec;
}
//# sourceMappingURL=SCStatsCsvImportService.d.ts.map