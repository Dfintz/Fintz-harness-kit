import { FindManyOptions } from 'typeorm';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface BulkOperationResult<T> {
    successful: T[];
    failed: Array<{
        id?: string;
        error: string;
    }>;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
}
export interface SharedFleetsPage {
    data: Fleet[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}
export interface FleetSnapshot {
    fleets: Fleet[];
    shipCounts: Map<string, number>;
}
type FleetTreeNode = Fleet & {
    children: FleetTreeNode[];
};
export declare class FleetService extends TenantService<Fleet> {
    constructor();
    private static readonly VALID_FLEET_TYPES;
    createFleet(organizationId: string, fleetData: {
        name: string;
        description?: string;
        type?: string;
        members?: string[];
    } & Partial<Omit<Fleet, 'name' | 'description' | 'type' | 'members' | 'organizationId'>>): Promise<Fleet>;
    postCreateFleet(organizationId: string, fleet: Fleet): Promise<Fleet>;
    getFleetById(organizationId: string, fleetId: string, options?: FindManyOptions<Fleet>): Promise<Fleet | null>;
    getFleets(organizationId: string, options?: PaginationOptions): Promise<PaginatedResponse<Fleet>>;
    getAllFleets(organizationId: string, options?: FindManyOptions<Fleet>): Promise<Fleet[]>;
    getFleetSnapshot(organizationId: string): Promise<FleetSnapshot>;
    updateFleet(organizationId: string, fleetId: string, updates: Partial<Fleet>): Promise<Fleet | null>;
    deleteFleet(organizationId: string, fleetId: string): Promise<void>;
    addShipToFleet(organizationId: string, fleetId: string, shipId: string, options?: {
        performedById?: string;
        role?: string;
        notes?: string;
    }): Promise<{
        fleet: Fleet;
        fleetShip: FleetShip;
        ship: Ship;
    }>;
    removeShipFromFleet(organizationId: string, fleetId: string, shipId: string, options?: {
        performedById?: string;
    }): Promise<{
        fleet: Fleet;
    }>;
    addShipIdsToFleet(organizationId: string, fleetId: string, shipIdsToAdd: string[]): Promise<Fleet>;
    removeShipIdsFromFleet(organizationId: string, fleetId: string, shipIdsToRemove: string[]): Promise<Fleet>;
    searchFleetsByName(organizationId: string, searchTerm: string): Promise<Fleet[]>;
    getFleetCount(organizationId: string): Promise<number>;
    getSharedFleets(organizationId: string): Promise<Fleet[]>;
    getSharedFleetsPaginated(organizationId: string, options: {
        limit: number;
        offset: number;
    }): Promise<SharedFleetsPage>;
    shareFleetWith(organizationId: string, fleetId: string, targetOrganizationId: string): Promise<Fleet | null>;
    shareFleetWithMany(organizationId: string, fleetId: string, targetOrganizationIds: readonly string[]): Promise<Fleet | null>;
    unshareFleetWith(organizationId: string, fleetId: string, targetOrganizationId: string): Promise<Fleet | null>;
    unshareFleetWithMany(organizationId: string, fleetId: string, targetOrganizationIds: readonly string[]): Promise<Fleet | null>;
    private normalizeTargetOrganizationIds;
    isFleetOwnedBy(organizationId: string, fleetId: string): Promise<boolean>;
    getFleetStatistics(organizationId: string): Promise<{
        totalFleets: number;
        sharedFleets: number;
        fleetsWithMembers: number[];
    }>;
    bulkCreateFleets(organizationId: string, fleetsData: Partial<Fleet>[]): Promise<BulkOperationResult<Fleet>>;
    bulkUpdateFleets(organizationId: string, updates: Array<{
        id: string;
        data: Partial<Fleet>;
    }>): Promise<BulkOperationResult<Fleet>>;
    bulkDeleteFleets(organizationId: string, fleetIds: string[]): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
    bulkShareFleets(organizationId: string, fleetIds: string[], targetOrganizationId: string): Promise<BulkOperationResult<Fleet>>;
    getFleetTree(organizationId: string): Promise<FleetTreeNode[]>;
    private batchLoadShipCounts;
    private buildFleetTree;
    private validateMoveTarget;
    moveFleet(organizationId: string, fleetId: string, newParentId: string | null): Promise<Fleet>;
    reorderFleets(organizationId: string, orderedIds: string[], parentFleetId: string | null): Promise<void>;
    isDescendantOf(organizationId: string, potentialDescendantId: string, ancestorId: string): Promise<boolean>;
    private updateDescendantPaths;
}
export {};
//# sourceMappingURL=FleetService.d.ts.map