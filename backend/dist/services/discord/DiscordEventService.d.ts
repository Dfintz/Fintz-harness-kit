import { Client } from 'discord.js';
export declare class DiscordEventService {
    private static instance;
    private client;
    private constructor();
    static getInstance(): DiscordEventService;
    initialize(client: Client): void;
    createEvent(guildId: string, activity: {
        title: string;
        description?: string;
        scheduledStartDate: Date;
        scheduledEndDate?: Date;
        location?: string;
        participantCount?: number;
        participantCap?: number;
    }): Promise<string | null>;
    updateEvent(guildId: string, discordEventId: string, updates: {
        title?: string;
        description?: string;
        scheduledStartDate?: Date;
        scheduledEndDate?: Date;
        status?: 'active' | 'completed' | 'cancelled';
    }): Promise<boolean>;
    deleteEvent(guildId: string, discordEventId: string): Promise<boolean>;
}
//# sourceMappingURL=DiscordEventService.d.ts.map