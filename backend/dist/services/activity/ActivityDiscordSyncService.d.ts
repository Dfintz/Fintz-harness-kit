export interface ActivityVoiceChannelInfo {
    channelId: string;
    autoDelete: boolean;
}
export declare class ActivityDiscordSyncService {
    private readonly repository;
    private isDatabaseReady;
    getDiscordEventId(activityId: string, organizationId: string): Promise<string | null>;
    getVoiceChannelInfo(activityId: string, organizationId: string): Promise<ActivityVoiceChannelInfo | null>;
    clearDiscordEventPointer(activityId: string, organizationId: string): Promise<boolean>;
    clearVoiceChannelPointers(activityId: string, organizationId: string): Promise<boolean>;
}
export declare const activityDiscordSyncService: ActivityDiscordSyncService;
//# sourceMappingURL=ActivityDiscordSyncService.d.ts.map