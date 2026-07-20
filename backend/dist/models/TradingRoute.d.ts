import { RouteStatus, RouteVisibility } from '@sc-fleet-manager/shared-types';
import { Organization } from './Organization';
export { RouteStatus, RouteVisibility };
export interface TradeStop {
    location: string;
    buyGoods?: string[];
    sellGoods?: string[];
    order: number;
    type?: 'trade' | 'refuel' | 'waypoint';
    requiredFuel?: number;
    distance?: number;
}
export interface RoutePerformance {
    runCount: number;
    avgProfit: number;
    avgDuration: number;
    lastRun?: Date;
}
export interface FleetComposition {
    ships: Array<{
        shipId: string;
        shipName: string;
        quantity: number;
        cargo?: number;
        speed?: number;
        quantumSpeed?: number;
        quantumFuelCapacity?: number;
        isRefuelingShip?: boolean;
    }>;
    totalCargo: number;
    slowestSpeed: number;
    slowestQuantumSpeed: number;
    minFuelCapacity: number;
    hasRefuelingShip: boolean;
}
export declare class TradingRoute {
    id: string;
    name: string;
    description: string;
    creatorId: string;
    organizationId?: string;
    organization?: Organization;
    visibility: RouteVisibility;
    stops: TradeStop[];
    estimatedProfit?: number;
    estimatedDuration?: number;
    minCargoCapacity?: number;
    fleetComposition?: FleetComposition;
    status: RouteStatus;
    performance?: RoutePerformance;
    tags: string[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=TradingRoute.d.ts.map