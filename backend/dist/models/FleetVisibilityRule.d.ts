import { Fleet } from './Fleet';
export type FleetVisibilityScope = 'organization' | 'alliance' | 'federation';
export type FleetVisibilityAccessLevel = 'summary' | 'composition' | 'full';
export declare class FleetVisibilityRule {
    id: string;
    fleetId: string;
    fleet: Fleet;
    organizationId: string;
    scope: FleetVisibilityScope;
    minSecurityLevel?: number;
    targetAllianceOrgId?: string;
    targetFederationId?: string;
    accessLevel: FleetVisibilityAccessLevel;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=FleetVisibilityRule.d.ts.map