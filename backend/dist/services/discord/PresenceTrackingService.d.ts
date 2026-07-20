import { Client } from 'discord.js';
export interface PresenceSnapshot {
    userId: string;
    guildId: string;
    status: 'online' | 'idle' | 'dnd' | 'offline';
    gameName?: string;
    gameDetails?: string;
    timestamp: Date;
}
export interface GuildGameStats {
    guildId: string;
    currentPlayers: Record<string, number>;
    playersByGame: Record<string, string[]>;
    statusCounts: {
        online: number;
        idle: number;
        dnd: number;
        offline: number;
    };
}
export interface ActivityDataPoint {
    hour: number;
    dayOfWeek: number;
    count: number;
}
export interface GamePresenceHistory {
    gameName: string;
    totalSessions: number;
    uniquePlayers: number;
    hourlyActivity: ActivityDataPoint[];
}
export declare class PresenceTrackingService {
    private static instance;
    private client;
    private readonly history;
    private static readonly MAX_HISTORY_PER_GUILD;
    private readonly livePresence;
    private static readonly MAX_LIVE_PRESENCE;
    private cleanupInterval;
    private publishInterval;
    private readonly presenceUpdateListener;
    static getInstance(): PresenceTrackingService;
    initialize(client: Client): void;
    shutdown(): void;
    private handlePresenceUpdate;
    getCurrentGameStats(guildId: string): GuildGameStats;
    getActivityHeatmap(guildId: string, days?: number): ActivityDataPoint[];
    getGamePresenceHistory(guildId: string, days?: number): GamePresenceHistory[];
    getStatusCounts(guildId: string): GuildGameStats['statusCounts'];
    private cleanupStalePresence;
    private publishPresenceToRedis;
}
//# sourceMappingURL=PresenceTrackingService.d.ts.map