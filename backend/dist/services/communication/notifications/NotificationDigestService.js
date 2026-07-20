"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDigestService = exports.NotificationCategory = exports.DigestStatus = exports.DigestFrequency = void 0;
const logger_1 = require("../../../utils/logger");
var DigestFrequency;
(function (DigestFrequency) {
    DigestFrequency["HOURLY"] = "hourly";
    DigestFrequency["DAILY"] = "daily";
    DigestFrequency["WEEKLY"] = "weekly";
})(DigestFrequency || (exports.DigestFrequency = DigestFrequency = {}));
var DigestStatus;
(function (DigestStatus) {
    DigestStatus["PENDING"] = "pending";
    DigestStatus["SENT"] = "sent";
    DigestStatus["FAILED"] = "failed";
    DigestStatus["EMPTY"] = "empty";
})(DigestStatus || (exports.DigestStatus = DigestStatus = {}));
var NotificationCategory;
(function (NotificationCategory) {
    NotificationCategory["ACTIVITY"] = "activity";
    NotificationCategory["FLEET"] = "fleet";
    NotificationCategory["ORGANIZATION"] = "organization";
    NotificationCategory["TRADE"] = "trade";
    NotificationCategory["EVENT"] = "event";
    NotificationCategory["SOCIAL"] = "social";
    NotificationCategory["SECURITY"] = "security";
    NotificationCategory["SYSTEM"] = "system";
    NotificationCategory["OTHER"] = "other";
})(NotificationCategory || (exports.NotificationCategory = NotificationCategory = {}));
class NotificationDigestService {
    pendingNotifications = new Map();
    userPreferences = new Map();
    digests = new Map();
    idCounter = 0;
    constructor() {
        logger_1.logger.info('NotificationDigestService initialized');
    }
    generateId(prefix) {
        this.idCounter++;
        return `${prefix}_${Date.now()}_${this.idCounter}`;
    }
    async queueNotification(notification) {
        const digestNotification = {
            id: this.generateId('notif'),
            ...notification
        };
        const preferences = this.userPreferences.get(notification.userId);
        if (preferences && !preferences.enabled) {
            logger_1.logger.debug(`Digest disabled for user ${notification.userId}, not queueing notification`);
            throw new Error('Digest is disabled for this user');
        }
        if (preferences &&
            preferences.excludeHighImportance &&
            notification.importance === 'high') {
            logger_1.logger.debug(`High importance notification excluded from digest for user ${notification.userId}`);
            throw new Error('High importance notifications are excluded from digest');
        }
        if (preferences &&
            preferences.categories.length > 0 &&
            !preferences.categories.includes(notification.category)) {
            logger_1.logger.debug(`Category ${notification.category} excluded from digest for user ${notification.userId}`);
            throw new Error(`Category ${notification.category} is excluded from digest`);
        }
        const userNotifications = this.pendingNotifications.get(notification.userId) || [];
        userNotifications.push(digestNotification);
        this.pendingNotifications.set(notification.userId, userNotifications);
        logger_1.logger.info(`Queued notification ${digestNotification.id} for user ${notification.userId}`);
        return digestNotification;
    }
    async setUserPreferences(preferences) {
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
        logger_1.logger.info(`Set digest preferences for user ${preferences.userId}`);
        return preferences;
    }
    async getUserPreferences(userId) {
        return this.userPreferences.get(userId) || null;
    }
    async deleteUserPreferences(userId) {
        const existed = this.userPreferences.has(userId);
        this.userPreferences.delete(userId);
        return existed;
    }
    async getPendingNotifications(userId) {
        return this.pendingNotifications.get(userId) || [];
    }
    async generateDigest(userId, frequency, periodStart, periodEnd, organizationId) {
        let notifications = this.pendingNotifications.get(userId) || [];
        notifications = notifications.filter(n => {
            const inPeriod = n.timestamp >= periodStart && n.timestamp <= periodEnd;
            const matchOrg = !organizationId || n.organizationId === organizationId;
            return inPeriod && matchOrg;
        });
        const categoryCounts = Object.values(NotificationCategory).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        for (const notification of notifications) {
            categoryCounts[notification.category]++;
        }
        const digest = {
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
        if (notifications.length > 0) {
            const remainingNotifications = (this.pendingNotifications.get(userId) || []).filter(n => !notifications.find(processed => processed.id === n.id));
            this.pendingNotifications.set(userId, remainingNotifications);
        }
        logger_1.logger.info(`Generated digest ${digest.id} for user ${userId} with ${notifications.length} notifications`);
        return digest;
    }
    async getDigest(id) {
        return this.digests.get(id) || null;
    }
    async markDigestAsSent(id) {
        const digest = this.digests.get(id);
        if (!digest) {
            throw new Error('Digest not found');
        }
        digest.status = DigestStatus.SENT;
        digest.sentAt = new Date();
        this.digests.set(id, digest);
        logger_1.logger.info(`Marked digest ${id} as sent`);
        return digest;
    }
    async markDigestAsFailed(id, errorMessage) {
        const digest = this.digests.get(id);
        if (!digest) {
            throw new Error('Digest not found');
        }
        digest.status = DigestStatus.FAILED;
        digest.errorMessage = errorMessage;
        this.digests.set(id, digest);
        logger_1.logger.warn(`Marked digest ${id} as failed: ${errorMessage}`);
        return digest;
    }
    async getUserDigests(userId, limit = 10) {
        const userDigests = Array.from(this.digests.values())
            .filter(d => d.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
        return userDigests;
    }
    getCategorySummary(digest) {
        const summaries = [];
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
        summaries.sort((a, b) => b.count - a.count);
        return summaries;
    }
    formatDigestAsText(digest) {
        if (digest.notifications.length === 0) {
            return 'No notifications in this digest period.';
        }
        const lines = [
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
    formatDigestAsHtml(digest) {
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
    async getStats() {
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
    async getUsersDueForDigest(frequency) {
        const dueUsers = [];
        const entries = Array.from(this.userPreferences.entries());
        for (const [userId, preferences] of entries) {
            if (preferences.enabled && preferences.frequency === frequency) {
                const pending = this.pendingNotifications.get(userId) || [];
                if (pending.length > 0) {
                    dueUsers.push(userId);
                }
            }
        }
        return dueUsers;
    }
    async cleanupOldDigests(olderThanDays = 30) {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        const entries = Array.from(this.digests.entries());
        for (const [id, digest] of entries) {
            if (digest.createdAt < cutoffDate) {
                this.digests.delete(id);
                deletedCount++;
            }
        }
        logger_1.logger.info(`Cleaned up ${deletedCount} old digests`);
        return deletedCount;
    }
    async clearUserPendingNotifications(userId) {
        const pending = this.pendingNotifications.get(userId) || [];
        const count = pending.length;
        this.pendingNotifications.delete(userId);
        return count;
    }
    clearAll() {
        this.pendingNotifications.clear();
        this.userPreferences.clear();
        this.digests.clear();
        this.idCounter = 0;
    }
}
exports.NotificationDigestService = NotificationDigestService;
//# sourceMappingURL=NotificationDigestService.js.map