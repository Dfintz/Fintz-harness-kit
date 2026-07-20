import { Fleet } from '../../models/Fleet';
import { Ship } from '../../models/Ship';
import type { CrewMode } from '../../utils/crewCalculation';
export declare const STANDBY_CREW_RATIO = 0.3;
export interface ShipCrewGate {
    shipId: string;
    shipName: string;
    maxCrew: number;
    leanRequired: number;
    conservativeRequired: number;
    filled: number;
    passesLean: boolean;
    passesConservative: boolean;
}
export interface FleetCrewHealth {
    crewFillRate: number;
    totalRequired: number;
    totalFilled: number;
    totalMaxCrew: number;
    standbySlots: number;
    standbyFilled: number;
    perShip: ShipCrewGate[];
    overallGatePassed: boolean;
    crewMode: CrewMode;
}
export interface ShipMaintenanceStatus {
    shipId: string;
    shipName: string;
    size: string;
    status: string;
    isFlightReady: boolean;
    maxCrew: number;
    hullHp: number;
    shieldHp: number;
    cargoScu: number;
    isSupplyCapable: boolean;
    supplyCapacity: {
        ammunition: number;
        fuel: number;
        repairMaterial: number;
        totalAllocated: number;
    };
}
export interface FleetMaintenanceHealth {
    totalShips: number;
    flightReadyShips: number;
    supplyCapableShips: number;
    totalSupply: {
        ammunition: number;
        fuel: number;
        repairMaterial: number;
        totalScu: number;
    };
    perShip: ShipMaintenanceStatus[];
}
export interface FleetHealthScore {
    fleetId: string;
    fleetName: string;
    healthScore: number;
    status: 'green' | 'yellow' | 'red';
    breakdown: {
        readinessScore: number;
        crewFillRate: number;
        capabilityScore: number;
        operationalScore: number;
    };
    details: {
        totalShips: number;
        flightReadyShips: number;
        totalCrewPositions: number;
        crewFilled: number;
        crewMode: CrewMode;
        overallGatePassed: boolean;
        standbySlots: number;
        standbyFilled: number;
        fleetStatus: string;
    };
    crewHealth: FleetCrewHealth;
    maintenanceHealth: FleetMaintenanceHealth;
}
export declare class FleetHealthService {
    calculateFleetHealth(organizationId: string, fleetId: string): Promise<FleetHealthScore>;
    calculateCrewHealth(organizationId: string, fleet: Fleet, ships: Ship[], crewMode: CrewMode): Promise<FleetCrewHealth>;
    calculateTeamCapacity(ships: Ship[]): {
        totalCrewPositions: number;
        standbySlots: number;
        totalCapacity: number;
    };
    private calculateMaintenanceHealth;
    private computeCapabilityScore;
    private computeOperationalScore;
}
//# sourceMappingURL=FleetHealthService.d.ts.map