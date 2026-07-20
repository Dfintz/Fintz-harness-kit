import { Fleet } from '../../models/Fleet';
export declare function emitTouchedFleetUpdates(organizationId: string, userId: string, fleetIds: Set<string>): Promise<Fleet[]>;
export declare function syncTeamCapacityForFleets(organizationId: string, fleets: Fleet[]): Promise<void>;
//# sourceMappingURL=fleetController.postBulkUpdates.d.ts.map