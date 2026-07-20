export declare class ChangelogWebhookService {
    private static instance;
    private pollInterval;
    private startupRecheckTimer;
    private webhookUrl;
    private enabled;
    private consecutiveRateLimitFailures;
    static getInstance(): ChangelogWebhookService;
    initialize(): void;
    shutdown(): void;
    private getPollIntervalMs;
    private getStartupRecheckMs;
    private runCheckSafely;
    private handleRateLimitedFailure;
    private checkAndPostNewEntries;
    private postMissingEntries;
    private postEntry;
    private buildRateLimitedError;
    private parseRetryAfterMs;
    private computeRateLimitBackoffMs;
    private delay;
    private buildEmbed;
    private buildDescription;
    private getCategoryLabel;
    private getCategoryColor;
    private toIsoTimestamp;
    private limitLength;
    private isDiscordWebhookUrl;
}
//# sourceMappingURL=ChangelogWebhookService.d.ts.map