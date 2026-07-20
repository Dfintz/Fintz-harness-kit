import { SelectQueryBuilder } from 'typeorm';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { ApiErrorCode } from '../../types/api';
export interface FleetLookupOptions {
    notFoundCode?: ApiErrorCode;
    notFoundMessage?: string;
}
export declare function loadFleetInOrganization(fleetId: string, organizationId: string, options?: FleetLookupOptions): Promise<Fleet>;
export declare function loadFleetAssignmentInFleet(assignmentId: string, fleetId: string, options?: FleetLookupOptions): Promise<FleetShip>;
export declare function buildFleetShipWithShipQuery(fleetId: string): SelectQueryBuilder<FleetShip>;
//# sourceMappingURL=fleetController.lookup.d.ts.map