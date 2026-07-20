import { LogisticsStatus, ResourceItem } from '@sc-fleet-manager/shared-types';
export { LogisticsStatus };
export type { ResourceItem };
export interface ShipLogistics {
    shipId: string;
    shipName: string;
    fuelCapacity: number;
    cargoCapacity: number;
    currentFuel: number;
    currentCargo: number;
    jumpRange: number;
}
export interface RouteWaypoint {
    location: string;
    distance: number;
    requiredFuel: number;
    order: number;
}
export declare class FleetLogistics {
    id: string;
    fleetId: string;
    operationName: string;
    description?: string;
    coordinatorId: string;
    status: LogisticsStatus;
    ships: ShipLogistics[];
    resources: ResourceItem[];
    route: RouteWaypoint[];
    totalFuelCapacity: number;
    totalCargoCapacity: number;
    totalFuelRequired: number;
    totalCargoUsed: number;
    maxJumpRange?: number;
    estimatedDuration?: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=FleetLogistics.d.ts.map