import { TunnelConnection, TunnelRateLimitConfig } from '../../models/Tunnel';
import { TunnelAnalyticsEntry } from '../../models/TunnelAnalyticsEntry';
import { TunnelBan as TunnelBanEntity, TunnelBanType } from '../../models/TunnelBan';
import { TunnelAttachment, TunnelMessage as TunnelMessageEntity } from '../../models/TunnelMessage';
export type { TunnelAttachment, TunnelBanType, TunnelConnection, TunnelRateLimitConfig };
export interface Tunnel {
    id: string;
    name: string;
    inviteCode?: string;
    creatorGuildId: string;
    creatorChannelId: string;
    isPublic: boolean;
    password?: string;
    createdAt: Date;
    connectedChannels: TunnelConnection[];
    rateLimitConfig?: TunnelRateLimitConfig;
    contentFilterEnabled: boolean;
    allowBotMessages: boolean;
    maxConnectedServers: number;
    organizationId?: string;
}
export interface TunnelMessageData {
    id: string;
    tunnelId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    sourceGuildId?: string;
    sourceChannelId?: string;
    discordMessageId?: string;
    content?: string;
    attachments?: TunnelAttachment[];
    embeds?: Record<string, unknown>[];
    stickerIds?: string[];
    replyToMessageId?: string;
    isBot: boolean;
    wasBlocked?: boolean;
    blockReason?: string;
    isEdited?: boolean;
    editedAt?: Date;
    timestamp: Date;
}
export interface TunnelAnalytics {
    tunnelId: string;
    messagesRelayed: number;
    messagesBlocked: number;
    lastActivity: Date | null;
    peakConnectionCount: number;
    totalUniqueGuilds: number;
    attachmentsRelayed: number;
    reactionsRelayed: number;
    uniqueUserIds: Set<string>;
}
export interface TunnelSystemStats {
    totalTunnels: number;
    activeTunnels: number;
    totalConnections: number;
    totalMessagesRelayed: number;
    totalMessagesBlocked: number;
    mostActiveHour: number;
    tunnelsByVisibility: {
        public: number;
        private: number;
    };
    topTunnels: Array<{
        id: string;
        name: string;
        messagesRelayed: number;
        connectionCount: number;
    }>;
}
export declare class TunnelService {
    private static instance;
    private tunnelRepository;
    private messageRepository;
    private banRepository;
    private analyticsRepository;
    private readonly cache;
    private readonly cacheLoadedAt;
    private static readonly CACHE_FRESHNESS_MS;
    private initialized;
    private readonly analyticsData;
    private readonly hourlyActivity;
    private analyticsFlushInterval;
    constructor();
    static getInstance(): TunnelService;
    initialize(): Promise<void>;
    private getRepository;
    private getMessageRepository;
    private getBanRepository;
    private getAnalyticsRepository;
    private ensureInitialized;
    private cacheTunnel;
    createTunnel(name: string, creatorGuildId: string, creatorChannelId: string, isPublic?: boolean, password?: string, options?: {
        rateLimitConfig?: TunnelRateLimitConfig;
        organizationId?: string;
        contentFilterEnabled?: boolean;
        guildName?: string;
        channelName?: string;
    }): Promise<Tunnel>;
    getTunnel(tunnelId: string): Promise<Tunnel | undefined>;
    getTunnelSync(tunnelId: string): Tunnel | undefined;
    listPublicTunnels(): Promise<Tunnel[]>;
    listGuildTunnels(guildId: string, organizationId?: string): Promise<Tunnel[]>;
    connectToTunnel(tunnelId: string, guildId: string, channelId: string, password?: string, guildName?: string, channelName?: string): Promise<boolean>;
    disconnectFromTunnel(tunnelId: string, guildId: string, channelId: string): Promise<boolean>;
    deleteTunnel(tunnelId: string, guildId: string): Promise<boolean>;
    getConnectedChannels(tunnelId: string, excludeChannelId?: string): TunnelConnection[];
    private findCachedEntityByChannel;
    findTunnelByChannel(channelId: string): Tunnel | undefined;
    private refreshTunnelFromDb;
    private lastCacheRefresh;
    private static readonly CACHE_REFRESH_INTERVAL_MS;
    findTunnelByChannelAsync(channelId: string): Promise<Tunnel | undefined>;
    updateWebhook(tunnelId: string, channelId: string, webhookUrl: string): Promise<boolean>;
    updateTunnel(tunnelId: string, updates: {
        name?: string;
        rateLimitConfig?: TunnelRateLimitConfig;
        contentFilterEnabled?: boolean;
        allowBotMessages?: boolean;
        maxConnectedServers?: number;
    }): Promise<Tunnel | undefined>;
    updateName(tunnelId: string, name: string): Promise<boolean>;
    setPublic(tunnelId: string, isPublic: boolean): Promise<boolean>;
    regenerateInviteCode(tunnelId: string): Promise<string | null>;
    setPassword(tunnelId: string, password?: string): Promise<boolean>;
    updateRateLimitConfig(tunnelId: string, config: TunnelRateLimitConfig): Promise<boolean>;
    toggleContentFilter(tunnelId: string, enabled: boolean): Promise<boolean>;
    getTunnelConfig(tunnelId: string): {
        rateLimitConfig?: TunnelRateLimitConfig;
        contentFilterEnabled: boolean;
    };
    refreshCache(): Promise<void>;
    private generateTunnelId;
    private generateInviteCode;
    private toTunnelInterface;
    recordMessageRelay(tunnelId: string, wasBlocked?: boolean, userId?: string, hasAttachments?: boolean): void;
    getTunnelAnalytics(tunnelId: string): TunnelAnalytics | null;
    getSystemStats(): TunnelSystemStats;
    getHourlyActivity(): Map<number, number>;
    resetAnalytics(): void;
    private getUniqueGuildCount;
    findByInviteCode(code: string): Promise<Tunnel | undefined>;
    connectByInviteCode(code: string, guildId: string, channelId: string, password?: string, guildName?: string, channelName?: string): Promise<Tunnel>;
    saveMessage(data: TunnelMessageData): Promise<void>;
    getMessageHistory(tunnelId: string, limit?: number, before?: Date): Promise<TunnelMessageData[]>;
    findByDiscordMessageId(discordMessageId: string): Promise<TunnelMessageEntity | null>;
    updateMessageContent(discordMessageId: string, newContent: string): Promise<void>;
    private static readonly RELAY_KEY_PREFIX;
    private static readonly RELAY_REVERSE_PREFIX;
    private static readonly RELAY_TTL;
    storeRelayedMessageIds(discordMessageId: string, relayedIds: Record<string, string>, sourceChannelId?: string): Promise<void>;
    getRelayedMessageIds(discordMessageId: string): Promise<Record<string, string> | null>;
    getOriginalMessageId(relayedMessageId: string): Promise<{
        originalId: string;
        sourceChannelId: string;
    } | null>;
    banUser(tunnelId: string, userId: string, username: string, reason: string, issuedBy: string, expiresAt?: Date): Promise<void>;
    muteUser(tunnelId: string, userId: string, username: string, reason: string, issuedBy: string, expiresAt?: Date): Promise<void>;
    unbanUser(tunnelId: string, userId: string): Promise<boolean>;
    isUserBanned(tunnelId: string, userId: string): Promise<boolean>;
    isUserMuted(tunnelId: string, userId: string): Promise<boolean>;
    listBans(tunnelId: string): Promise<TunnelBanEntity[]>;
    persistAnalytics(): Promise<void>;
    getPersistedAnalytics(tunnelId: string, startDate: Date, endDate: Date): Promise<TunnelAnalyticsEntry[]>;
    updateMaxConnectedServers(tunnelId: string, maxServers: number): Promise<boolean>;
    toggleBotMessages(tunnelId: string, enabled: boolean): Promise<boolean>;
    destroy(): void;
}
//# sourceMappingURL=TunnelService.d.ts.map