import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum FleetAuditAction {
    FLEET_CREATED = "FLEET_CREATED",
    FLEET_UPDATED = "FLEET_UPDATED",
    FLEET_DELETED = "FLEET_DELETED",
    FLEET_ARCHIVED = "FLEET_ARCHIVED",
    FLEET_RESTORED = "FLEET_RESTORED",
    SHIP_ADDED_TO_FLEET = "SHIP_ADDED_TO_FLEET",
    SHIP_REMOVED_FROM_FLEET = "SHIP_REMOVED_FROM_FLEET",
    SHIPS_BULK_ADDED = "SHIPS_BULK_ADDED",
    FLEET_NESTED = "FLEET_NESTED",
    FLEET_UNNESTED = "FLEET_UNNESTED",
    FLEET_REORDERED = "FLEET_REORDERED",
    FLEET_TEAM_CREATED = "FLEET_TEAM_CREATED",
    FLEET_TEAM_CAPACITY_UPDATED = "FLEET_TEAM_CAPACITY_UPDATED",
    FLEET_TEAM_REPARENTED = "FLEET_TEAM_REPARENTED",
    FLEET_TEAM_DELETED = "FLEET_TEAM_DELETED",
    CREW_MEMBER_ASSIGNED = "CREW_MEMBER_ASSIGNED",
    CREW_MEMBER_UNASSIGNED = "CREW_MEMBER_UNASSIGNED",
    CREW_MEMBER_UNAVAILABLE = "CREW_MEMBER_UNAVAILABLE",
    CREW_POSITION_SELECTED = "CREW_POSITION_SELECTED",
    CREW_POSITION_VACATED = "CREW_POSITION_VACATED",
    FLEET_GATE_PASSED = "FLEET_GATE_PASSED",
    FLEET_GATE_FAILED = "FLEET_GATE_FAILED"
}
export interface CrewFillImpact {
    readonly filledBefore: number;
    readonly filledAfter: number;
    readonly required: number;
    readonly rateBefore: number;
    readonly rateAfter: number;
}
export interface FleetAuditEntry extends BaseDomainAuditEntry<FleetAuditAction> {
    fleetId: string;
    fleetName: string;
}
export declare class FleetAuditLogger extends DomainAuditLogger<FleetAuditAction, FleetAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): FleetAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: FleetAuditEntry): string;
    protected buildResource(entry: FleetAuditEntry): string;
    log(entry: Omit<FleetAuditEntry, 'timestamp'>): void;
    private persistToDatabase;
    logShipAdded(organizationId: string, fleetId: string, fleetName: string, shipId: string, shipName: string, performedById?: string, performedByName?: string): void;
    logShipRemoved(params: {
        organizationId: string;
        fleetId: string;
        fleetName: string;
        shipId: string;
        shipName: string;
        crewFillImpact?: CrewFillImpact;
        performedById?: string;
        performedByName?: string;
    }): void;
    logFleetNested(organizationId: string, childFleetId: string, childFleetName: string, parentFleetId: string, parentFleetName: string, performedById?: string, performedByName?: string): void;
    logFleetUnnested(organizationId: string, childFleetId: string, childFleetName: string, previousParentFleetId: string, previousParentFleetName: string, performedById?: string, performedByName?: string): void;
    logCrewMemberUnavailable(params: {
        organizationId: string;
        fleetId: string;
        fleetName: string;
        memberId: string;
        memberName: string;
        previousStatus: string;
        newStatus: string;
        crewFillImpact?: CrewFillImpact;
    }): void;
    logGateChange(organizationId: string, fleetId: string, fleetName: string, passed: boolean, gate: string, crewFillImpact: CrewFillImpact, trigger: string): void;
    logTeamCreated(organizationId: string, fleetId: string, fleetName: string, teamId: string, teamName: string, maxMembers: number): void;
    logTeamCapacityUpdated(params: {
        organizationId: string;
        fleetId: string;
        fleetName: string;
        teamId: string;
        previousCapacity: number;
        newCapacity: number;
        totalCrewPositions: number;
        standbySlots: number;
    }): void;
    getFleetAuditLog(options?: {
        fleetId?: string;
        organizationId?: string;
        action?: FleetAuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<FleetAuditEntry[]>;
    private queryFromDatabase;
}
export declare const fleetAuditLogger: FleetAuditLogger;
//# sourceMappingURL=FleetAuditLogger.d.ts.map