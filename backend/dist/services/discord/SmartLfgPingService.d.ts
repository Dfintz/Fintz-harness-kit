import { Client } from 'discord.js';
import { LFGActivity, LFGPost } from '../../types';
export interface SmartLfgPingSettings {
    enabled: boolean;
    cooldownHours: number;
    maxPingsPerPost: number;
    activityFilter: LFGActivity[];
    optInRoleId?: string;
}
export declare const DEFAULT_SMART_LFG_PING_SETTINGS: SmartLfgPingSettings;
export declare class SmartLfgPingService {
    private static instance;
    private client;
    private readonly cooldowns;
    private cleanupInterval;
    private constructor();
    static getInstance(): SmartLfgPingService;
    initialize(client: Client): void;
    shutdown(): void;
    notifyMatchingMembers(post: LFGPost, settings: SmartLfgPingSettings): Promise<number>;
    private findCandidates;
    private sendPings;
    private buildPingEmbed;
    private cleanupExpiredCooldowns;
}
//# sourceMappingURL=SmartLfgPingService.d.ts.map