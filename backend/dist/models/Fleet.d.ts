import { TenantEntity } from './base/TenantEntity';
import type { FleetShip } from './FleetShip';
import type { Team } from './Team';
export declare enum FleetStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    DEPLOYED = "deployed",
    DISBANDED = "disbanded"
}
export declare enum FleetType {
    COMBAT = "combat",
    MINING = "mining",
    TRADING = "trading",
    EXPLORATION = "exploration",
    SALVAGE = "salvage",
    ESCORT = "escort",
    RECONNAISSANCE = "reconnaissance",
    MEDICAL = "medical",
    MIXED = "mixed"
}
export interface FleetComposition {
    totalShips: number;
    shipsByRole: Record<string, number>;
    totalCrewCapacity: number;
    totalCargoCapacity: number;
    estimatedValue: number;
}
export interface FleetOperationalStats {
    missionsCompleted: number;
    hoursOperational: number;
    lastDeployment: Date | null;
    averageUptime: number;
}
export declare class Fleet extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    emblem?: string;
    status: FleetStatus;
    type: FleetType;
    leaderId?: string;
    secondInCommandId?: string;
    members: string[];
    shipIds: string[];
    maxMembers: number;
    isPublic: boolean;
    allowApplications: boolean;
    visibility: string;
    allowedOrganizations: string[];
    publicViewEnabled: boolean;
    allowJoinRequests: boolean;
    composition?: FleetComposition;
    operationalStats?: FleetOperationalStats;
    primaryActivity?: string;
    deployedAt?: Date;
    deploymentLocation?: string;
    color: string;
    tags: string[];
    crewMode: 'lean' | 'conservative';
    teamId?: string;
    team?: Team;
    parentFleetId?: string;
    parent?: Fleet;
    children?: Fleet[];
    level: number;
    sortOrder: number;
    hierarchyPath: string;
    isArchived: boolean;
    archivedAt?: Date;
    archivedBy?: string;
    archiveReason?: string;
    restoredAt?: Date;
    restoredBy?: string;
    createdAt: Date;
    updatedAt: Date;
    fleetShips?: FleetShip[];
    private _memberCount?;
    get memberCount(): number;
    set memberCount(value: number);
    private _shipCount?;
    get shipCount(): number;
    set shipCount(value: number);
    get isDeployed(): boolean;
    get canAcceptMembers(): boolean;
}
export declare function enrichFleetCounts(fleet: Fleet, shipCountOverride?: number): Fleet & {
    shipCount: number;
    memberCount: number;
};
//# sourceMappingURL=Fleet.d.ts.map