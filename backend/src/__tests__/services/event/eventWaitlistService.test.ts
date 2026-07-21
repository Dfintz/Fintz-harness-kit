/**
 * EventWaitlistService Tests
 *
 * Tests for event waitlist management:
 * - Join/leave waitlist
 * - Automatic promotion when spots open
 * - Priority queue based on join time
 * - Waitlist notifications
 * - Statistics and user queries
 */

jest.mock('../../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { ActivityType } from '../../../models/Activity';
import { ActivityParticipantEntity } from '../../../models/ActivityParticipant';
import { EventWaitlistService, WaitlistStatus } from '../../../services/event/EventWaitlistService';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
function createMockNotificationService() {
  return {
    sendDiscordNotification: jest.fn().mockResolvedValue(undefined),
    createAttendanceConfirmationEmbed: jest.fn(),
  };
}

function createMockActivityRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
}

/**
 * Build a mock Activity entity that passes waitlist validations.
 * The event is full (accepted >= maxParticipants).
 */
function buildFullEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-vanduul-swarm-001',
    title: 'Vanduul Swarm Training',
    activityType: ActivityType.EVENT,
    maxParticipants: 2,
    participants: [
      { userId: 'pilot-alpha', status: 'accepted', role: 'Wing Leader' },
      { userId: 'pilot-bravo', status: 'accepted', role: 'Wingman' },
    ],
    organizationId: 'org-uee-navy',
    ...overrides,
  };
}

function createMockParticipantRepository() {
  const mock = {
    // Default: first call returns 2 (event full), subsequent calls return 0 (user not a participant)
    count: jest.fn().mockImplementation(async (options: { where: Record<string, unknown> }) => {
      // If the query includes a userId filter, it's the "is already a participant" check → 0
      if (options?.where?.userId) return 0;
      // Otherwise it's the accepted count → 2 (event is full for maxParticipants=2)
      return 2;
    }),
  };
  return mock;
}

describe('EventWaitlistService', () => {
  let service: EventWaitlistService;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockActivityRepo: ReturnType<typeof createMockActivityRepository>;
  let mockParticipantRepo: ReturnType<typeof createMockParticipantRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationService = createMockNotificationService();
    mockActivityRepo = createMockActivityRepository();
    mockParticipantRepo = createMockParticipantRepository();

    // Inject mocks via AppDataSource.getRepository — route by entity
    const { AppDataSource } = require('../../../data-source');
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === ActivityParticipantEntity) return mockParticipantRepo;
      return mockActivityRepo;
    });

    service = new EventWaitlistService(mockNotificationService as any);
  });

  // ------------------------------------------------------------------
  // joinWaitlist
  // ------------------------------------------------------------------
  describe('joinWaitlist', () => {
    it('should add a user to the waitlist when event is full', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildFullEvent());

      const entry = await service.joinWaitlist(
        'event-vanduul-swarm-001',
        'pilot-charlie',
        'org-uee-navy',
        'Ready as backup'
      );

      expect(entry).toBeDefined();
      expect(entry.userId).toBe('pilot-charlie');
      expect(entry.eventId).toBe('event-vanduul-swarm-001');
      expect(entry.position).toBe(1);
      expect(entry.status).toBe(WaitlistStatus.WAITING);
      expect(entry.notes).toBe('Ready as backup');
      expect(entry.notificationSent).toBe(false);
      expect(mockNotificationService.sendDiscordNotification).toHaveBeenCalled();
    });

    it('should throw if event not found', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.joinWaitlist('missing-event', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toThrow('Event not found');
      await expect(
        service.joinWaitlist('missing-event', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
    });

    it('should throw if activity is not EVENT type', async () => {
      mockActivityRepo.findOne.mockResolvedValue(
        buildFullEvent({ activityType: ActivityType.MISSION })
      );

      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toThrow('Waitlists are only available for EVENT type activities');
      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
    });

    it('should throw if event is not full', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildFullEvent({ maxParticipants: 10 }));

      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toThrow('Event is not full - user should join directly');
      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toMatchObject({ name: 'ConflictError', statusCode: 409 });
    });

    it('should throw if user is already on the waitlist', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');

      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toThrow('User is already on the waitlist');
      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy')
      ).rejects.toMatchObject({ name: 'ConflictError', statusCode: 409 });
    });

    it('should throw if user is already a participant', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildFullEvent());
      // Override: return 1 for participant check (user IS a participant)
      mockParticipantRepo.count.mockImplementation(
        async (options: { where: Record<string, unknown> }) => {
          if (options?.where?.userId) return 1; // user found in participants
          return 2; // event is full
        }
      );

      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-alpha', 'org-uee-navy')
      ).rejects.toThrow('User is already a participant');
      await expect(
        service.joinWaitlist('event-vanduul-swarm-001', 'pilot-alpha', 'org-uee-navy')
      ).rejects.toMatchObject({ name: 'ConflictError', statusCode: 409 });
    });

    it('should assign sequential positions for multiple waitlisted users', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      const entry1 = await service.joinWaitlist(
        'event-vanduul-swarm-001',
        'pilot-charlie',
        'org-uee-navy'
      );
      const entry2 = await service.joinWaitlist(
        'event-vanduul-swarm-001',
        'pilot-delta',
        'org-uee-navy'
      );

      expect(entry1.position).toBe(1);
      expect(entry2.position).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // leaveWaitlist
  // ------------------------------------------------------------------
  describe('leaveWaitlist', () => {
    it('should remove user from waitlist and return true', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');

      const result = await service.leaveWaitlist('event-vanduul-swarm-001', 'pilot-charlie');

      expect(result).toBe(true);
      expect(service.getWaitlist('event-vanduul-swarm-001')).toHaveLength(0);
    });

    it('should return false if event has no waitlist', async () => {
      const result = await service.leaveWaitlist('nonexistent-event', 'pilot-charlie');
      expect(result).toBe(false);
    });

    it('should return false if user is not on the waitlist', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');

      const result = await service.leaveWaitlist('event-vanduul-swarm-001', 'pilot-unknown');
      expect(result).toBe(false);
    });

    it('should recalculate positions after a user leaves', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-echo', 'org-uee-navy');

      await service.leaveWaitlist('event-vanduul-swarm-001', 'pilot-charlie');

      const waitlist = service.getWaitlist('event-vanduul-swarm-001');
      expect(waitlist).toHaveLength(2);
      expect(waitlist[0].userId).toBe('pilot-delta');
      expect(waitlist[0].position).toBe(1);
      expect(waitlist[1].userId).toBe('pilot-echo');
      expect(waitlist[1].position).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // getWaitlist / getWaitlistEntry / getWaitlistPosition
  // ------------------------------------------------------------------
  describe('getWaitlist', () => {
    it('should return empty array for unknown event', () => {
      expect(service.getWaitlist('unknown')).toEqual([]);
    });

    it('should return only waiting entries sorted by position', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');

      const waitlist = service.getWaitlist('event-vanduul-swarm-001');
      expect(waitlist).toHaveLength(2);
      expect(waitlist[0].position).toBeLessThan(waitlist[1].position);
    });
  });

  describe('getWaitlistEntry', () => {
    it('should return undefined for unknown event', () => {
      expect(service.getWaitlistEntry('unknown', 'pilot-charlie')).toBeUndefined();
    });
  });

  describe('getWaitlistPosition', () => {
    it('should return null when user not on waitlist', () => {
      expect(service.getWaitlistPosition('unknown', 'pilot-charlie')).toBeNull();
    });

    it('should return correct position for waiting user', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');

      expect(service.getWaitlistPosition('event-vanduul-swarm-001', 'pilot-delta')).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // promoteFromWaitlist
  // ------------------------------------------------------------------
  describe('promoteFromWaitlist', () => {
    it('should promote the first user when a spot opens', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');

      const result = await service.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      expect(result.promoted).toHaveLength(1);
      expect(result.promoted[0].userId).toBe('pilot-charlie');
      expect(result.promoted[0].status).toBe(WaitlistStatus.PROMOTED);
      expect(result.promoted[0].promotedAt).toBeDefined();
      expect(result.promoted[0].expiresAt).toBeDefined();
      expect(result.notified).toBe(1);
      expect(result.remainingWaitlist).toBe(1);
    });

    it('should return empty result when no waitlist exists', async () => {
      mockActivityRepo.findOne.mockResolvedValue(buildFullEvent());

      const result = await service.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      expect(result.promoted).toHaveLength(0);
      expect(result.notified).toBe(0);
      expect(result.remainingWaitlist).toBe(0);
    });

    it('should throw if event not found during promotion', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(service.promoteFromWaitlist('missing-event', 1)).rejects.toThrow(
        'Event not found'
      );
      await expect(service.promoteFromWaitlist('missing-event', 1)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('should promote multiple users when multiple spots open', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-echo', 'org-uee-navy');

      const result = await service.promoteFromWaitlist('event-vanduul-swarm-001', 2);

      expect(result.promoted).toHaveLength(2);
      expect(result.promoted[0].userId).toBe('pilot-charlie');
      expect(result.promoted[1].userId).toBe('pilot-delta');
      expect(result.remainingWaitlist).toBe(1);
    });

    it('should still count notified=0 when notification fails', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      mockNotificationService.sendDiscordNotification
        .mockResolvedValueOnce(undefined) // joinWaitlist notification
        .mockRejectedValueOnce(new Error('Discord unavailable')); // promotion notification

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');

      const result = await service.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      expect(result.promoted).toHaveLength(1);
      expect(result.notified).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // confirmPromotion
  // ------------------------------------------------------------------
  describe('confirmPromotion', () => {
    it('should confirm promotion for promoted user', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      const confirmed = await service.confirmPromotion('event-vanduul-swarm-001', 'pilot-charlie');
      expect(confirmed).toBe(true);
    });

    it('should return false if user is not promoted', async () => {
      const confirmed = await service.confirmPromotion('event-vanduul-swarm-001', 'pilot-unknown');
      expect(confirmed).toBe(false);
    });

    it('should return false and expire if promotion has expired', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      // Use very short expiration
      const shortExpService = new EventWaitlistService(mockNotificationService as any, {
        promotionExpirationMs: 1,
      });

      await shortExpService.joinWaitlist(
        'event-vanduul-swarm-001',
        'pilot-charlie',
        'org-uee-navy'
      );
      await shortExpService.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      // Wait for expiration
      await new Promise(r => setTimeout(r, 10));

      const confirmed = await shortExpService.confirmPromotion(
        'event-vanduul-swarm-001',
        'pilot-charlie'
      );
      expect(confirmed).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // expireUnconfirmedPromotions
  // ------------------------------------------------------------------
  describe('expireUnconfirmedPromotions', () => {
    it('should return 0 when no waitlist exists', async () => {
      const count = await service.expireUnconfirmedPromotions('unknown-event');
      expect(count).toBe(0);
    });

    it('should expire promoted entries past their expiration', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      const shortExpService = new EventWaitlistService(mockNotificationService as any, {
        promotionExpirationMs: 1,
      });

      await shortExpService.joinWaitlist(
        'event-vanduul-swarm-001',
        'pilot-charlie',
        'org-uee-navy'
      );
      await shortExpService.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');
      await shortExpService.promoteFromWaitlist('event-vanduul-swarm-001', 1);

      await new Promise(r => setTimeout(r, 10));

      const expiredCount =
        await shortExpService.expireUnconfirmedPromotions('event-vanduul-swarm-001');
      expect(expiredCount).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // getWaitlistStats
  // ------------------------------------------------------------------
  describe('getWaitlistStats', () => {
    it('should return zeroed stats for unknown event', () => {
      const stats = service.getWaitlistStats('unknown-event');

      expect(stats.totalWaiting).toBe(0);
      expect(stats.totalPromoted).toBe(0);
      expect(stats.totalExpired).toBe(0);
      expect(stats.totalCancelled).toBe(0);
      expect(stats.averageWaitTime).toBe(0);
      expect(stats.longestWaitTime).toBe(0);
    });

    it('should calculate correct stats after joins and cancellations', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');
      await service.leaveWaitlist('event-vanduul-swarm-001', 'pilot-delta');

      const stats = service.getWaitlistStats('event-vanduul-swarm-001');

      expect(stats.totalWaiting).toBe(1);
      expect(stats.totalCancelled).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // getUserWaitlistEntries
  // ------------------------------------------------------------------
  describe('getUserWaitlistEntries', () => {
    it('should return empty array when user has no entries', () => {
      expect(service.getUserWaitlistEntries('pilot-nobody')).toEqual([]);
    });

    it('should return entries across multiple events', async () => {
      const event1 = buildFullEvent({ id: 'event-1', title: 'Event 1' });
      const event2 = buildFullEvent({ id: 'event-2', title: 'Event 2' });

      mockActivityRepo.findOne.mockResolvedValueOnce(event1).mockResolvedValueOnce(event2);

      await service.joinWaitlist('event-1', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-2', 'pilot-charlie', 'org-uee-navy');

      const entries = service.getUserWaitlistEntries('pilot-charlie');
      expect(entries).toHaveLength(2);
    });
  });

  // ------------------------------------------------------------------
  // clearWaitlist
  // ------------------------------------------------------------------
  describe('clearWaitlist', () => {
    it('should remove all entries for an event', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');

      service.clearWaitlist('event-vanduul-swarm-001');

      expect(service.getWaitlist('event-vanduul-swarm-001')).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // notifyPositionUpdates
  // ------------------------------------------------------------------
  describe('notifyPositionUpdates', () => {
    it('should return 0 when event not found', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      const notified = await service.notifyPositionUpdates('missing-event');
      expect(notified).toBe(0);
    });

    it('should notify all waiting users of their positions', async () => {
      const event = buildFullEvent();
      mockActivityRepo.findOne.mockResolvedValue(event);

      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-charlie', 'org-uee-navy');
      await service.joinWaitlist('event-vanduul-swarm-001', 'pilot-delta', 'org-uee-navy');

      // Clear calls from joinWaitlist
      mockNotificationService.sendDiscordNotification.mockClear();

      const notified = await service.notifyPositionUpdates('event-vanduul-swarm-001');

      expect(notified).toBe(2);
      expect(mockNotificationService.sendDiscordNotification).toHaveBeenCalledTimes(2);
    });
  });
});
