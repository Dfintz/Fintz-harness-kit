import { Client } from 'discord.js';
import { ChannelCounter } from '../../models/MemberEngagement';
export declare class ChannelCounterService {
    private static instance;
    private readonly repo;
    private readonly guildFetchCache;
    private static readonly GUILD_FETCH_TTL_MS;
    constructor();
    static getInstance(): ChannelCounterService;
    createCounter(guildId: string, channelId: string, counterType: string, nameTemplate?: string): Promise<ChannelCounter>;
    deleteCounter(guildId: string, channelId: string): Promise<boolean>;
    getCountersForGuild(guildId: string): Promise<ChannelCounter[]>;
    updateCounters(client: Client, guildId: string): Promise<void>;
    private resolveCounterValue;
}
//# sourceMappingURL=ChannelCounterService.d.ts.map