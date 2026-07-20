import { Client } from 'discord.js';
export declare class BotPresenceService {
    private static instance;
    private client;
    private refreshInterval;
    private currentIndex;
    private cachedStats;
    private opportunitySearchService;
    static getInstance(): BotPresenceService;
    initialize(client: Client): void;
    shutdown(): void;
    private getOpportunitySearchService;
    private refreshPresence;
    private fetchStats;
    private fetchRsiServerStatus;
    private setPresence;
    private formatStatLine;
}
//# sourceMappingURL=BotPresenceService.d.ts.map