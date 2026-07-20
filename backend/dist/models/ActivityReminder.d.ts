export declare enum ReminderType {
    ONE_DAY_BEFORE = "1_day_before",
    ONE_HOUR_BEFORE = "1_hour_before",
    THIRTY_MINUTES_BEFORE = "30_min_before",
    CUSTOM = "custom"
}
export declare enum ReminderChannel {
    DISCORD = "discord",
    EMAIL = "email",
    BOTH = "both"
}
export declare enum DeliveryStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare class ActivityReminder {
    id: string;
    activityId: string;
    reminderType: ReminderType;
    channel: ReminderChannel;
    scheduledTime: Date;
    deliveryStatus: DeliveryStatus;
    recipientUserIds?: string[];
    recipientEmails?: string[];
    discordChannelId?: string;
    messageTemplate: string;
    messageVariables?: {
        eventTitle?: string;
        eventDate?: string;
        eventLocation?: string;
        timeUntil?: string;
        [key: string]: unknown;
    };
    sentAt?: Date;
    errorMessage?: string;
    retryCount: number;
    lastRetryAt?: Date;
    isEnabled: boolean;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
    isDue(): boolean;
    canRetry(): boolean;
    getFormattedMessage(): string;
}
//# sourceMappingURL=ActivityReminder.d.ts.map