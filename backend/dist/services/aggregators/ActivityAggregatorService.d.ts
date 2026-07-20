import { Activity, ActivityParticipant } from '../../models/Activity';
import { NotificationResult } from '../communication';
interface ActivityTeamBreakdown {
    teamId: string;
    teamName: string;
    teamType: string;
    memberCount: number;
}
interface DiscordMessageResult {
    id: string;
    channelId: string;
    content: string;
}
export interface AggregatorWarning {
    code: string;
    stage: 'event' | 'notification' | 'discord' | 'attendance' | 'participant';
    message: string;
    details?: Record<string, unknown>;
}
export interface CreateActivityWithParticipantsParams {
    organizationId: string;
    activityData: {
        title: string;
        description?: string;
        activityType: string;
        scheduledStartDate: Date;
        scheduledEndDate?: Date;
        maxParticipants?: number;
        creatorId: string;
        [key: string]: unknown;
    };
    participantIds?: string[];
    notifyParticipants?: boolean;
    postToDiscord?: boolean;
    discordChannelId?: string;
}
export interface CompleteActivityParams {
    organizationId: string;
    activityId: string;
    completedById: string;
    outcome?: 'success' | 'failed' | 'cancelled';
    summary?: string;
    participantReports?: {
        userId: string;
        attended: boolean;
        contribution?: string;
    }[];
    notifyParticipants?: boolean;
}
export interface CompletePersonalActivityParams {
    activity: Activity;
    completedById: string;
    outcome?: 'success' | 'failed' | 'cancelled';
    summary?: string;
    participantReports?: {
        userId: string;
        attended: boolean;
        contribution?: string;
    }[];
    notifyParticipants?: boolean;
}
export declare class ActivityAggregatorService {
    private readonly activityService;
    private readonly participantService;
    private readonly eventService;
    private readonly notificationService;
    private readonly discordService;
    private readonly userService;
    private readonly availabilityService;
    constructor();
    private getErrorLogContext;
    private getAttendanceFlagFromNotes;
    private addWarning;
    private recordCreationEvent;
    private postCreateDiscordAnnouncement;
    private addParticipantsToActivity;
    createActivityWithParticipants(params: CreateActivityWithParticipantsParams): Promise<{
        activity: Activity;
        participants: ActivityParticipant[];
        notifications: NotificationResult[];
        warnings: AggregatorWarning[];
        discordMessage?: DiscordMessageResult;
        availabilityConflicts?: Array<{
            userId: string;
            available: boolean;
        }>;
    }>;
    private checkAvailabilityConflicts;
    private sendParticipantNotifications;
    private updateParticipantAttendance;
    private sendCompletionNotifications;
    completeActivity(params: CompleteActivityParams): Promise<{
        activity: Activity;
        updatedParticipants: ActivityParticipant[];
        notifications: NotificationResult[];
        warnings: AggregatorWarning[];
    }>;
    completePersonalActivity(params: CompletePersonalActivityParams): Promise<{
        activity: Activity;
        updatedParticipants: ActivityParticipant[];
        notifications: NotificationResult[];
        warnings: AggregatorWarning[];
    }>;
    cancelActivity(organizationId: string, activityId: string, cancelledById: string, reason?: string, notifyParticipants?: boolean): Promise<{
        activity: Activity;
        notifications: NotificationResult[];
        warnings: AggregatorWarning[];
    }>;
    getActivityWithDetails(organizationId: string, activityId: string): Promise<{
        activity: Activity;
        participants: ActivityParticipant[];
        events: unknown[];
        stats: {
            totalParticipants: number;
            confirmedParticipants: number;
            attendedParticipants: number;
            completionRate: number;
        };
        teamBreakdown?: ActivityTeamBreakdown[];
    }>;
}
export {};
//# sourceMappingURL=ActivityAggregatorService.d.ts.map