export interface FleetViewShip {
    name: string;
    manufacturer?: string;
    kind?: string;
    owned?: number;
    warbond?: boolean;
    lti?: boolean;
    contains?: string[];
    pledge?: string;
    cost?: number;
    notes?: string;
    tags?: string[];
}
export interface FleetViewSchema {
    version?: string;
    updated?: string;
    owner?: {
        name?: string;
        handle?: string;
        orgName?: string;
        orgSid?: string;
    };
    ships: FleetViewShip[];
    statistics?: {
        totalShips?: number;
        totalValue?: number;
        manufacturers?: Record<string, number>;
        roles?: Record<string, number>;
    };
}
export interface FleetViewImportOptions {
    merge?: boolean;
    skipDuplicates?: boolean;
    organizationId: string;
    userId: string;
}
export interface FleetViewExportOptions {
    organizationId?: string;
    userId?: string;
    includeStatistics?: boolean;
    includeInactive?: boolean;
}
export interface FleetViewImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    ships: Array<{
        name: string;
        status: 'imported' | 'skipped' | 'error';
        message?: string;
    }>;
}
//# sourceMappingURL=fleetview.d.ts.map