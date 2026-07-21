/**
 * NotificationDigestService
 *
 * Provides notification digest capabilities for bundling multiple notifications
 * into a single digest message. Supports configurable digest frequencies and
 * user preferences for digest delivery.
 */

import { logger } from '../../../utils/logger';

/**
 * Notification channel types (shared with scheduler)
 */
export type DigestChannel = 'discord' | 'email' | 'in_app';

/**
 * Digest frequency options
 */
export enum DigestFrequency {
    HOURLY = 'hourly',
    DAILY = 'daily',
    WEEKLY = 'weekly'
}

/**
 * Digest status
 */
export enum DigestStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    EMPTY = 'empty'  // No notifications to include
}

/**
 * Notification category for grouping
 */
export enum NotificationCategory {
    ACTIVITY = 'activity',
    FLEET = 'fleet',
    ORGANIZATION = 'organization',
    TRADE = 'trade',
    EVENT = 'event',
    SOCIAL = 'social',
    SECURITY = 'security',
    SYSTEM = 'system',
    OTHER = 'other'
}

/**
 * Individual notification to be included in digest
 */
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

/**
 * User digest preferences
 */
export interface UserDigestPreferences {
    userId: string;
    enabled: boolean;
    frequency: DigestFrequency;
    channels: DigestChannel[];
    categories: NotificationCategory[];  // Categories to include in digest
    excludeHighImportance: boolean;  // Send high importance immediately, exclude from digest
    preferredDeliveryHour?: number;  // 0-23, hour of day for daily/weekly digest
    preferredDeliveryDay?: number;   // 0-6, day of week for weekly digest (0 = Sunday)
    timezone?: string;
}

/**
 * Generated digest
 */
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

/**
 * Digest summary by category
 */
export interface DigestCategorySummary {
    category: NotificationCategory;
    count: number;
    notifications: DigestNotification[];
}

/**
 * Digest statistics
 */
export interface DigestStats {
    totalDigests: number;
    pendingDigests: number;
    sentDigests: number;
    failedDigests: number;
    emptyDigests: number;
    averageNotificationsPerDigest: number;
    userPreferencesCount: number;
}

/**
 * NotificationDigestService
 *
 * Manages notification digests with support for:
 * - Queuing notifications for digest inclusion
 * - User digest preferences management
 * - Generating digests based on frequency
 * - Category-based grouping
 * - Delivery tracking
 */
export class NotificationDigestService {
    private pendingNotifications: Map<string, DigestNotification[]> = new Map(); // keyed by userId
    private userPreferences: Map<string, UserDigestPreferences> = new Map();
    private digests: Map<string, NotificationDigest> = new Map();
    private idCounter: number = 0;

    constructor() {
        logger.info('NotificationDigestService initialized');
    }

    /**
     * Generate unique ID
     */
    private generateId(prefix: string): string {
        this.idCounter++;
        return `${prefix}_${Date.now()}_${this.idCounter}`;
    }

    /**
     * Queue a notification for digest inclusion
     */
    async queueNotification(notification: Omit<DigestNotification, 'id'>): Promise<DigestNotification> {
        const digestNotification: DigestNotification = {
            id: this.generateId('notif'),
            ...notification
        };

        // Get user preferences
        const preferences = this.userPreferences.get(notification.userId);

        // If digest is not enabled or category is excluded, skip queueing
        if (preferences && !preferences.enabled) {
            logger.debug(`Digest disabled for user ${notification.userId}, not queueing notification`);
            throw new Error('Digest is disabled for this user');
        }

        // If high importance and user prefers immediate delivery for high importance
        if (
            preferences &&
            preferences.excludeHighImportance &&
            notification.importance === 'high'
        ) {
            logger.debug(`High importance notification excluded from digest for user ${notification.userId}`);
            throw new Error('High importance notifications are excluded from digest');
        }

        // If category is not in user's preferred categories
        if (
            preferences &&
            preferences.categories.length > 0 &&
            !preferences.categories.includes(notification.category)
        ) {
            logger.debug(`Category ${notification.category} excluded from digest for user ${notification.userId}`);
            throw new Error(`Category ${notification.category} is excluded from digest`);
        }

        // Add to pending notifications
        const userNotifications = this.pendingNotifications.get(notification.userId) || [];
        userNotifications.push(digestNotification);
        this.pendingNotifications.set(notification.userId, userNotifications);

        logger.info(`Queued notification ${digestNotification.id} for user ${notification.userId}`);

        return digestNotification;
    }

    /**
     * Set user digest preferences
     */
    async setUserPreferences(preferences: UserDigestPreferences): Promise<UserDigestPreferences> {
        // Validate preferences
        if (preferences.preferredDeliveryHour !== undefined) {
            if (preferences.preferredDeliveryHour < 0 || preferences.preferredDeliveryHour > 23) {
                throw new Error('preferredDeliveryHour must be between 0 and 23');
            }
        }
        if (preferences.preferredDeliveryDay !== undefined) {
            if (preferences.preferredDeliveryDay < 0 || preferences.preferredDeliveryDay > 6) {
                throw new Error('preferredDeliveryDay must be between 0 (Sunday) and 6 (Saturday)');
            }
        }

        this.userPreferences.set(preferences.userId, preferences);
        logger.info(`Set digest preferences for user ${preferences.userId}`);

        return preferences;
    }

    /**
     * Get user digest preferences
     */
    async getUserPreferences(userId: string): Promise<UserDigestPreferences | null> {
        return this.userPreferences.get(userId) || null;
    }

    /**
     * Delete user digest preferences
     */
    async deleteUserPreferences(userId: string): Promise<boolean> {
        const existed = this.userPreferences.has(userId);
        this.userPreferences.delete(userId);
        return existed;
    }

    /**
     * Get pending notifications for a user
     */
    async getPendingNotifications(userId: string): Promise<DigestNotification[]> {
        return this.pendingNotifications.get(userId) || [];
    }

    /**
     * Generate a digest for a user
     */
    async generateDigest(
        userId: string,
        frequency: DigestFrequency,
        periodStart: Date,
        periodEnd: Date,
        organizationId?: string
    ): Promise<NotificationDigest> {
        // Get pending notifications within the period
        let notifications = this.pendingNotifications.get(userId) || [];

        // Filter by period and optionally by organization
        notifications = notifications.filter(n => {
            const inPeriod = n.timestamp >= periodStart && n.timestamp <= periodEnd;
            const matchOrg = !organizationId || n.organizationId === organizationId;
            return inPeriod && matchOrg;
        });

        // Calculate category counts
        const categoryCounts: Record<NotificationCategory, number> = Object.values(NotificationCategory).reduce(
            (acc, cat) => ({ ...acc, [cat]: 0 }),
            {} as Record<NotificationCategory, number>
        );

        for (const notification of notifications) {
            categoryCounts[notification.category]++;
        }

        // Create digest
        const digest: NotificationDigest = {
            id: this.generateId('digest'),
            userId,
            organizationId,
            frequency,
            periodStart,
            periodEnd,
            notifications: [...notifications],
            categoryCounts,
            totalCount: notifications.length,
            status: notifications.length > 0 ? DigestStatus.PENDING : DigestStatus.EMPTY,
            createdAt: new Date()
        };

        this.digests.set(digest.id, digest);

        // Remove processed notifications from pending
        if (notifications.length > 0) {
            const remainingNotifications = (this.pendingNotifications.get(userId) || []).filter(
                n => !notifications.find(processed => processed.id === n.id)
            );
            this.pendingNotifications.set(userId, remainingNotifications);
        }

        logger.info(`Generated digest ${digest.id} for user ${userId} with ${notifications.length} notifications`);

        return digest;
    }

    /**
     * Get digest by ID
     */
    async getDigest(id: string): Promise<NotificationDigest | null> {
        return this.digests.get(id) || null;
    }

    /**
     * Mark a digest as sent
     */
    async markDigestAsSent(id: string): Promise<NotificationDigest> {
        const digest = this.digests.get(id);
        if (!digest) {
            throw new Error('Digest not found');
        }

        digest.status = DigestStatus.SENT;
        digest.sentAt = new Date();
        this.digests.set(id, digest);

        logger.info(`Marked digest ${id} as sent`);

        return digest;
    }

    /**
     * Mark a digest as failed
     */
    async markDigestAsFailed(id: string, errorMessage: string): Promise<NotificationDigest> {
        const digest = this.digests.get(id);
        if (!digest) {
            throw new Error('Digest not found');
        }

        digest.status = DigestStatus.FAILED;
        digest.errorMessage = errorMessage;
        this.digests.set(id, digest);

        logger.warn(`Marked digest ${id} as failed: ${errorMessage}`);

        return digest;
    }

    /**
     * Get user digests
     */
    async getUserDigests(
        userId: string,
        limit: number = 10
    ): Promise<NotificationDigest[]> {
        const userDigests = Array.from(this.digests.values())
            .filter(d => d.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        return userDigests;
    }

    /**
     * Get digest summary by category
     */
    getCategorySummary(digest: NotificationDigest): DigestCategorySummary[] {
        const summaries: DigestCategorySummary[] = [];

        for (const category of Object.values(NotificationCategory)) {
            const categoryNotifications = digest.notifications.filter(n => n.category === category);
            if (categoryNotifications.length > 0) {
                summaries.push({
                    category,
                    count: categoryNotifications.length,
                    notifications: categoryNotifications
                });
            }
        }

        // Sort by count descending
        summaries.sort((a, b) => b.count - a.count);

        return summaries;
    }

    /**
     * Format digest as plain text
     */
    formatDigestAsText(digest: NotificationDigest): string {
        if (digest.notifications.length === 0) {
            return 'No notifications in this digest period.';
        }

        const lines: string[] = [
            `📬 Notification Digest`,
            `Period: ${digest.periodStart.toLocaleDateString()} - ${digest.periodEnd.toLocaleDateString()}`,
            `Total notifications: ${digest.totalCount}`,
            '',
            '---'
        ];

        const summaries = this.getCategorySummary(digest);

        for (const summary of summaries) {
            lines.push('');
            lines.push(`📁 ${summary.category.toUpperCase()} (${summary.count})`);
            lines.push('');

            for (const notification of summary.notifications) {
                const importance = notification.importance === 'high' ? '🔴' :
                    notification.importance === 'normal' ? '🟡' : '🟢';
                lines.push(`  ${importance} ${notification.title}`);
                lines.push(`     ${notification.summary}`);
                if (notification.actionUrl) {
                    lines.push(`     🔗 ${notification.actionUrl}`);
                }
            }
        }

        lines.push('');
        lines.push('---');
        lines.push('This is an automated digest from Star Citizen Fleet Manager.');

        return lines.join('\n');
    }

    /**
     * Format digest as HTML (for email)
     */
    formatDigestAsHtml(digest: NotificationDigest): string {
        if (digest.notifications.length === 0) {
            return `
        <html>
        <body>
            <h1>📬 Notification Digest</h1>
            <p>No notifications in this digest period.</p>
        </body>
        </html>`;
        }

        const summaries = this.getCategorySummary(digest);
        let categoriesHtml = '';

        for (const summary of summaries) {
            let notificationsHtml = '';
            for (const notification of summary.notifications) {
                const importanceColor = notification.importance === 'high' ? '#dc3545' :
                    notification.importance === 'normal' ? '#ffc107' : '#28a745';

                notificationsHtml += `
          <div style="padding: 10px; margin: 5px 0; border-left: 4px solid ${importanceColor}; background: #f8f9fa;">
            <strong>${notification.title}</strong>
            <p style="margin: 5px 0; color: #666;">${notification.summary}</p>
            ${notification.actionUrl ? `<a href="${notification.actionUrl}" style="color: #00d9ff;">View Details</a>` : ''}
          </div>`;
            }

            categoriesHtml += `
        <div style="margin: 20px 0;">
          <h2 style="color: #00d9ff; border-bottom: 2px solid #00d9ff; padding-bottom: 5px;">
            📁 ${summary.category.toUpperCase()} (${summary.count})
          </h2>
          ${notificationsHtml}
        </div>`;
        }

        return `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #00d9ff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📬 Notification Digest</h1>
          <p>Period: ${digest.periodStart.toLocaleDateString()} - ${digest.periodEnd.toLocaleDateString()}</p>
          <p>Total notifications: ${digest.totalCount}</p>
        </div>
        <div class="content">
          ${categoriesHtml}
        </div>
        <div class="footer">
          <p>This is an automated digest from Star Citizen Fleet Manager.</p>
        </div>
      </body>
      </html>`;
    }

    /**
     * Get digest statistics
     */
    async getStats(): Promise<DigestStats> {
        const allDigests = Array.from(this.digests.values());

        const totalNotifications = allDigests.reduce((sum, d) => sum + d.totalCount, 0);
        const sentDigests = allDigests.filter(d => d.status === DigestStatus.SENT);

        return {
            totalDigests: allDigests.length,
            pendingDigests: allDigests.filter(d => d.status === DigestStatus.PENDING).length,
            sentDigests: sentDigests.length,
            failedDigests: allDigests.filter(d => d.status === DigestStatus.FAILED).length,
            emptyDigests: allDigests.filter(d => d.status === DigestStatus.EMPTY).length,
            averageNotificationsPerDigest: sentDigests.length > 0
                ? totalNotifications / sentDigests.length
                : 0,
            userPreferencesCount: this.userPreferences.size
        };
    }

    /**
     * Get users due for digest based on frequency
     */
    async getUsersDueForDigest(frequency: DigestFrequency): Promise<string[]> {
        const dueUsers: string[] = [];

        const entries = Array.from(this.userPreferences.entries());
        for (const [userId, preferences] of entries) {
            if (preferences.enabled && preferences.frequency === frequency) {
                // Check if user has pending notifications
                const pending = this.pendingNotifications.get(userId) || [];
                if (pending.length > 0) {
                    dueUsers.push(userId);
                }
            }
        }

        return dueUsers;
    }

    /**
     * Cleanup old digests
     */
    async cleanupOldDigests(olderThanDays: number = 30): Promise<number> {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        const entries = Array.from(this.digests.entries());
        for (const [id, digest] of entries) {
            if (digest.createdAt < cutoffDate) {
                this.digests.delete(id);
                deletedCount++;
            }
        }

        logger.info(`Cleaned up ${deletedCount} old digests`);
        return deletedCount;
    }

    /**
     * Clear all pending notifications for a user
     */
    async clearUserPendingNotifications(userId: string): Promise<number> {
        const pending = this.pendingNotifications.get(userId) || [];
        const count = pending.length;
        this.pendingNotifications.delete(userId);
        return count;
    }

    /**
     * Clear all data (mainly for testing)
     */
    clearAll(): void {
        this.pendingNotifications.clear();
        this.userPreferences.clear();
        this.digests.clear();
        this.idCounter = 0;
    }
}

