import { Activity, ActivityParticipant, ParticipantRole } from '../../models/Activity';
import { ActivityParticipantEntity, ActivityParticipantStatus } from '../../models/ActivityParticipant';
import { TenantService } from '../base/TenantService';
export interface JoinActivityDTO {
    userId: string;
    userName: string;
    organizationId?: string;
    organizationName?: string;
    role?: ParticipantRole;
    shipId?: string;
    shipType?: string;
    shipName?: string;
    crewPosition?: string;
    crewShipId?: string;
    notes?: string;
    message?: string;
    metadata?: Record<string, unknown>;
}
export interface ShipDTO {
    shipType: string;
    shipName: string;
    captainId: string;
    captainName: string;
    maxCrew?: number;
    currentCrew?: number;
    description?: string;
    metadata?: Record<string, unknown>;
}
export interface AvailableCrewPosition {
    activityId: string;
    shipId: string;
    shipName: string;
    shipType: string;
    position: string;
    available: boolean;
    requirements?: string[];
}
export declare class ActivityParticipantService extends TenantService<Activity> {
    private readonly participantRepo;
    private _routeCalcService?;
    private get routeCalcService();
    constructor();
    private findActivityById;
    private findParticipantByActivityAndUser;
    isParticipant(activityId: string, userId: string): Promise<boolean>;
    getParticipantCount(activityId: string, status?: ActivityParticipantStatus): Promise<number>;
    getParticipants(activityId: string, status?: ActivityParticipantStatus): Promise<ActivityParticipantEntity[]>;
    getUserActivities(userId: string): Promise<ActivityParticipantEntity[]>;
    getParticipant(activityId: string, userId: string): Promise<ActivityParticipantEntity | null>;
    isLeader(activityId: string, userId: string): Promise<boolean>;
    canManageActivity(activityId: string, userId: string): Promise<boolean>;
    updateParticipant(activityId: string, userId: string, updates: Partial<Pick<ActivityParticipantEntity, 'shipId' | 'shipType' | 'shipName' | 'crewPosition' | 'crewShipId' | 'role' | 'status' | 'notes'>>): Promise<number>;
    inviteMembers(activityId: string, members: Array<{
        userId: string;
        userName: string;
        organizationId?: string;
        organizationName?: string;
    }>): Promise<{
        invited: string[];
        skipped: string[];
    }>;
    syncParticipantToTable(activityId: string, participant: ActivityParticipant): Promise<void>;
    removeParticipantFromTable(activityId: string, userId: string): Promise<void>;
    joinActivity(activityId: string, dto: JoinActivityDTO): Promise<{
        activity: Activity;
        wasUpdate: boolean;
    }>;
    leaveActivity(activityId: string, userId: string): Promise<Activity>;
    addShip(activityId: string, userId: string, shipDto: ShipDTO): Promise<Activity>;
    joinShipAsCrew(activityId: string, shipId: string, userId: string, userName: string, position: string): Promise<Activity>;
    private findAndRemoveFromCrew;
    leaveShipCrew(activityId: string, userId: string): Promise<Activity>;
    getAvailableCrewPositions(activityId: string): Promise<AvailableCrewPosition[]>;
    inviteOrganization(activityId: string, organizationId: string, organizationName: string, invitedByUserId: string, role?: string): Promise<Activity>;
    acceptOrganizationInvite(activityId: string, organizationId: string): Promise<Activity>;
    declineOrganizationInvite(activityId: string, organizationId: string): Promise<Activity>;
}
//# sourceMappingURL=ActivityParticipantService.d.ts.map