import { type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { Activity, ActivityApplication, ActivityStatus, ActivityType, ApplicationStatus, ParticipantRole, RouteWaypoint, type ActivityParticipant } from '../../models/Activity';
import { TenantService } from '../base/TenantService';
import type { ActivityAuditEntry } from './ActivityAuditLogger';
import { ActivityAuditAction } from './ActivityAuditLogger';
import type { ActivitySearchFilters, ActivityStatistics, BringFleetAndInviteResult, CreateActivityDTO, JoinActivityDTO, ShipManagementCapabilities } from './ActivityService.types';
export type { ActivitySearchFilters, ActivityStatistics, BringFleetAndInviteResult, CreateActivityDTO, JoinActivityDTO, ShipManagementCapabilities, } from './ActivityService.types';
export declare class ActivityService extends TenantService<Activity> {
    private readonly voiceChannelService;
    constructor();
    private logActivityAudit;
    getActivityAuditLog(options?: {
        activityId?: string;
        organizationId?: string;
        performedById?: string;
        action?: ActivityAuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): ActivityAuditEntry[];
    getActivityAuditStats(activityId: string): {
        totalEvents: number;
        byAction: Record<string, number>;
        uniqueUsers: number;
        lastActivity: Date | null;
        recentEvents: ActivityAuditEntry[];
    };
    createActivity(organizationId: string, dto: CreateActivityDTO): Promise<Activity>;
    private _participantService?;
    private get participantService();
    private _routeCalcService?;
    private get routeCalcService();
    private recalculateFleetTotals;
    createVoiceChannelForActivity(activity: Activity, templateId?: string, userLimit?: number, bitrate?: number): Promise<void>;
    linkVoiceChannel(activityId: string, channelId: string, guildId: string): Promise<Activity>;
    joinActivity(activityId: string, dto: JoinActivityDTO): Promise<{
        activity: Activity;
        wasUpdate: boolean;
    }>;
    static toParticipantInfo(participant: ActivityParticipant): ParticipantInfo;
    toParticipantInfo(participant: ActivityParticipant): ParticipantInfo;
    leaveActivity(activityId: string, userId: string): Promise<Activity>;
    inviteOrganization(activityId: string, organizationId: string, organizationName: string, invitedBy: string, role?: 'co_host' | 'participant' | 'allied' | 'contracted'): Promise<Activity>;
    acceptOrganizationInvite(activityId: string, organizationId: string, _acceptedBy: string): Promise<Activity>;
    declineOrganizationInvite(activityId: string, organizationId: string): Promise<Activity>;
    private applyEnumAndOwnershipFilters;
    private applyParticipatingOrgsFilter;
    private applyMiscFilters;
    private applySearchTermFilter;
    searchActivities(filters: ActivitySearchFilters, page?: number, limit?: number): Promise<{
        activities: Activity[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getActivitiesForUser(userId: string, userOrgIds: string[], filters?: Partial<ActivitySearchFilters>): Promise<Activity[]>;
    updateStatus(activityId: string, status: ActivityStatus, userId: string): Promise<Activity>;
    submitCompletionReport(activityId: string, report: {
        submittedBy: string;
        outcome: 'success' | 'partial' | 'failure';
        duration?: number;
        creditsEarned?: number;
        reputationEarned?: number;
        objectivesCompleted?: string[];
        performanceRatings?: Record<string, number>;
        notableEvents?: string[];
        recommendations?: string;
    }): Promise<Activity>;
    getStatistics(organizationId?: string): Promise<ActivityStatistics>;
    private canUserAccessActivity;
    getActivityById(id: string): Promise<Activity | null>;
    updateActivity(id: string, updates: Partial<Activity>): Promise<Activity>;
    private broadcastRosterChange;
    findByBountyId(bountyId: string): Promise<Activity | null>;
    findByMissionId(missionId: string): Promise<Activity | null>;
    deleteActivity(id: string, userId: string): Promise<void>;
    addShip(activityId: string, userId: string, ship: {
        shipId?: string;
        shipType: string;
        shipName?: string;
        role: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
        crewCapacity: number;
        capabilities: string[];
        parentShipId?: string;
        transportType?: string;
    }): Promise<Activity>;
    loanShips(activityId: string, userId: string, userName: string, ships: Array<{
        shipId?: string;
        shipType: string;
        shipName?: string;
        crewCapacity?: number;
    }>): Promise<Activity>;
    removeOwnedShip(activityId: string, userId: string, shipIdentifier: string, shipIndex?: number): Promise<Activity>;
    joinShipAsCrew(activityId: string, userId: string, userName: string, shipOwnerId: string, crewPosition: string): Promise<Activity>;
    leaveShipCrew(activityId: string, userId: string): Promise<Activity>;
    getAvailableCrewPositions(activityId: string): Promise<Array<{
        shipId?: string;
        shipType: string;
        shipName?: string;
        ownerName: string;
        availableSlots: number;
        capabilities: string[];
    }>>;
    private findShipAssignmentByIdentifier;
    private replaceShipAssignment;
    private getShipManagementIdentifier;
    private canActorManageShip;
    getShipManagementCapabilities(activityId: string, actorUserId: string): Promise<ShipManagementCapabilities>;
    private assertCanManageShip;
    private assertCanAccessPassengerAndCrewSlots;
    setPassengerSlots(activityId: string, actorUserId: string, shipIdentifier: string, slots: Array<{
        role: string;
        capacity: number;
    }>): Promise<Activity>;
    joinShipAsPassenger(activityId: string, userId: string, userName: string, shipIdentifier: string, passengerRole: string): Promise<Activity>;
    leaveShipAsPassenger(activityId: string, userId: string): Promise<Activity>;
    getAvailablePassengerSlots(activityId: string, actorUserId?: string): Promise<Array<{
        shipId?: string;
        shipType: string;
        shipName?: string;
        ownerName: string;
        role: string;
        availableSlots: number;
    }>>;
    setCrewSlots(activityId: string, actorUserId: string, shipIdentifier: string, slots: Array<{
        role: string;
        capacity: number;
    }>): Promise<Activity>;
    getCrewSlotAvailability(activityId: string, actorUserId?: string): Promise<Array<{
        shipId?: string;
        shipType: string;
        shipName?: string;
        ownerName: string;
        slots: Array<{
            role: string;
            capacity: number;
            filled: number;
            available: number;
        }>;
    }>>;
    private resolveUserNames;
    private assertCanCommandFleet;
    bringFleetToActivity(activityId: string, actorUserId: string, fleetId: string, shipIds?: string[]): Promise<Activity>;
    inviteFleetMembers(activityId: string, actorUserId: string, fleetId: string, userIds?: string[]): Promise<{
        invited: string[];
        skipped: string[];
    }>;
    bringFleetAndInviteMembers(activityId: string, actorUserId: string, fleetId: string, options?: {
        shipIds?: string[];
        userIds?: string[];
    }): Promise<BringFleetAndInviteResult>;
    getFleetBringPlan(fleetId: string): Promise<{
        fleetName: string;
        memberShips: Map<string, Array<{
            shipId: string;
            shipName: string;
            maxCrew: number;
        }>>;
        orphanShipIds: string[];
    }>;
    setCrewPosition(activityId: string, actorUserId: string, targetUserId: string, shipAssignmentId: string, crewPosition: string): Promise<Activity>;
    nestShip(activityId: string, actorUserId: string, shipAssignmentId: string, options: {
        parentShipId: string | null;
        transportType: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar' | null;
    }): Promise<Activity>;
    private isDescendantOf;
    private validateNestingCapacity;
    private fitsInHangar;
    addRoutePlan(activityId: string, userId: string, waypoints: RouteWaypoint[]): Promise<Activity>;
    updateWaypoint(activityId: string, userId: string, waypointOrder: number, updates: Partial<RouteWaypoint>): Promise<Activity>;
    enrichWithMiningData(activityId: string): Promise<Activity>;
    autoEnrichMiningActivity(activity: Activity): Promise<Activity>;
    private _jobService?;
    private get jobService();
    submitApplication(activityId: string, applicationData: {
        applicantId: string;
        applicantName: string;
        applicantEmail?: string;
        rsiHandle?: string;
        discordId?: string;
        message?: string;
        answers?: Array<{
            questionId: string;
            question: string;
            answer: string;
        }>;
        referredBy?: string;
        timezone?: string;
        availablePlaytimes?: string[];
        preferredRoles?: string[];
    }): Promise<ActivityApplication>;
    acceptApplication(activityId: string, applicationId: string, reviewerId: string, notes?: string): Promise<ActivityApplication>;
    rejectApplication(activityId: string, applicationId: string, reviewerId: string, reason?: string): Promise<ActivityApplication>;
    advanceApplicationStage(activityId: string, applicationId: string, reviewerId: string, comment?: string): Promise<ActivityApplication>;
    withdrawApplication(activityId: string, applicationId: string, applicantId: string): Promise<ActivityApplication>;
    getApplications(activityId: string, filters?: {
        status?: ApplicationStatus;
        applicantId?: string;
    }): Promise<ActivityApplication[]>;
    scheduleInterview(activityId: string, applicationId: string, interviewData: {
        scheduledAt: Date;
        interviewerId: string;
        notes?: string;
    }): Promise<ActivityApplication>;
    completeJob(activityId: string, applicationId: string, completionData: {
        rating?: number;
        review?: string;
    }): Promise<ActivityApplication>;
    private _eventService?;
    private get eventService();
    joinWaitlist(activityId: string, userId: string): Promise<Activity>;
    leaveWaitlist(activityId: string, userId: string): Promise<Activity>;
    promoteFromWaitlist(activityId: string, userId?: string): Promise<Activity>;
    updateRSVPStatus(activityId: string, userId: string, status: 'accepted' | 'declined' | 'standby', role?: ParticipantRole): Promise<Activity>;
    cloneActivity(activityId: string, overrides?: {
        scheduledStartDate?: Date;
        scheduledEndDate?: Date;
        organizationId?: string;
        discordServerId?: string;
    }): Promise<Activity>;
    createFromTemplate(templateId: string, data: {
        scheduledStartDate: Date;
        scheduledEndDate?: Date;
        organizationId?: string;
        customizations?: Partial<CreateActivityDTO>;
    }): Promise<Activity>;
    getUpcomingActivities(filters?: {
        activityType?: ActivityType;
        organizationId?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<Activity[]>;
    completeActivity(activityId: string, completionData: {
        submittedBy: string;
        submittedAt: Date;
        outcome: 'success' | 'partial' | 'failure';
        participantCount: number;
        duration: number;
        creditsEarned: number;
        reputationEarned: number;
        objectivesCompleted?: string[];
        casualties?: number;
        performanceRatings?: Record<string, number>;
        notableEvents?: string[];
        recommendations?: string;
    }): Promise<Activity>;
}
//# sourceMappingURL=ActivityService.d.ts.map