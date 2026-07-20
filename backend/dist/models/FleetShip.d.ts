import { TenantEntity } from './base/TenantEntity';
import { Fleet } from './Fleet';
import { Ship } from './Ship';
export declare class FleetShip extends TenantEntity {
    id: string;
    fleetId: string;
    fleet: Fleet;
    shipId: string;
    ship: Ship;
    role?: string;
    notes?: string;
    assignedBy?: string;
    assignedAt: Date;
    updatedAt: Date;
}
export interface CreateFleetShipDTO {
    fleetId: string;
    shipId: string;
    role?: string;
    notes?: string;
    assignedBy?: string;
}
export interface UpdateFleetShipDTO {
    role?: string;
    notes?: string;
}
//# sourceMappingURL=FleetShip.d.ts.map