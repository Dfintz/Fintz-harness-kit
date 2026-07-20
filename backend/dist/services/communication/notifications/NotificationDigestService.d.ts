export type DigestChannel = 'discord' | 'email' | 'in_app';
export declare enum DigestFrequency {
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly"
}
export declare enum DigestStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed",
    EMPTY = "empty"
}
export declare enum NotificationCategory {
    ACTIVITY = "activity",
    FLEET = "fleet",
    ORGANIZATION = "organization",
    TRADE = "trade",
    EVENT = "event",
    SOCIAL = "social",
    SECURITY = "security",
    SYSTEM = "system",
    OTHER = "other"
}
export interface DigestNotification {
    id: string;
    userId: string;
    organizationId?: string;
    category: NotificationCategory;
    title: string;
    summary: string;
    importance: 'low' | 'normal' | 'high';
    timestamp: Date;
    metadata?: Record<string, unknown>;
    actionUrl?: string;
}
export interface UserDigestPreferences {
    userId: string;
    enabled: boolean;
    frequency: DigestFrequency;
    channels: DigestChannel[];
    categories: NotificationCategory[];
    excludeHighImportance: boolean;
    preferredDeliveryHour?: number;
    preferredDeliveryDay?: number;
    timezone?: string;
}
export interface NotificationDigest {
    id: string;
    userId: string;
    organizationId?: string;
    frequency: DigestFrequency;
    periodStart: Date;
    periodEnd: Date;
    notifications: DigestNotification[];
    categoryCounts: Record<NotificationCategory, number>;
    totalCount: number;
    status: DigestStatus;
    createdAt: Date;
    sentAt?: Date;
    errorMessage?: string;
}
export interface DigestCategorySummary {
    category: NotificationCategory;
    count: number;
    notifications: DigestNotification[];
}
export interface DigestStats {
    totalDigests: number;
    pendingDigests: number;
    sentDigests: number;
    failedDigests: number;
    emptyDigests: number;
    averageNotificationsPerDigest: number;
    userPreferencesCount: number;
}
export declare class NotificationDigestService {
    private pendingNotifications;
    private userPreferences;
    private digests;
    private idCounter;
    constructor();
    private generateId;
    queueNotification(notification: Omit<DigestNotification, 'id'>): Promise<DigestNotification>;
    setUserPreferences(preferences: UserDigestPreferences): Promise<UserDigestPreferences>;
    getUserPreferences(userId: string): Promise<UserDigestPreferences | null>;
    deleteUserPreferences(userId: string): Promise<boolean>;
    getPendingNotifications(userId: string): Promise<DigestNotification[]>;
    generateDigest(userId: string, frequency: DigestFrequency, periodStart: Date, periodEnd: Date, organizationId?: string): Promise<NotificationDigest>;
    getDigest(id: string): Promise<NotificationDigest | null>;
    markDigestAsSent(id: string): Promise<NotificationDigest>;
    markDigestAsFailed(id: string, errorMessage: string): Promise<NotificationDigest>;
    getUserDigests(userId: string, limit?: number): Promise<NotificationDigest[]>;
    getCategorySummary(digest: NotificationDigest): DigestCategorySummary[];
    formatDigestAsText(digest: NotificationDigest): string;
    formatDigestAsHtml(digest: NotificationDigest): string;
    getStats(): Promise<DigestStats>;
    getUsersDueForDigest(frequency: DigestFrequency): Promise<string[]>;
    cleanupOldDigests(olderThanDays?: number): Promise<number>;
    clearUserPendingNotifications(userId: string): Promise<number>;
    clearAll(): void;
}
//# sourceMappingURL=NotificationDigestService.d.ts.map