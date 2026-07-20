import type { ShipRequirement } from '@sc-fleet-manager/shared-types';
import { Ship, ShipSize, ShipStatus } from '../../models/Ship';
import { TenantService } from '../base/TenantService';
export interface ShipFilters {
    manufacturer?: string;
    size?: ShipSize;
    role?: string;
    status?: ShipStatus;
    isVehicle?: boolean;
    isActive?: boolean;
    search?: string;
}
export declare class ShipService extends TenantService<Ship> {
    constructor();
    findWithFilters(organizationId: string, filters: ShipFilters): Promise<Ship[]>;
    findByIds(organizationId: string, shipIds: string[]): Promise<Ship[]>;
    findByManufacturer(organizationId: string, manufacturer: string): Promise<Ship[]>;
    findBySize(organizationId: string, size: ShipSize): Promise<Ship[]>;
    findByRole(organizationId: string, role: string): Promise<Ship[]>;
    getStatistics(organizationId: string): Promise<{
        total: number;
        byManufacturer: Record<string, number>;
        bySize: Record<string, number>;
        byStatus: Record<string, number>;
        totalValue: number;
    }>;
    search(organizationId: string, searchTerm: string): Promise<Ship[]>;
    deactivate(organizationId: string, id: string): Promise<Ship | null>;
    reactivate(organizationId: string, id: string): Promise<Ship | null>;
    getAverageCrewByRole(role: string): Promise<number>;
    getCrewByShipName(shipName: string): Promise<number>;
    calculateCrewFromRequirements(requirements: ShipRequirement[]): Promise<number>;
    private batchGetCrewByNames;
    private batchGetCrewByRoles;
    batchGetShipSpecsByNames(shipNames: string[]): Promise<Map<string, {
        cargo: number;
        quantumFuelCapacity: number;
    }>>;
    batchGetShipCareersByNames(shipNames: string[]): Promise<Map<string, string>>;
}
//# sourceMappingURL=ShipService.d.ts.map