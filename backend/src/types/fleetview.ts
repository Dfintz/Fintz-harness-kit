/**
 * FleetView Schema Types
 * Compatible with hangar.link/fleet/canvas
 * 
 * This schema is used to import/export fleet data to external tools
 */

/**
 * FleetView ship entry
 */
export interface FleetViewShip {
    name: string;
    manufacturer?: string;
    kind?: string; // ship classification/role
    owned?: number; // quantity owned
    warbond?: boolean;
    lti?: boolean;
    contains?: string[]; // ships contained (e.g., Pisces in Carrack)
    pledge?: string; // pledge name if applicable
    cost?: number; // USD cost
    notes?: string;
    tags?: string[];
}

/**
 * Complete FleetView schema
 */
export interface FleetViewSchema {
    version?: string;
    updated?: string; // ISO date string
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

/**
 * Import options for FleetView data
 */
export interface FleetViewImportOptions {
    merge?: boolean; // If true, merge with existing ships; if false, replace all
    skipDuplicates?: boolean; // If true, skip ships that already exist
    organizationId: string; // Target organization for multi-tenancy
    userId: string; // User performing the import
}

/**
 * Export options for FleetView data
 */
export interface FleetViewExportOptions {
    organizationId?: string; // If specified, export org ships; otherwise export user ships
    userId?: string; // User performing the export
    includeStatistics?: boolean; // If true, include statistics in export
    includeInactive?: boolean; // If true, include inactive ships
}

/**
 * Import result
 */
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
