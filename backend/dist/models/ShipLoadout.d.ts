export declare class ShipLoadout {
    id: string;
    name: string;
    ownerId: string;
    shipId?: string;
    shipName: string;
    components: Array<{
        slot: string;
        componentName: string;
        componentType: string;
        manufacturer?: string;
    }>;
    description?: string;
    erkulGamesUrl?: string;
    spViewerUrl?: string;
    statistics?: {
        dps?: number;
        totalHp?: number;
        cargoCapacity?: number;
        quantumSpeed?: number;
        [key: string]: unknown;
    };
    version: number;
    parentLoadoutId?: string;
    isLatestVersion: boolean;
    sharedWithFleet: boolean;
    sharedWithOrg: boolean;
    sharedWithAlliance: boolean;
    sharedWithOrgs?: string[];
    sharedWithUsers?: string[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ShipLoadout.d.ts.map