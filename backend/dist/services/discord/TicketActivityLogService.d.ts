import { Client } from 'discord.js';
export type TicketActivityType = 'created' | 'assigned' | 'claimed' | 'replied' | 'closed' | 'reopened' | 'escalated' | 'auto_closed' | 'auto_escalated';
export declare class TicketActivityLogService {
    private static instance;
    private client;
    private readonly settingsService;
    static getInstance(): TicketActivityLogService;
    initialize(client: Client): void;
    logActivity(guildId: string, ticketNumber: string, activityType: TicketActivityType, actorName: string, details?: string): Promise<void>;
}
//# sourceMappingURL=TicketActivityLogService.d.ts.map