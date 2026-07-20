import { Client } from 'discord.js';
export declare class DiscordAuditLogService {
    private static instance;
    private client;
    private readonly onMessageDelete;
    private readonly onMessageUpdate;
    private readonly onGuildMemberUpdate;
    private readonly onChannelCreate;
    private readonly onChannelDelete;
    private constructor();
    static getInstance(): DiscordAuditLogService;
    initialize(client: Client): void;
    shutdown(): void;
    private registerListeners;
    private handleMessageDelete;
    private handleMessageEdit;
    private handleMemberUpdate;
    private handleChannelCreate;
    private handleChannelDelete;
    private getSettings;
    private postLog;
}
//# sourceMappingURL=DiscordAuditLogService.d.ts.map