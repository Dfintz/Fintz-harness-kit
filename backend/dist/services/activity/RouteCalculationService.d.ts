import { Activity, RouteWaypoint, ShipAssignment } from '../../models/Activity';
export interface RouteCalculationResult {
    totalCargoCapacity: number;
    totalQuantumFuel: number;
    totalQuantumFuelRequired: number;
    maxJumpRange: number;
    hasRefuelShip: boolean;
    insufficientFuel: boolean;
    refuelStopsNeeded: number;
    bottleneckShip?: string;
    totalCrewCapacity: number;
}
export declare class RouteCalculationService {
    private shipRepository;
    static readonly REFUEL_SHIPS: string[];
    static readonly REARM_SHIPS: string[];
    static readonly REPAIR_SHIPS: string[];
    static readonly MEDICAL_SHIPS: string[];
    private getShipRepository;
    calculateRoute(shipAssignments: ShipAssignment[], routePlan?: RouteWaypoint[]): Promise<RouteCalculationResult>;
    private getShipSpecifications;
    enrichShipMetadata(shipAssignments: ShipAssignment[]): Promise<void>;
    updateActivityRouteData(activity: Activity): Promise<Activity>;
}
//# sourceMappingURL=RouteCalculationService.d.ts.map