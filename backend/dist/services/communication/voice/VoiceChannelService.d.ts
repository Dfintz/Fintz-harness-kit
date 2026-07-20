import { ChannelUsageStats, VoiceActivityLog, VoiceChannel, VoiceChannelConfig, VoiceChannelTemplate, VoiceChannelType } from '../../../types';
export declare class VoiceChannelService {
    private static instance;
    private readonly channels;
    private readonly templates;
    private readonly configs;
    private readonly stats;
    private cleanupInterval?;
    private constructor();
    static getInstance(): VoiceChannelService;
    private loadFromRedis;
    private persistChannel;
    private unpersistChannel;
    private persistTemplate;
    private unpersistTemplate;
    private persistConfig;
    createChannel(name: string, guildId: string, channelId: string, creatorId: string, type: VoiceChannelType, options?: {
        eventId?: string;
        expiresAt?: Date;
        userLimit?: number;
        templateId?: string;
    }): VoiceChannel;
    getChannel(channelId: string): VoiceChannel | undefined;
    getChannelByDiscordId(discordChannelId: string): VoiceChannel | undefined;
    getGuildChannels(guildId: string): VoiceChannel[];
    getEventChannels(eventId: string): VoiceChannel[];
    getTemporaryChannels(): VoiceChannel[];
    getExpiredChannels(): VoiceChannel[];
    logActivity(channelId: string, userId: string, userName: string, action: 'join' | 'leave' | 'move', guildId: string, channelName: string): void;
    getActivityLogs(channelId: string): VoiceActivityLog[];
    getGuildActivityLogs(guildId: string): VoiceActivityLog[];
    deleteChannel(channelId: string): boolean;
    deleteByDiscordId(discordChannelId: string): boolean;
    updateExpiration(channelId: string, expiresAt: Date | undefined): boolean;
    updateUserLimit(channelId: string, userLimit: number | undefined): boolean;
    cleanupExpiredChannels(): string[];
    private initializeDefaultTemplates;
    createTemplate(template: Omit<VoiceChannelTemplate, 'id' | 'createdAt'>): VoiceChannelTemplate;
    getTemplate(templateId: string): VoiceChannelTemplate | undefined;
    listTemplates(): VoiceChannelTemplate[];
    updateTemplate(templateId: string, updates: Partial<VoiceChannelTemplate>): boolean;
    deleteTemplate(templateId: string): boolean;
    configureGuild(config: VoiceChannelConfig): void;
    getGuildConfig(guildId: string): VoiceChannelConfig | undefined;
    updateGuildConfig(guildId: string, updates: Partial<VoiceChannelConfig>): boolean;
    initializeStats(channelId: string, guildId: string): void;
    trackUserSession(channelId: string, userId: string, username: string, duration: number): void;
    updatePeakUsers(channelId: string, userCount: number): void;
    getChannelStats(channelId: string): ChannelUsageStats | undefined;
    getGuildStats(guildId: string): ChannelUsageStats[];
    getTopChannels(guildId: string, limit?: number): ChannelUsageStats[];
    getTopUsers(guildId: string, limit?: number): Array<{
        userId: string;
        username: string;
        totalTime: number;
        sessionCount: number;
    }>;
    customizeChannel(channelId: string, userId: string, customizations: {
        name?: string;
        userLimit?: number;
        bitrate?: number;
    }): boolean;
    private startCleanupTask;
    stopCleanupTask(): void;
    getServiceStats(): {
        totalTemplates: number;
        totalChannels: number;
        totalActiveChannels: number;
        totalGuilds: number;
        totalSessions: number;
    };
}
//# sourceMappingURL=VoiceChannelService.d.ts.map