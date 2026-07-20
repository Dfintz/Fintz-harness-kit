import { Fleet } from '../../models/Fleet';
import { Ship } from '../../models/Ship';
export interface ShipMetrics {
    flightReadyCount: number;
    combatCapable: number;
    cargoCapable: number;
    totalCrew: number;
}
export declare function computeShipMetrics(ships: Ship[]): ShipMetrics;
export declare function computeOperationalScore(fleet: Pick<Fleet, 'operationalStats' | 'status'>): number;
//# sourceMappingURL=fleetController.metrics.d.ts.map