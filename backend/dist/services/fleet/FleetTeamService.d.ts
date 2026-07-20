import { Fleet } from '../../models/Fleet';
import { Team } from '../../models/Team';
export declare class FleetTeamService {
    private static instance;
    private readonly teamService;
    private readonly healthService;
    private readonly auditLogger;
    private listenerRegistered;
    private constructor();
    static getInstance(): FleetTeamService;
    static resetInstance(): void;
    registerListeners(): void;
    autoCreateTeamForFleet(organizationId: string, fleet: Fleet): Promise<Fleet>;
    syncTeamCapacity(organizationId: string, fleetId: string): Promise<void>;
    deleteTeamForFleet(organizationId: string, fleet: Fleet): Promise<void>;
    syncTeamHierarchy(organizationId: string, childFleet: Fleet, parentFleet: Fleet | null, _previousParentFleet: Fleet | null): Promise<void>;
    private handleMemberStatusChanged;
    selectCrewPosition(organizationId: string, fleetId: string, userId: string, shipId: string, role: string): Promise<{
        shipId: string;
        shipName: string;
        role: string;
        pending?: boolean;
    }>;
    unselectCrewPosition(organizationId: string, fleetId: string, userId: string): Promise<void>;
    getCrewPositions(organizationId: string, fleetId: string): Promise<{
        joinPolicy: string;
        pendingCount: number;
        ships: Array<{
            shipId: string;
            shipName: string;
            maxCrew: number;
            crew: Array<{
                userId: string;
                username: string;
                avatar: string | null;
                role: string;
                assignedAt: Date;
            }>;
        }>;
    }>;
    getFleetCrewMembers(organizationId: string, fleetId: string): Promise<{
        members: Array<{
            userId: string;
            username: string;
            displayName?: string;
            avatar: string | null;
            role: string;
            status: string;
            crewRole: string | null;
            assignedShipId: string | null;
            assignedShipName: string | null;
            joinedAt: string | null;
        }>;
    }>;
    private handleTeamEmblemUpdated;
    getTeamById(organizationId: string, teamId: string): Promise<Team | null>;
    private findDivisionTeam;
}
//# sourceMappingURL=FleetTeamService.d.ts.map