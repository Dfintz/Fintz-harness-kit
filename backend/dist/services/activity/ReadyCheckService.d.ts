interface ReadyCheckState {
    id: string;
    activityId: string;
    activityTitle: string;
    organizationId: string;
    initiatedBy: string;
    initiatedByName: string;
    status: 'pending' | 'completed' | 'expired' | 'cancelled';
    expiresAt: string;
    durationSeconds: number;
    responses: Record<string, {
        userId: string;
        userName: string;
        response: 'ready' | 'not_ready' | 'pending';
        respondedAt?: string;
    }>;
    totalParticipants: number;
    threadPanel?: {
        channelId: string;
        messageId: string;
        postedAt: string;
    };
    createdAt: string;
    completedAt?: string;
}
export declare const READY_CHECK_VOTE_READY_PREFIX = "readycheck_vote_ready_";
export declare const READY_CHECK_VOTE_NOT_READY_PREFIX = "readycheck_vote_notready_";
export declare class ReadyCheckService {
    private readonly activityRepo;
    private readonly participantRepo;
    private readonly userRepo;
    private readonly notificationRouter;
    private readonly notificationPreferencesService;
    initiateReadyCheck(activityId: string, organizationId: string, userId: string, userName: string, durationSeconds?: number): Promise<ReadyCheckState>;
    respond(activityId: string, userId: string, userName: string, response: 'ready' | 'not_ready'): Promise<ReadyCheckState>;
    getActiveReadyCheck(activityId: string): Promise<ReadyCheckState | null>;
    cancelReadyCheck(activityId: string, userId: string, userName: string): Promise<void>;
    private getReadyCheckDiscordClient;
    private buildReadyCheckDmMessage;
    private buildEventThreadName;
    private shouldDeliverDiscordActivityNotification;
    private findActivityDiscussionThread;
    private createFallbackEventThread;
    private postReadyCheckThreadFallbackMentions;
    private tryPostThreadFallbackInGuild;
    private notifyParticipantsViaDiscordWithThreadFallback;
    private isThreadChannel;
    private formatParticipantList;
    private getReadyCheckStatusLabel;
    private getReadyCheckStatusColor;
    private buildReadyCheckThreadEmbed;
    private buildReadyCheckThreadComponents;
    private fetchStoredThreadPanelMessage;
    private resolveReadyCheckThread;
    private syncReadyCheckThreadPanel;
    private getActiveReadyCheckState;
    private isLeaderParticipant;
    private expireReadyCheck;
    private scheduleExpirationCheck;
    private calculateSummary;
    private toPublicReadyCheck;
}
export {};
//# sourceMappingURL=ReadyCheckService.d.ts.map