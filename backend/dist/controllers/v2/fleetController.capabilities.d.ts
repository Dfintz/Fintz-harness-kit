import { Fleet } from '../../models/Fleet';
import { Ship } from '../../models/Ship';
export interface FleetCapabilities {
    totalCargoCapacity: number;
    avgQuantumFuel: number | null;
    hasRefuelShip: boolean;
    hasRearmShip: boolean;
    hasRepairShip: boolean;
    hasMedicalShip: boolean;
    refuelShipNames: string[];
    rearmShipNames: string[];
    repairShipNames: string[];
    medicalShipNames: string[];
}
export declare function matchesCapability(nameLower: string, capList: readonly string[]): boolean;
export declare function aggregateShipCapabilities(ships: Ship[]): FleetCapabilities;
export declare function batchShipCounts(fleetIds: string[]): Promise<Map<string, number>>;
export declare function batchMemberCounts(fleets: Fleet[], organizationId: string): Promise<Map<string, number>>;
export declare function computeFleetCapabilities(fleetIds: string[]): Promise<Map<string, FleetCapabilities>>;
//# sourceMappingURL=fleetController.capabilities.d.ts.map