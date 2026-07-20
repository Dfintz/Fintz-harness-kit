import { ShipLoadout } from '../../models/ShipLoadout';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export declare class ShipLoadoutService {
    private loadoutRepository;
    constructor();
    createLoadout(loadoutData: Partial<ShipLoadout>): Promise<ShipLoadout>;
    getLoadoutById(id: string): Promise<ShipLoadout | null>;
    getLoadoutsByOwner(ownerId: string, paginationOptions: PaginationOptions, filters?: {
        shipName?: string;
        latestOnly?: boolean;
    }): Promise<PaginatedResponse<ShipLoadout>>;
    getSharedLoadouts(userId: string, paginationOptions: PaginationOptions): Promise<PaginatedResponse<ShipLoadout>>;
    updateLoadout(id: string, updates: Partial<ShipLoadout>): Promise<ShipLoadout | null>;
    deleteLoadout(id: string): Promise<boolean>;
    createVersion(parentLoadoutId: string, updates: Partial<ShipLoadout>): Promise<ShipLoadout | null>;
    getVersionHistory(loadoutId: string): Promise<ShipLoadout[]>;
    compareLoadouts(loadout1: ShipLoadout, loadout2: ShipLoadout): {
        componentDifferences: Array<{
            slot: string;
            loadout1Component: string | null;
            loadout2Component: string | null;
        }>;
        statisticsDifferences: {
            [key: string]: {
                loadout1: unknown;
                loadout2: unknown;
            };
        };
    };
    shareWithUsers(loadoutId: string, userIds: string[]): Promise<ShipLoadout | null>;
    updateSharingSettings(loadoutId: string, settings: {
        sharedWithFleet?: boolean;
        sharedWithOrg?: boolean;
        sharedWithAlliance?: boolean;
    }): Promise<ShipLoadout | null>;
    generateErkulGamesUrl(loadout: ShipLoadout): string;
    updateErkulGamesUrl(loadoutId: string, url: string): Promise<ShipLoadout | null>;
    getLoadoutsByShip(shipName: string, paginationOptions: PaginationOptions): Promise<PaginatedResponse<ShipLoadout>>;
    getPopularLoadouts(paginationOptions: PaginationOptions): Promise<PaginatedResponse<ShipLoadout>>;
    shareWithOrganizations(loadoutId: string, organizationIds: string[]): Promise<ShipLoadout | null>;
    unshareFromOrganizations(loadoutId: string, organizationIds: string[]): Promise<ShipLoadout | null>;
    getLoadoutsForUser(userId: string, userOrgIds: string[], paginationOptions: PaginationOptions): Promise<PaginatedResponse<ShipLoadout>>;
}
//# sourceMappingURL=ShipLoadoutService.d.ts.map