/**
 * Event Workflow Integration Test
 *
 * Tests end-to-end event workflows covering:
 * - Waitlist management (join → promote → confirm)
 * - Conflict detection
 * - Activity service instantiation
 */

import { clearEntityStorage, mockAppDataSource } from '../helpers/database-mock';
import { mockDataStore } from '../helpers/stateful-mocks';

// Must mock BEFORE importing services
jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));
jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock Redis
jest.mock('../../utils/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  setex: jest.fn().mockResolvedValue('OK'),
  connectRedis: jest.fn(),
}));

// Mock VoiceChannelService singleton
jest.mock('../../services/communication/voice/VoiceChannelService', () => ({
  VoiceChannelService: {
    getInstance: jest.fn(() => ({
      createChannel: jest.fn().mockResolvedValue({ id: 'voice-123', name: 'Event Voice' }),
      deleteChannel: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

import { Activity, ActivityType, ParticipantRole } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import { NotificationService } from '../../services/communication/notifications/NotificationService';
import { EventWaitlistService } from '../../services/event/EventWaitlistService';

/**
 * Seed a full event into the mock database so waitlist operations succeed.
 * The event must be of type EVENT and have maxParticipants reached.
 */
async function seedFullEvent(eventId: string, orgId: string, maxParticipants = 2): Promise<void> {
  const repo = mockAppDataSource.getRepository(Activity);
  const participants = Array.from({ length: maxParticipants }, (_, i) => ({
    userId: `existing-participant-${i}`,
    status: 'accepted',
  }));
  await repo.save({
    id: eventId,
    activityType: ActivityType.EVENT,
    organizationId: orgId,
    title: `Test Event ${eventId}`,
    maxParticipants,
    participants,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed normalized participant rows because waitlist fullness checks query activity_participants
  const participantRepo = mockAppDataSource.getRepository(ActivityParticipantEntity);
  for (let i = 0; i < maxParticipants; i++) {
    await participantRepo.save({
      id: `participant-${eventId}-${i}`,
      activityId: eventId,
      userId: `existing-participant-${i}`,
      userName: `existing-user-${i}`,
      organizationId: orgId,
      organizationName: `Org ${orgId}`,
      role: ParticipantRole.MEMBER,
      status: ActivityParticipantStatus.ACCEPTED,
      joinedAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

describe('Event Workflow Integration', () => {
  const orgId = 'org-event-test';

  beforeAll(() => {
    mockDataStore.clear();
    clearEntityStorage();
  });

  afterAll(() => {
    mockDataStore.clear();
    clearEntityStorage();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDataStore.clear();
  });

  describe('Event Waitlist Lifecycle', () => {
    let waitlistService: EventWaitlistService;
    let mockNotificationService: jest.Mocked<NotificationService>;

    beforeEach(() => {
      mockNotificationService = {
        create: jest
          .fn()
          .mockResolvedValue({ success: true, channel: 'in-app', recipientCount: 1 }),
        sendDiscordNotification: jest
          .fn()
          .mockResolvedValue({ success: true, channel: 'discord', recipientCount: 1 }),
        sendEmailNotification: jest
          .fn()
          .mockResolvedValue({ success: true, channel: 'email', recipientCount: 1 }),
      } as unknown as jest.Mocked<NotificationService>;

      waitlistService = new EventWaitlistService(mockNotificationService, {
        maxWaitlistSize: 10,
        promotionExpiryMinutes: 30,
        notifyOnPromotion: true,
        notifyOnPositionChange: true,
      });
    });

    it('should allow users to join a waitlist', async () => {
      const eventId = 'event-full-001';
      await seedFullEvent(eventId, orgId);

      const entry = await waitlistService.joinWaitlist(eventId, 'user-1', orgId);

      expect(entry).toBeDefined();
      expect(entry.userId).toBe('user-1');
      expect(entry.position).toBe(1);
    });

    it('should track waitlist positions correctly', async () => {
      const eventId = 'event-full-002';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-2', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-3', orgId);

      const pos1 = waitlistService.getWaitlistPosition(eventId, 'user-1');
      const pos2 = waitlistService.getWaitlistPosition(eventId, 'user-2');
      const pos3 = waitlistService.getWaitlistPosition(eventId, 'user-3');

      expect(pos1).toBe(1);
      expect(pos2).toBe(2);
      expect(pos3).toBe(3);
    });

    it('should allow users to leave a waitlist', async () => {
      const eventId = 'event-full-003';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-2', orgId);

      await waitlistService.leaveWaitlist(eventId, 'user-1');

      const waitlist = waitlistService.getWaitlist(eventId);
      expect(waitlist).toHaveLength(1);
      expect(waitlist[0].userId).toBe('user-2');
    });

    it('should promote users from waitlist', async () => {
      const eventId = 'event-full-004';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-2', orgId);

      const result = await waitlistService.promoteFromWaitlist(eventId, 1);

      expect(result).toBeDefined();
      expect(result.promoted).toHaveLength(1);
      expect(result.promoted[0].userId).toBe('user-1');
      expect(result.remainingWaitlist).toBe(1);
    });

    it('should get waitlist statistics', async () => {
      const eventId = 'event-full-005';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-2', orgId);

      const stats = waitlistService.getWaitlistStats(eventId);

      expect(stats).toBeDefined();
      expect(stats.totalWaiting).toBe(2);
    });

    it('should get user waitlist entries across events', async () => {
      await seedFullEvent('event-a', orgId);
      await seedFullEvent('event-b', orgId);

      await waitlistService.joinWaitlist('event-a', 'user-multi', orgId);
      await waitlistService.joinWaitlist('event-b', 'user-multi', orgId);

      const entries = waitlistService.getUserWaitlistEntries('user-multi');

      expect(entries).toHaveLength(2);
    });

    it('should clear an entire waitlist', async () => {
      const eventId = 'event-full-006';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-2', orgId);
      await waitlistService.joinWaitlist(eventId, 'user-3', orgId);

      waitlistService.clearWaitlist(eventId);

      const waitlist = waitlistService.getWaitlist(eventId);
      expect(waitlist).toHaveLength(0);
    });

    it('should prevent duplicate waitlist entries', async () => {
      const eventId = 'event-full-007';
      await seedFullEvent(eventId, orgId);

      await waitlistService.joinWaitlist(eventId, 'user-1', orgId);

      await expect(waitlistService.joinWaitlist(eventId, 'user-1', orgId)).rejects.toThrow();
    });
  });

  describe('Event Conflict Detection', () => {
    it('should import EventConflictService without errors', async () => {
      const { EventConflictService } = await import('../../services/event/EventConflictService');
      const conflictService = new EventConflictService();
      expect(conflictService).toBeDefined();
    });

    it('should check for conflicts in a time range', async () => {
      const { EventConflictService } = await import('../../services/event/EventConflictService');
      const conflictService = new EventConflictService();

      const start = new Date('2026-03-01T18:00:00Z');
      const end = new Date('2026-03-01T20:00:00Z');

      const result = await conflictService.checkConflicts(orgId, start, end);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('hasConflicts');
      expect(result).toHaveProperty('conflicts');
      expect(Array.isArray(result.conflicts)).toBe(true);
    });
  });

  describe('Activity Lifecycle', () => {
    it('should instantiate ActivityEventService with mocked database', async () => {
      const { ActivityEventService } = await import('../../services/activity/ActivityEventService');
      const service = new ActivityEventService();
      expect(service).toBeDefined();
    });
  });
});
