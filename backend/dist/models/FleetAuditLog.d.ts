import { Fleet } from './Fleet';
import { Organization } from './Organization';
export declare class FleetAuditLog {
    id: string;
    action: string;
    fleetId: string;
    fleet: Fleet;
    fleetName: string;
    organizationId: string;
    organization: Organization;
    performedById?: string;
    performedByName?: string;
    details: Record<string, unknown>;
    createdAt: Date;
}
//# sourceMappingURL=FleetAuditLog.d.ts.map