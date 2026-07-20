export declare class FailedDmDelivery {
    id: string;
    recipientDiscordId: string;
    eventType: string;
    guildId?: string | null;
    content?: string | null;
    embedJson: Record<string, unknown>;
    attemptCount: number;
    nextRetryAt: Date;
    lastError?: string | null;
    expiresAt: Date;
    createdAt: Date;
}
//# sourceMappingURL=FailedDmDelivery.d.ts.map