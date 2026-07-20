export interface FleetData {
    id: string;
    name?: string;
    organizationId?: string;
    description?: string;
    ships?: unknown[];
    [key: string]: unknown;
}
export interface FleetShip {
    id?: string;
    name: string;
    type?: string;
    status?: string;
    [key: string]: unknown;
}
export interface FleetComposition {
    totalShips?: number;
    shipsByType?: Record<string, number>;
    totalCrew?: number;
    totalCargo?: number;
    [key: string]: unknown;
}
export interface FleetEvent {
    type: 'fleet:created' | 'fleet:updated' | 'fleet:deleted' | 'fleet:ship_added' | 'fleet:ship_removed' | 'fleet:composition_updated';
    organizationId: string;
    fleetId: string;
    data: FleetData | FleetComposition | Record<string, unknown>;
    timestamp: number;
    userId?: string;
}
export declare const emitFleetCreated: (organizationId: string, fleet: FleetData | Record<string, unknown>, userId?: string) => void;
export declare const emitFleetUpdated: (organizationId: string, fleet: FleetData | Record<string, unknown>, userId?: string) => void;
export declare const emitFleetDeleted: (organizationId: string, fleetId: string, userId?: string) => void;
export declare const emitShipAddedToFleet: (organizationId: string, fleetId: string, ship: FleetShip, userId?: string) => void;
export declare const emitShipRemovedFromFleet: (organizationId: string, fleetId: string, shipId: string, userId?: string) => void;
export declare const emitFleetCompositionUpdated: (organizationId: string, fleetId: string, composition: FleetComposition, userId?: string) => void;
//# sourceMappingURL=fleetWebSocketController.d.ts.map