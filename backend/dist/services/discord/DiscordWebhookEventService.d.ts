export declare class DiscordWebhookEventService {
    private static instance;
    private readonly guildOrgService;
    private readonly settingsService;
    private constructor();
    static getInstance(): DiscordWebhookEventService;
    handleEvent(rawPayload: unknown): Promise<void>;
    private handleApplicationAuthorized;
    private handleApplicationDeauthorized;
}
//# sourceMappingURL=DiscordWebhookEventService.d.ts.map