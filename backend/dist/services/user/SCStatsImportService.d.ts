import type { SCStatsRawExport } from '@sc-fleet-manager/shared-types';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
export type SCStatsData = SCStatsRawExport;
export declare class SCStatsImportService {
    private preferencesRepo;
    constructor();
    parseJSON(jsonData: string): SCStatsData;
    importData(userId: string, jsonData: string, consentGranted: boolean): Promise<UserGameplayPreferences>;
    getData(userId: string): Promise<{
        hasData: boolean;
        lastImport: Date | null;
        totalImports: number;
        consentGranted: boolean;
        metrics: {
            totalHours: number | null;
            kdRatio: number | null;
            missionsCompleted: number | null;
            favoriteVehicle: string | null;
        } | null;
        isStale: boolean;
    }>;
    deleteData(userId: string): Promise<void>;
    calibrateCombatSkill(kd: number): number;
    calibratePilotingSkill(hours: number): number;
    calibrateMiningSkill(miningMissions: number): number;
}
//# sourceMappingURL=SCStatsImportService.d.ts.map