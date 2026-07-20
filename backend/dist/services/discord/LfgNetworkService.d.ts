import { Client } from 'discord.js';
export interface LfgNetworkSettings {
    enabled: boolean;
    broadcastOutgoing: boolean;
    receiveIncoming: boolean;
    incomingChannelId?: string;
    activityFilter: string[];
}
export declare const DEFAULT_LFG_NETWORK: LfgNetworkSettings;
export interface LfgBroadcastPayload {
    sourceGuildId: string;
    sourceGuildName: string;
    activity: string;
    description: string;
    hostName: string;
    maxPlayers: number;
    currentPlayers: number;
    duration: number;
    createdAt: Date;
}
export declare class LfgNetworkService {
    private static instance;
    private client;
    private readonly settingsService;
    private readonly tunnelService;
    static getInstance(): LfgNetworkService;
    initialize(client: Client): void;
    broadcastLfgPost(payload: LfgBroadcastPayload): Promise<number>;
    private getConnectedGuildIds;
    private buildBroadcastEmbed;
}
//# sourceMappingURL=LfgNetworkService.d.ts.map