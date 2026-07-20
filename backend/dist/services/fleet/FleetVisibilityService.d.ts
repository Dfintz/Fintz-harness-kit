import { FleetVisibilityAccessLevel, FleetVisibilityRule, FleetVisibilityScope } from '../../models/FleetVisibilityRule';
export declare class FleetVisibilityService {
    private readonly ruleRepository;
    private readonly allianceRepository;
    private readonly federationMemberRepository;
    getRulesForFleet(organizationId: string, fleetId: string): Promise<FleetVisibilityRule[]>;
    createRule(organizationId: string, fleetId: string, data: {
        scope: FleetVisibilityScope;
        accessLevel: FleetVisibilityAccessLevel;
        minSecurityLevel?: number;
        targetAllianceOrgId?: string;
        targetFederationId?: string;
    }): Promise<FleetVisibilityRule>;
    updateRule(organizationId: string, ruleId: string, data: {
        accessLevel?: FleetVisibilityAccessLevel;
        minSecurityLevel?: number;
        isActive?: boolean;
    }): Promise<FleetVisibilityRule>;
    deleteRule(organizationId: string, ruleId: string): Promise<void>;
    getUserSecurityLevel(userId: string, organizationId: string): Promise<number>;
    resolveAccessLevel(requestingOrgId: string, fleetOrgId: string, fleetId: string, requesterSecurityLevel: number): Promise<FleetVisibilityAccessLevel | null>;
    getVisibleFleetIds(requestingOrgId: string): Promise<Array<{
        fleetId: string;
        accessLevel: FleetVisibilityAccessLevel;
    }>>;
    private validateRuleData;
    private resolveOrgLevelAccess;
    private resolveCrossOrgAccess;
    private accessLevelRank;
}
//# sourceMappingURL=FleetVisibilityService.d.ts.map