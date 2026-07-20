import { Repository } from 'typeorm';
import { FleetShip } from '../../models/FleetShip';
export interface BulkMemberUpdateInput {
    fleetId?: string;
    shipId?: string;
    role?: string;
    notes?: string;
}
export interface BulkMemberDeleteInput {
    fleetId?: string;
    shipId?: string;
}
export interface BulkMemberUpdateMutation {
    fleetId: string;
    shipId: string;
    role?: string;
    notes?: string;
}
export interface BulkMemberDeleteMutation {
    fleetId: string;
    shipId: string;
}
export declare function validateBulkUpdates(updates: BulkMemberUpdateInput[]): void;
export declare function validateBulkDeleteItems(items: BulkMemberDeleteInput[]): void;
export declare function applyBulkUpdate(txRepo: Repository<FleetShip>, organizationId: string, update: BulkMemberUpdateMutation): Promise<{
    updated: boolean;
}>;
export declare function applyBulkDelete(txRepo: Repository<FleetShip>, organizationId: string, item: BulkMemberDeleteMutation): Promise<boolean>;
//# sourceMappingURL=fleetController.bulkMembers.d.ts.map