import { Client } from 'discord.js';
export interface DiscordTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}
export interface DiscordUserInfo {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email?: string;
    verified?: boolean;
}
export interface DiscordRole {
    id: string;
    name: string;
}
export declare class DiscordService {
    private readonly client;
    private readonly roleCache;
    private readonly botToken;
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    constructor(botToken: string, clientId: string, clientSecret: string, redirectUri: string, externalClient?: Client);
    private setupEventHandlers;
    isReady(): boolean;
    generateAuthUrl(state: string, codeChallenge?: string): string;
    authenticateUser(code: string, redirectUri?: string, codeVerifier?: string): Promise<DiscordTokenResponse>;
    getUserInfo(accessToken: string): Promise<DiscordUserInfo>;
    refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse>;
    shouldRefreshToken(expiresAt: Date): boolean;
    revokeToken(accessToken: string): Promise<void>;
    sendMessage(channelId: string, message: string): Promise<void>;
    listenForCommands(commandPrefix: string, commandHandler: (command: string, args: string[]) => void): void;
    getUserRoles(guildId: string, userId: string): Promise<DiscordRole[]>;
    getGuildRoles(guildId: string): Promise<DiscordRole[]>;
    getGuildName(guildId: string): Promise<string | undefined>;
    private getGuildNameViaRest;
    getGuildChannels(guildId: string): Promise<{
        id: string;
        name: string;
        type: number;
        parentId?: string;
    }[]>;
    private getGuildChannelsViaRest;
    private discordRestRequest;
    private getGuildRolesViaRest;
    assignRole(guildId: string, userId: string, roleId: string, enqueueOnFailure?: boolean): Promise<string>;
    removeRole(guildId: string, userId: string, roleId: string, enqueueOnFailure?: boolean): Promise<string>;
    clearRoleCache(guildId?: string, userId?: string): Promise<void>;
    getRoleCacheStats(): Promise<import("../caching/DistributedCacheService").CacheStats>;
    private assignRoleViaGateway;
    private removeRoleViaGateway;
    private modifyMemberRoleViaRest;
    private createRestError;
    private enhanceRoleError;
    disconnect(): void;
}
export declare const initializeDiscordService: (botToken: string, clientId: string, clientSecret: string, redirectUri: string) => DiscordService;
export declare const isDiscordServiceInitialized: () => boolean;
export declare const getDiscordService: () => DiscordService;
//# sourceMappingURL=DiscordService.d.ts.map