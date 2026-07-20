import { Activity, ParticipantRole, RouteWaypoint } from '../../models/Activity';
import { TenantService } from '../base/TenantService';
export interface CompletionReportDTO {
    actualDuration?: number;
    actualParticipants?: number;
    successRate?: number;
    creditsEarned?: number;
    reputationEarned?: number;
    notes?: string;
    screenshots?: string[];
    metadata?: Record<string, unknown>;
}
export interface VoiceChannelOptions {
    createVoiceChannel?: boolean;
    voiceChannelTemplate?: string;
    voiceChannelLimit?: number;
    voiceChannelBitrate?: number;
}
export interface DiscordEventCancellationResult {
    activityId: string;
    organizationId: string;
    participantCount: number;
    cancelledAt: string;
    wasCancelled: boolean;
}
export declare class ActivityEventService extends TenantService<Activity> {
    private readonly voiceChannelService;
    private readonly participantRepo;
    private reminderService;
    constructor();
    private getReminderService;
    private getUserNameFromActivity;
    private findActivityById;
    private canStartFromStatus;
    private applyCancellationLifecycle;
    createVoiceChannelForActivity(activityId: string, guildId: string, creatorUserId: string, options: VoiceChannelOptions): Promise<Activity>;
    linkVoiceChannel(activityId: string, channelId: string, _guildId: string): Promise<Activity>;
    addRoutePlan(activityId: string, routePlan: RouteWaypoint[], userId: string): Promise<Activity>;
    updateWaypoint(activityId: string, waypointIndex: number, waypoint: Partial<RouteWaypoint>, userId: string): Promise<Activity>;
    submitCompletionReport(activityId: string, report: CompletionReportDTO, userId: string): Promise<Activity>;
    startActivity(activityId: string, userId: string): Promise<Activity>;
    cancelActivity(activityId: string, userId: string, reason?: string, organizationId?: string): Promise<Activity>;
    cancelActivityAsSystem(organizationId: string, activityId: string, cancelledById: string, reason?: string): Promise<Activity>;
    cancelFromDiscordEvent(discordEventId: string, reason: string): Promise<DiscordEventCancellationResult | null>;
    rescheduleActivity(activityId: string, newStartDate: Date, userId: string, newEndDate?: Date, rescheduleReason?: string): Promise<Activity>;
    autoStartScheduledActivities(): Promise<number>;
    autoCompleteOverdueActivities(): Promise<number>;
    joinWaitlist(activityId: string, userId: string): Promise<Activity>;
    leaveWaitlist(activityId: string, userId: string): Promise<Activity>;
    promoteFromWaitlist(activityId: string, userId?: string): Promise<Activity>;
    updateRSVPStatus(activityId: string, userId: string, status: 'accepted' | 'declined' | 'standby', role?: ParticipantRole): Promise<Activity>;
}
//# sourceMappingURL=ActivityEventService.d.ts.map