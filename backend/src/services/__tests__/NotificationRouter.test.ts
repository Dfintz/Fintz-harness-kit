import { NotificationPriority, NotificationType } from '../../models/Notification';

// Mock websocketServer before any imports
const mockEmitToUser = jest.fn();
const mockEmitToOrganization = jest.fn();
jest.mock('../../websocket/websocketServer', () => ({
  emitToUser: mockEmitToUser,
  emitToOrganization: mockEmitToOrganization,
}));

import { NotificationPreferencesService } from '../communication/notifications/NotificationPreferencesService';
import type {
  RouteNotificationInput,
  RouteOrgNotificationInput,
} from '../communication/notifications/NotificationRouter';
import {
  NotificationContext,
  NotificationRouter,
} from '../communication/notifications/NotificationRouter';
import { NotificationService } from '../communication/notifications/NotificationService';

describe('NotificationRouter', () => {
  let router: NotificationRouter;
  let mockNotificationService: jest.Mocked<Partial<NotificationService>>;
  let mockPreferencesService: jest.Mocked<Partial<NotificationPreferencesService>>;

  const defaultInput: RouteNotificationInput = {
    context: NotificationContext.ACTIVITY_COMPLETED,
    userId: 'user-123',
    title: 'Activity Complete',
    message: 'Your mining expedition has completed.',
    senderId: 'sender-456',
    actionUrl: '/activities/act-789',
    metadata: { activityId: 'act-789' },
    priority: NotificationPriority.NORMAL,
  };

  const orgInput: RouteOrgNotificationInput = {
    context: NotificationContext.ORG_MEMBER_JOINED,
    organizationId: 'org-001',
    title: 'New Member',
    message: 'A new member has joined the organization.',
    senderId: 'user-new',
    actionUrl: '/org/members',
    metadata: { memberId: 'user-new' },
    priority: NotificationPriority.LOW,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockNotificationService = {
      create: jest.fn().mockResolvedValue({
        success: true,
        channel: 'in-app',
        recipientCount: 1,
        notificationId: 'notif-001',
      }),
      sendDiscordNotification: jest.fn().mockResolvedValue(undefined),
    };

    mockPreferencesService = {
      shouldDeliver: jest.fn().mockResolvedValue(true),
    };

    router = new NotificationRouter(
      mockNotificationService as unknown as NotificationService,
      mockPreferencesService as unknown as NotificationPreferencesService
    );
  });

  // ── notifyUser ─────────────────────────────────────────────────────

  describe('notifyUser', () => {
    it('should deliver to all channels when preferences allow', async () => {
      const result = await router.notifyUser(defaultInput);

      expect(result.delivered).toContain('inApp');
      expect(result.delivered).toContain('websocket');
      expect(result.delivered).toContain('discord');
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.notificationId).toBe('notif-001');
    });

    it('should persist the notification via NotificationService.create', async () => {
      await router.notifyUser(defaultInput);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: NotificationType.ACTIVITY_COMPLETED,
          title: 'Activity Complete',
          message: 'Your mining expedition has completed.',
          senderId: 'sender-456',
          priority: NotificationPriority.NORMAL,
          data: expect.objectContaining({
            context: NotificationContext.ACTIVITY_COMPLETED,
            actionUrl: '/activities/act-789',
            activityId: 'act-789',
          }),
        })
      );
    });

    it('should emit a websocket event with correct payload', async () => {
      await router.notifyUser(defaultInput);

      expect(mockEmitToUser).toHaveBeenCalledWith(
        'user-123',
        'notification:new',
        expect.objectContaining({
          id: 'notif-001',
          type: 'success', // ACTIVITY_COMPLETED → success
          title: 'Activity Complete',
          message: 'Your mining expedition has completed.',
          category: 'activity',
          read: false,
          actionUrl: '/activities/act-789',
        })
      );
    });

    it('should call sendDiscordNotification with NotificationMessage format', async () => {
      await router.notifyUser(defaultInput);

      expect(mockNotificationService.sendDiscordNotification).toHaveBeenCalledWith({
        subject: 'Activity Complete',
        body: 'Your mining expedition has completed.',
      });
    });

    it('should skip all channels when inApp preference is false', async () => {
      // inApp=false ⇒ inApp + websocket skipped; discord is checked separately
      (mockPreferencesService.shouldDeliver as jest.Mock).mockImplementation(
        async (_uid: string, channel: string) => {
          if (channel === 'inApp') return false;
          if (channel === 'discord') return false;
          return true;
        }
      );

      const result = await router.notifyUser(defaultInput);

      expect(result.skipped).toContain('inApp');
      expect(result.skipped).toContain('websocket');
      expect(result.skipped).toContain('discord');
      expect(result.delivered).toHaveLength(0);
      expect(mockNotificationService.create).not.toHaveBeenCalled();
      expect(mockEmitToUser).not.toHaveBeenCalled();
    });

    it('should skip only discord when discord preference is false', async () => {
      (mockPreferencesService.shouldDeliver as jest.Mock).mockImplementation(
        async (_uid: string, channel: string) => {
          return channel !== 'discord';
        }
      );

      const result = await router.notifyUser(defaultInput);

      expect(result.delivered).toContain('inApp');
      expect(result.delivered).toContain('websocket');
      expect(result.skipped).toContain('discord');
      expect(mockNotificationService.sendDiscordNotification).not.toHaveBeenCalled();
    });

    it('should handle in-app persistence failure gracefully', async () => {
      (mockNotificationService.create as jest.Mock).mockRejectedValue(
        new Error('DB connection lost')
      );

      const result = await router.notifyUser(defaultInput);

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('inApp: DB connection lost')])
      );
      // WebSocket should still fire (uses shouldInApp flag, which is true)
      expect(mockEmitToUser).toHaveBeenCalled();
      expect(result.delivered).toContain('websocket');
    });

    it('should handle websocket emission failure gracefully', async () => {
      mockEmitToUser.mockImplementation(() => {
        throw new Error('Socket not initialized');
      });

      const result = await router.notifyUser(defaultInput);

      // in-app still persisted
      expect(result.delivered).toContain('inApp');
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('websocket: Socket not initialized')])
      );
    });

    it('should silently skip discord when sendDiscordNotification throws', async () => {
      (mockNotificationService.sendDiscordNotification as jest.Mock).mockRejectedValue(
        new Error('Discord client not configured')
      );

      const result = await router.notifyUser(defaultInput);

      // Discord failure goes to skipped, not errors (best-effort)
      expect(result.skipped).toContain('discord');
      expect(result.delivered).toContain('inApp');
      expect(result.delivered).toContain('websocket');
    });

    it('should default to delivering when preference check throws (fail-open)', async () => {
      (mockPreferencesService.shouldDeliver as jest.Mock).mockRejectedValue(
        new Error('Redis unavailable')
      );

      const result = await router.notifyUser(defaultInput);

      // Should still deliver to all channels because fail-open
      expect(result.delivered).toContain('inApp');
      expect(result.delivered).toContain('websocket');
    });

    it('should use NORMAL priority when none specified', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.TEAM_JOINED,
        userId: 'user-123',
        title: 'Team Joined',
        message: 'You joined a team',
      };

      await router.notifyUser(input);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.NORMAL,
          senderId: undefined,
        })
      );
    });

    it('should use a generated UUID for websocket when no notificationId', async () => {
      (mockNotificationService.create as jest.Mock).mockResolvedValue({
        success: true,
        channel: 'in-app',
        recipientCount: 1,
      });

      await router.notifyUser(defaultInput);

      const wsPayload = mockEmitToUser.mock.calls[0]?.[2];
      expect(wsPayload.id).toBeDefined();
      expect(typeof wsPayload.id).toBe('string');
    });
  });

  // ── notifyOrganization ──────────────────────────────────────────────

  describe('notifyOrganization', () => {
    it('should broadcast via websocket', () => {
      const result = router.notifyOrganization(orgInput);

      expect(result.delivered).toContain('websocket');
      expect(result.errors).toHaveLength(0);
      expect(mockEmitToOrganization).toHaveBeenCalledWith(
        'org-001',
        'notification:new',
        expect.objectContaining({
          type: 'info', // ORG_MEMBER_JOINED → INFO → 'info'
          title: 'New Member',
          message: 'A new member has joined the organization.',
          category: 'organization',
          read: false,
          actionUrl: '/org/members',
        })
      );
    });

    it('should not persist in-app notifications for org broadcasts', () => {
      router.notifyOrganization(orgInput);

      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('should handle websocket broadcast failure', () => {
      mockEmitToOrganization.mockImplementation(() => {
        throw new Error('WebSocket server down');
      });

      const result = router.notifyOrganization(orgInput);

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('websocket: WebSocket server down')])
      );
      expect(result.delivered).toHaveLength(0);
    });
  });

  // ── Context mapping helpers ──────────────────────────────────────────

  describe('getCategoryForContext', () => {
    const contextCategoryMap: Array<[NotificationContext, string]> = [
      [NotificationContext.TEAM_JOINED, 'organization'],
      [NotificationContext.ACTIVITY_COMPLETED, 'activity'],
      [NotificationContext.LFG_SESSION_STARTED, 'social'],
      [NotificationContext.APPLICATION_RECEIVED, 'activity'],
      [NotificationContext.FLEET_CREATED, 'fleet'],
      [NotificationContext.TRADE_OPERATION_CREATED, 'trade'],
      [NotificationContext.BOUNTY_CLAIMED, 'security'],
      [NotificationContext.ORG_MEMBER_JOINED, 'organization'],
      [NotificationContext.SYSTEM_ANNOUNCEMENT, 'system'],
      [NotificationContext.SECURITY_ALERT, 'system'],
    ];

    it.each(contextCategoryMap)('should map %s to category "%s"', (context, expectedCategory) => {
      expect(router.getCategoryForContext(context)).toBe(expectedCategory);
    });
  });

  describe('getTypeForContext', () => {
    const contextTypeMap: Array<[NotificationContext, NotificationType]> = [
      [NotificationContext.ACTIVITY_COMPLETED, NotificationType.ACTIVITY_COMPLETED],
      [NotificationContext.ACTIVITY_CANCELLED, NotificationType.ACTIVITY_CANCELLED],
      [NotificationContext.ACTIVITY_INVITATION, NotificationType.ACTIVITY_INVITATION],
      [NotificationContext.FLEET_CREATED, NotificationType.FLEET_CREATED],
      [NotificationContext.FLEET_DEPLOYED, NotificationType.FLEET_DEPLOYED],
      [NotificationContext.FLEET_DISSOLVED, NotificationType.FLEET_DISSOLVED],
      [NotificationContext.TRADE_OPERATION_CREATED, NotificationType.TRADE_OPERATION_CREATED],
      [NotificationContext.ROUTE_STATUS_CHANGED, NotificationType.ROUTE_STATUS_CHANGED],
      [NotificationContext.SYSTEM_ANNOUNCEMENT, NotificationType.ANNOUNCEMENT],
      [NotificationContext.SECURITY_ALERT, NotificationType.ERROR],
      [NotificationContext.TEAM_JOINED, NotificationType.INFO],
      [NotificationContext.BOUNTY_COMPLETED, NotificationType.SUCCESS],
      [NotificationContext.JOB_LISTING_EXPIRED, NotificationType.WARNING],
    ];

    it.each(contextTypeMap)('should map %s to type %s', (context, expectedType) => {
      expect(router.getTypeForContext(context)).toBe(expectedType);
    });
  });

  // ── WebSocket type mapping ─────────────────────────────────────────

  describe('websocket type mapping', () => {
    it('should map ERROR context to "error" ws type', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.SECURITY_ALERT,
        userId: 'user-123',
        title: 'Alert',
        message: 'Security alert',
      };

      await router.notifyUser(input);

      const wsPayload = mockEmitToUser.mock.calls[0]?.[2];
      expect(wsPayload.type).toBe('error');
    });

    it('should map WARNING context to "warning" ws type', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.ACTIVITY_REMINDER,
        userId: 'user-123',
        title: 'Reminder',
        message: 'Activity starting soon',
      };

      await router.notifyUser(input);

      const wsPayload = mockEmitToUser.mock.calls[0]?.[2];
      expect(wsPayload.type).toBe('warning');
    });

    it('should map SUCCESS-type contexts to "success" ws type', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.FLEET_DEPLOYED,
        userId: 'user-123',
        title: 'Fleet Deployed',
        message: 'Fleet is live',
      };

      await router.notifyUser(input);

      const wsPayload = mockEmitToUser.mock.calls[0]?.[2];
      expect(wsPayload.type).toBe('success');
    });

    it('should map INFO-type contexts to "info" ws type', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.TEAM_JOINED,
        userId: 'user-123',
        title: 'Joined',
        message: 'You joined a team',
      };

      await router.notifyUser(input);

      const wsPayload = mockEmitToUser.mock.calls[0]?.[2];
      expect(wsPayload.type).toBe('info');
    });
  });

  // ── Default constructor ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should instantiate with default services when none provided', () => {
      const defaultRouter = new NotificationRouter();
      expect(defaultRouter).toBeDefined();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle input without optional fields', async () => {
      const minimalInput: RouteNotificationInput = {
        context: NotificationContext.SYSTEM_ANNOUNCEMENT,
        userId: 'user-123',
        title: 'System Update',
        message: 'Maintenance window',
      };

      const result = await router.notifyUser(minimalInput);

      expect(result.delivered).toContain('inApp');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: undefined,
          priority: NotificationPriority.NORMAL,
          data: expect.objectContaining({
            context: NotificationContext.SYSTEM_ANNOUNCEMENT,
            actionUrl: undefined,
          }),
        })
      );
    });

    it('should propagate metadata into the data field', async () => {
      const input: RouteNotificationInput = {
        context: NotificationContext.FLEET_CREATED,
        userId: 'user-123',
        title: 'Fleet Created',
        message: 'New fleet',
        metadata: { fleetId: 'f-001', shipCount: 5 },
      };

      await router.notifyUser(input);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fleetId: 'f-001',
            shipCount: 5,
          }),
        })
      );
    });

    it('should check preferences for the correct category per context', async () => {
      const socialInput: RouteNotificationInput = {
        context: NotificationContext.CONTACT_REQUEST_RECEIVED,
        userId: 'user-123',
        title: 'Contact Request',
        message: 'Someone sent you a request',
      };

      await router.notifyUser(socialInput);

      // shouldDeliver should be called with 'social' category
      expect(mockPreferencesService.shouldDeliver).toHaveBeenCalledWith(
        'user-123',
        'inApp',
        'social'
      );
      expect(mockPreferencesService.shouldDeliver).toHaveBeenCalledWith(
        'user-123',
        'discord',
        'social'
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

