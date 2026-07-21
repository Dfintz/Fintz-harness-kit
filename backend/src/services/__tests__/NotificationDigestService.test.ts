import {
  NotificationDigestService,
  DigestFrequency,
  DigestStatus,
  NotificationCategory,
} from '../communication/notifications/NotificationDigestService';

// Mock logger
describe('NotificationDigestService', () => {
  let digestService: NotificationDigestService;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const validNotification = {
    userId: 'user-123',
    organizationId: 'org-456',
    category: NotificationCategory.ACTIVITY,
    title: 'New Activity',
    summary: 'You have a new activity to review',
    importance: 'normal' as const,
    timestamp: oneHourAgo,
    actionUrl: 'https://example.com/activity/123',
  };

  const validPreferences = {
    userId: 'user-123',
    enabled: true,
    frequency: DigestFrequency.DAILY,
    channels: ['email' as const, 'discord' as const],
    categories: [NotificationCategory.ACTIVITY, NotificationCategory.FLEET],
    excludeHighImportance: true,
    preferredDeliveryHour: 9,
    timezone: 'America/New_York',
  };

  beforeEach(() => {
    digestService = new NotificationDigestService();
  });

  afterEach(() => {
    digestService.clearAll();
  });

  describe('queueNotification', () => {
    it('should queue a notification for digest', async () => {
      const result = await digestService.queueNotification(validNotification);

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(validNotification.userId);
      expect(result.category).toBe(validNotification.category);
      expect(result.title).toBe(validNotification.title);
    });

    it('should reject notification when digest is disabled for user', async () => {
      await digestService.setUserPreferences({
        ...validPreferences,
        enabled: false,
      });

      await expect(digestService.queueNotification(validNotification)).rejects.toThrow(
        'Digest is disabled for this user'
      );
    });

    it('should reject high importance notification when user excludes them', async () => {
      await digestService.setUserPreferences(validPreferences);

      await expect(
        digestService.queueNotification({
          ...validNotification,
          importance: 'high',
        })
      ).rejects.toThrow('High importance notifications are excluded from digest');
    });

    it('should reject notification when category is excluded', async () => {
      await digestService.setUserPreferences({
        ...validPreferences,
        categories: [NotificationCategory.FLEET], // Only FLEET, not ACTIVITY
      });

      await expect(digestService.queueNotification(validNotification)).rejects.toThrow(
        'Category activity is excluded from digest'
      );
    });
  });

  describe('setUserPreferences', () => {
    it('should set user digest preferences', async () => {
      const result = await digestService.setUserPreferences(validPreferences);

      expect(result.userId).toBe(validPreferences.userId);
      expect(result.enabled).toBe(true);
      expect(result.frequency).toBe(DigestFrequency.DAILY);
    });

    it('should validate preferredDeliveryHour', async () => {
      await expect(
        digestService.setUserPreferences({
          ...validPreferences,
          preferredDeliveryHour: 25,
        })
      ).rejects.toThrow('preferredDeliveryHour must be between 0 and 23');
    });

    it('should validate preferredDeliveryDay', async () => {
      await expect(
        digestService.setUserPreferences({
          ...validPreferences,
          preferredDeliveryDay: 7,
        })
      ).rejects.toThrow('preferredDeliveryDay must be between 0 (Sunday) and 6 (Saturday)');
    });
  });

  describe('getUserPreferences', () => {
    it('should retrieve user preferences', async () => {
      await digestService.setUserPreferences(validPreferences);
      const result = await digestService.getUserPreferences('user-123');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null for non-existent user', async () => {
      const result = await digestService.getUserPreferences('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deleteUserPreferences', () => {
    it('should delete user preferences', async () => {
      await digestService.setUserPreferences(validPreferences);
      const result = await digestService.deleteUserPreferences('user-123');

      expect(result).toBe(true);
      expect(await digestService.getUserPreferences('user-123')).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const result = await digestService.deleteUserPreferences('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getPendingNotifications', () => {
    it('should retrieve pending notifications for a user', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.queueNotification({
        ...validNotification,
        title: 'Second Notification',
      });

      const result = await digestService.getPendingNotifications('user-123');
      expect(result).toHaveLength(2);
    });

    it('should return empty array for user with no pending notifications', async () => {
      const result = await digestService.getPendingNotifications('non-existent');
      expect(result).toHaveLength(0);
    });
  });

  describe('generateDigest', () => {
    it('should generate a digest with pending notifications', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.queueNotification({
        ...validNotification,
        category: NotificationCategory.FLEET,
        title: 'Fleet Update',
      });

      const result = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.totalCount).toBe(2);
      expect(result.status).toBe(DigestStatus.PENDING);
      expect(result.categoryCounts[NotificationCategory.ACTIVITY]).toBe(1);
      expect(result.categoryCounts[NotificationCategory.FLEET]).toBe(1);
    });

    it('should generate empty digest when no notifications', async () => {
      const result = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      expect(result.totalCount).toBe(0);
      expect(result.status).toBe(DigestStatus.EMPTY);
    });

    it('should filter by organization when provided', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.queueNotification({
        ...validNotification,
        organizationId: 'other-org',
        title: 'Other Org Notification',
      });

      const result = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now,
        'org-456'
      );

      expect(result.totalCount).toBe(1);
    });

    it('should remove processed notifications from pending', async () => {
      await digestService.queueNotification(validNotification);

      await digestService.generateDigest('user-123', DigestFrequency.DAILY, oneDayAgo, now);

      const pending = await digestService.getPendingNotifications('user-123');
      expect(pending).toHaveLength(0);
    });
  });

  describe('getDigest', () => {
    it('should retrieve a digest by ID', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const result = await digestService.getDigest(digest.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(digest.id);
    });

    it('should return null for non-existent digest', async () => {
      const result = await digestService.getDigest('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('markDigestAsSent', () => {
    it('should mark digest as sent', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const result = await digestService.markDigestAsSent(digest.id);
      expect(result.status).toBe(DigestStatus.SENT);
      expect(result.sentAt).toBeDefined();
    });

    it('should throw error for non-existent digest', async () => {
      await expect(digestService.markDigestAsSent('non-existent')).rejects.toThrow(
        'Digest not found'
      );
    });
  });

  describe('markDigestAsFailed', () => {
    it('should mark digest as failed', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const result = await digestService.markDigestAsFailed(digest.id, 'Send error');
      expect(result.status).toBe(DigestStatus.FAILED);
      expect(result.errorMessage).toBe('Send error');
    });
  });

  describe('getUserDigests', () => {
    it('should retrieve user digests', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.generateDigest('user-123', DigestFrequency.DAILY, oneDayAgo, now);
      await digestService.queueNotification({
        ...validNotification,
        timestamp: now,
      });
      await digestService.generateDigest('user-123', DigestFrequency.DAILY, oneDayAgo, now);

      const result = await digestService.getUserDigests('user-123');
      expect(result).toHaveLength(2);
    });

    it('should limit results', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.generateDigest('user-123', DigestFrequency.DAILY, oneDayAgo, now);
      await digestService.queueNotification({
        ...validNotification,
        timestamp: now,
      });
      await digestService.generateDigest('user-123', DigestFrequency.DAILY, oneDayAgo, now);

      const result = await digestService.getUserDigests('user-123', 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('getCategorySummary', () => {
    it('should return category summaries sorted by count', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.queueNotification({
        ...validNotification,
        title: 'Second Activity',
      });
      await digestService.queueNotification({
        ...validNotification,
        category: NotificationCategory.FLEET,
        title: 'Fleet Notification',
      });

      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const summaries = digestService.getCategorySummary(digest);

      expect(summaries).toHaveLength(2);
      expect(summaries[0].category).toBe(NotificationCategory.ACTIVITY);
      expect(summaries[0].count).toBe(2);
      expect(summaries[1].category).toBe(NotificationCategory.FLEET);
      expect(summaries[1].count).toBe(1);
    });
  });

  describe('formatDigestAsText', () => {
    it('should format digest as plain text', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const text = digestService.formatDigestAsText(digest);

      expect(text).toContain('Notification Digest');
      expect(text).toContain('ACTIVITY');
      expect(text).toContain(validNotification.title);
      expect(text).toContain(validNotification.summary);
    });

    it('should handle empty digest', async () => {
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const text = digestService.formatDigestAsText(digest);
      expect(text).toContain('No notifications in this digest period');
    });
  });

  describe('formatDigestAsHtml', () => {
    it('should format digest as HTML', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const html = digestService.formatDigestAsHtml(digest);

      expect(html).toContain('<html>');
      expect(html).toContain('Notification Digest');
      expect(html).toContain('ACTIVITY');
      expect(html).toContain(validNotification.title);
    });

    it('should handle empty digest', async () => {
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      const html = digestService.formatDigestAsHtml(digest);
      expect(html).toContain('No notifications in this digest period');
    });
  });

  describe('getStats', () => {
    it('should return digest statistics', async () => {
      await digestService.setUserPreferences(validPreferences);
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );
      await digestService.markDigestAsSent(digest.id);

      const stats = await digestService.getStats();

      expect(stats.totalDigests).toBe(1);
      expect(stats.sentDigests).toBe(1);
      expect(stats.pendingDigests).toBe(0);
      expect(stats.userPreferencesCount).toBe(1);
    });
  });

  describe('getUsersDueForDigest', () => {
    it('should return users due for digest', async () => {
      await digestService.setUserPreferences(validPreferences);
      await digestService.queueNotification(validNotification);

      const users = await digestService.getUsersDueForDigest(DigestFrequency.DAILY);
      expect(users).toContain('user-123');
    });

    it('should not return users with different frequency', async () => {
      await digestService.setUserPreferences({
        ...validPreferences,
        frequency: DigestFrequency.WEEKLY,
      });
      await digestService.queueNotification(validNotification);

      const users = await digestService.getUsersDueForDigest(DigestFrequency.DAILY);
      expect(users).not.toContain('user-123');
    });

    it('should not return users with no pending notifications', async () => {
      await digestService.setUserPreferences(validPreferences);

      const users = await digestService.getUsersDueForDigest(DigestFrequency.DAILY);
      expect(users).not.toContain('user-123');
    });
  });

  describe('cleanupOldDigests', () => {
    it('should delete old digests', async () => {
      await digestService.queueNotification(validNotification);
      const digest = await digestService.generateDigest(
        'user-123',
        DigestFrequency.DAILY,
        oneDayAgo,
        now
      );

      // Manually set the createdAt to the past
      const storedDigest = await digestService.getDigest(digest.id);
      if (storedDigest) {
        storedDigest.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      const deletedCount = await digestService.cleanupOldDigests(30);
      expect(deletedCount).toBe(1);
    });
  });

  describe('clearUserPendingNotifications', () => {
    it('should clear all pending notifications for a user', async () => {
      await digestService.queueNotification(validNotification);
      await digestService.queueNotification({
        ...validNotification,
        title: 'Second Notification',
      });

      const clearedCount = await digestService.clearUserPendingNotifications('user-123');
      expect(clearedCount).toBe(2);

      const pending = await digestService.getPendingNotifications('user-123');
      expect(pending).toHaveLength(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

