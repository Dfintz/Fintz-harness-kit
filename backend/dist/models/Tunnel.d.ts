import { Organization } from './Organization';
export interface TunnelRateLimitConfig {
    maxMessages: number;
    windowMs: number;
    blockDurationMs: number;
}
export interface TunnelConnection {
    guildId: string;
    channelId: string;
    guildName?: string;
    channelName?: string;
    webhookUrl?: string;
    webhookId?: string;
    connectedAt: Date;
}
export declare class Tunnel {
    id: string;
    name: string;
    inviteCode?: string;
    creatorGuildId: string;
    creatorChannelId: string;
    isPublic: boolean;
    password?: string;
    connectedChannels: TunnelConnection[];
    rateLimitConfig?: TunnelRateLimitConfig;
    contentFilterEnabled: boolean;
    allowBotMessages: boolean;
    maxConnectedServers: number;
    organizationId?: string;
    organization?: Organization;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Tunnel.d.ts.map