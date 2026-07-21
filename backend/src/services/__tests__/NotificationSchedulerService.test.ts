import {
  NotificationSchedulerService,
  ScheduledNotificationStatus,
  ScheduledNotificationPriority,
} from '../communication/notifications/NotificationSchedulerService';

// Mock logger
describe('NotificationSchedulerService', () => {
  let schedulerService: NotificationSchedulerService;

  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const farFutureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  const validNotificationParams = {
    userId: 'user-123',
    organizationId: 'org-456',
    subject: 'Test Notification',
    body: 'This is a test notification body',
    channels: ['email' as const, 'discord' as const],
    scheduledAt: futureDate,
    priority: ScheduledNotificationPriority.NORMAL,
    recipientEmails: ['test@example.com'],
    recipientIds: ['discord-user-id'],
  };

  beforeEach(() => {
    schedulerService = new NotificationSchedulerService();
  });

  afterEach(() => {
    schedulerService.clearAll();
  });

  describe('scheduleNotification', () => {
    it('should schedule a notification for future delivery', async () => {
      const result = await schedulerService.scheduleNotification(validNotificationParams);

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(validNotificationParams.userId);
      expect(result.subject).toBe(validNotificationParams.subject);
      expect(result.body).toBe(validNotificationParams.body);
      expect(result.channels).toEqual(validNotificationParams.channels);
      expect(result.scheduledAt).toEqual(futureDate);
      expect(result.status).toBe(ScheduledNotificationStatus.PENDING);
      expect(result.priority).toBe(ScheduledNotificationPriority.NORMAL);
      expect(result.retryCount).toBe(0);
      expect(result.maxRetries).toBe(3);
    });

    it('should reject scheduling notifications in the past', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000);
      await expect(
        schedulerService.scheduleNotification({
          ...validNotificationParams,
          scheduledAt: pastDate,
        })
      ).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should reject scheduling without user ID', async () => {
      await expect(
        schedulerService.scheduleNotification({
          ...validNotificationParams,
          userId: '',
        })
      ).rejects.toThrow('User ID is required');
    });

    it('should reject scheduling without subject', async () => {
      await expect(
        schedulerService.scheduleNotification({
          ...validNotificationParams,
          subject: '',
        })
      ).rejects.toThrow('Subject and body are required');
    });

    it('should reject scheduling without channels', async () => {
      await expect(
        schedulerService.scheduleNotification({
          ...validNotificationParams,
          channels: [],
        })
      ).rejects.toThrow('At least one notification channel is required');
    });

    it('should default to NORMAL priority if not specified', async () => {
      const result = await schedulerService.scheduleNotification({
        ...validNotificationParams,
        priority: undefined,
      });

      expect(result.priority).toBe(ScheduledNotificationPriority.NORMAL);
    });

    it('should default to 3 max retries if not specified', async () => {
      const result = await schedulerService.scheduleNotification({
        ...validNotificationParams,
        maxRetries: undefined,
      });

      expect(result.maxRetries).toBe(3);
    });
  });

  describe('getScheduledNotification', () => {
    it('should retrieve a scheduled notification by ID', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const result = await schedulerService.getScheduledNotification(scheduled.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(scheduled.id);
    });

    it('should return null for non-existent notification', async () => {
      const result = await schedulerService.getScheduledNotification('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getScheduledNotifications', () => {
    it('should retrieve all scheduled notifications', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        userId: 'user-789',
      });

      const result = await schedulerService.getScheduledNotifications();
      expect(result).toHaveLength(2);
    });

    it('should filter by userId', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        userId: 'user-789',
      });

      const result = await schedulerService.getScheduledNotifications({
        userId: 'user-123',
      });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
    });

    it('should filter by organizationId', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        organizationId: 'org-other',
      });

      const result = await schedulerService.getScheduledNotifications({
        organizationId: 'org-456',
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.cancelScheduledNotification(scheduled.id);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        userId: 'user-789',
      });

      const result = await schedulerService.getScheduledNotifications({
        status: ScheduledNotificationStatus.PENDING,
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by priority', async () => {
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        priority: ScheduledNotificationPriority.HIGH,
      });
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        priority: ScheduledNotificationPriority.LOW,
      });

      const result = await schedulerService.getScheduledNotifications({
        priority: ScheduledNotificationPriority.HIGH,
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by scheduled time range', async () => {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        scheduledAt: farFutureDate,
      });

      const result = await schedulerService.getScheduledNotifications({
        scheduledAfter: now,
        scheduledBefore: twoHoursFromNow,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getDueNotifications', () => {
    it('should return notifications that are due', async () => {
      // Create a notification with a past scheduled time (simulated by manipulating)
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);

      // Manually set the scheduled time to the past
      const notification = await schedulerService.getScheduledNotification(scheduled.id);
      if (notification) {
        notification.scheduledAt = new Date(Date.now() - 60 * 1000);
      }

      const result = await schedulerService.getDueNotifications();
      expect(result).toHaveLength(1);
    });

    it('should not return future notifications', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);

      const result = await schedulerService.getDueNotifications();
      expect(result).toHaveLength(0);
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel a pending notification', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const result = await schedulerService.cancelScheduledNotification(scheduled.id);

      expect(result.status).toBe(ScheduledNotificationStatus.CANCELLED);
    });

    it('should throw error for non-existent notification', async () => {
      await expect(schedulerService.cancelScheduledNotification('non-existent-id')).rejects.toThrow(
        'Scheduled notification not found'
      );
    });

    it('should throw error for already cancelled notification', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.cancelScheduledNotification(scheduled.id);

      await expect(schedulerService.cancelScheduledNotification(scheduled.id)).rejects.toThrow(
        'Cannot cancel notification with status'
      );
    });
  });

  describe('rescheduleNotification', () => {
    it('should reschedule a pending notification', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const result = await schedulerService.rescheduleNotification(scheduled.id, farFutureDate);

      expect(result.scheduledAt).toEqual(farFutureDate);
    });

    it('should throw error for past scheduled time', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const pastDate = new Date(Date.now() - 60 * 1000);

      await expect(schedulerService.rescheduleNotification(scheduled.id, pastDate)).rejects.toThrow(
        'New scheduled time must be in the future'
      );
    });

    it('should throw error for non-pending notification', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.cancelScheduledNotification(scheduled.id);

      await expect(
        schedulerService.rescheduleNotification(scheduled.id, farFutureDate)
      ).rejects.toThrow('Cannot reschedule notification with status');
    });
  });

  describe('markAsSent', () => {
    it('should mark notification as sent', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const result = await schedulerService.markAsSent(scheduled.id);

      expect(result.status).toBe(ScheduledNotificationStatus.SENT);
      expect(result.sentAt).toBeDefined();
    });

    it('should throw error for non-existent notification', async () => {
      await expect(schedulerService.markAsSent('non-existent-id')).rejects.toThrow(
        'Scheduled notification not found'
      );
    });
  });

  describe('markAsFailed', () => {
    it('should increment retry count', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      const result = await schedulerService.markAsFailed(scheduled.id, 'Connection error');

      expect(result.retryCount).toBe(1);
      expect(result.errorMessage).toBe('Connection error');
      expect(result.status).toBe(ScheduledNotificationStatus.PENDING);
    });

    it('should mark as failed after max retries', async () => {
      const scheduled = await schedulerService.scheduleNotification({
        ...validNotificationParams,
        maxRetries: 2,
      });

      await schedulerService.markAsFailed(scheduled.id, 'Error 1');
      const result = await schedulerService.markAsFailed(scheduled.id, 'Error 2');

      expect(result.status).toBe(ScheduledNotificationStatus.FAILED);
    });
  });

  describe('getStats', () => {
    it('should return scheduler statistics', async () => {
      const scheduled1 = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        userId: 'user-789',
      });
      await schedulerService.cancelScheduledNotification(scheduled1.id);

      const stats = await schedulerService.getStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old completed notifications', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.cancelScheduledNotification(scheduled.id);

      // Manually set the updatedAt to the past
      const notification = await schedulerService.getScheduledNotification(scheduled.id);
      if (notification) {
        notification.updatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      const deletedCount = await schedulerService.cleanupOldNotifications(30);
      expect(deletedCount).toBe(1);
    });
  });

  describe('cancelUserNotifications', () => {
    it('should cancel all pending notifications for a user', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        scheduledAt: farFutureDate,
      });
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        userId: 'other-user',
        scheduledAt: farFutureDate,
      });

      const cancelledCount = await schedulerService.cancelUserNotifications('user-123');
      expect(cancelledCount).toBe(2);

      const remaining = await schedulerService.getScheduledNotifications({
        status: ScheduledNotificationStatus.PENDING,
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userId).toBe('other-user');
    });
  });

  describe('cancelOrganizationNotifications', () => {
    it('should cancel all pending notifications for an organization', async () => {
      await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.scheduleNotification({
        ...validNotificationParams,
        organizationId: 'other-org',
        scheduledAt: farFutureDate,
      });

      const cancelledCount = await schedulerService.cancelOrganizationNotifications('org-456');
      expect(cancelledCount).toBe(1);
    });
  });

  describe('getRetryableNotifications', () => {
    it('should return notifications that can be retried', async () => {
      const scheduled = await schedulerService.scheduleNotification(validNotificationParams);
      await schedulerService.markAsFailed(scheduled.id, 'Error');

      const result = await schedulerService.getRetryableNotifications();
      expect(result).toHaveLength(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

