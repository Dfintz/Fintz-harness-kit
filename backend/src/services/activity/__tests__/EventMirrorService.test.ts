/**
 * Tests for EventMirrorService — Event mirroring across Discord servers.
 * Wave 1.8 — Event Mirroring
 */

// Mock data-source before imports
jest.mock('../../../data-source', () => {
  const mockFind = jest.fn().mockResolvedValue([]);
  const mockFindOne = jest.fn().mockResolvedValue(null);
  const mockCount = jest.fn().mockResolvedValue(0);
  const mockCreate = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    id: 'mirror-uuid-123',
    ...data,
  }));
  const mockSave = jest.fn().mockImplementation((entity: Record<string, unknown>) => entity);
  const mockUpdate = jest.fn().mockResolvedValue({ affected: 1 });

  return {
    AppDataSource: {
      getRepository: jest.fn(() => ({
        find: mockFind,
        findOne: mockFindOne,
        count: mockCount,
        create: mockCreate,
        save: mockSave,
        update: mockUpdate,
        metadata: { name: 'MirroredActivity' },
      })),
    },
    // Export mocks for assertion in tests
    __mocks: {
      find: mockFind,
      findOne: mockFindOne,
      count: mockCount,
      create: mockCreate,
      save: mockSave,
      update: mockUpdate,
    },
  };
});

import { ActivityType } from '../../../models/Activity';
import { MirroredActivityStatus } from '../../../models/MirroredActivity';
import { EventMirrorService } from '../EventMirrorService';

// Access mocks
const { __mocks } = jest.requireMock('../../../data-source');

describe('EventMirrorService', () => {
  let service: EventMirrorService;

  beforeEach(() => {
    EventMirrorService.resetInstance();
    jest.clearAllMocks();
    service = EventMirrorService.getInstance();
  });

  afterAll(() => {
    EventMirrorService.resetInstance();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = EventMirrorService.getInstance();
      const instance2 = EventMirrorService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = EventMirrorService.getInstance();
      EventMirrorService.resetInstance();
      const instance2 = EventMirrorService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createMirror', () => {
    const baseDTO = {
      sourceActivityId: 'activity-123',
      sourceGuildId: 'guild-source',
      sourceOrganizationId: 'org-source',
      mirrorGuildId: 'guild-target',
      mirrorChannelId: 'channel-target',
      targetOrganizationId: 'org-target',
    };

    it('should fail if source activity does not exist', async () => {
      // Activity repo findOne returns null (activity not found)
      __mocks.findOne.mockResolvedValueOnce(null);

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Source activity not found');
    });

    it('should allow mirroring non-EVENT activity types', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          id: 'activity-123',
          activityType: ActivityType.OPERATION,
        })
        .mockResolvedValueOnce(null) // No duplicate mirror
        .mockResolvedValueOnce(null); // Guild settings (default limit)
      __mocks.count.mockResolvedValueOnce(0); // No existing mirrors
      __mocks.create.mockReturnValueOnce({ id: 'mirror-1' });
      __mocks.save.mockResolvedValueOnce({ id: 'mirror-1' });

      const result = await service.createMirror(baseDTO);

      // Should succeed — activity type restriction was removed
      expect(result.success).toBe(true);
    });

    it('should fail if max mirrors reached', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(null) // No duplicate mirror
        .mockResolvedValueOnce(null); // Guild settings (default limit)
      __mocks.count.mockResolvedValueOnce(5); // Already at default max (5)

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(false);
      expect(result.message).toContain('limit: 5');
    });

    it('should respect per-org mirror limit from guild settings', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(null) // No duplicate mirror
        .mockResolvedValueOnce({
          eventSettings: { maxMirrorsPerActivity: 3 },
        });
      __mocks.count.mockResolvedValueOnce(3); // At custom max

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(false);
      expect(result.message).toContain('limit: 3');
    });

    it('should cap per-org mirror limit at 10', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(null) // No duplicate mirror
        .mockResolvedValueOnce({
          eventSettings: { maxMirrorsPerActivity: 99 },
        });
      __mocks.count.mockResolvedValueOnce(10); // At absolute max

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(false);
      expect(result.message).toContain('limit: 10');
    });

    it('should repost (reuse) when an active mirror already exists', async () => {
      const existing = {
        id: 'existing-mirror',
        sourceActivityId: 'activity-123',
        mirrorGuildId: 'guild-target',
        mirrorChannelId: 'channel-old',
        status: MirroredActivityStatus.ACTIVE,
        syncEnabled: false,
      };
      __mocks.findOne
        .mockResolvedValueOnce({
          // Source activity
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(existing); // Existing mirror (duplicate check → repost)
      __mocks.save.mockResolvedValueOnce({ ...existing, mirrorChannelId: 'channel-target' });

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(true);
      expect(result.message).toContain('reposted');
      expect(result.mirror!.id).toBe('existing-mirror');
      // Channel should be updated to the new target
      expect(result.mirror!.mirrorChannelId).toBe('channel-target');
      // Limit check (count) must NOT run on the repost path
      expect(__mocks.count).not.toHaveBeenCalled();
    });

    it('should create a mirror successfully', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          // Source activity
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(null) // No existing mirror (duplicate check)
        .mockResolvedValueOnce(null); // Guild settings (default limit)
      __mocks.count.mockResolvedValueOnce(0);

      const result = await service.createMirror(baseDTO);

      expect(result.success).toBe(true);
      expect(result.mirror).toBeDefined();
      expect(result.mirror!.sourceActivityId).toBe('activity-123');
      expect(result.mirror!.mirrorGuildId).toBe('guild-target');
      expect(__mocks.save).toHaveBeenCalled();
    });

    it('should hash the mirror key before storing', async () => {
      __mocks.findOne
        .mockResolvedValueOnce({
          id: 'activity-123',
          activityType: ActivityType.EVENT,
        })
        .mockResolvedValueOnce(null) // No duplicate mirror
        .mockResolvedValueOnce(null); // Guild settings (default limit)
      __mocks.count.mockResolvedValueOnce(0);

      const result = await service.createMirror({
        ...baseDTO,
        mirrorKey: 'my-secret-key',
      });

      expect(result.success).toBe(true);
      // The key should be hashed (SHA-256 = 64 hex chars)
      expect(result.mirror!.mirrorKey).toBeDefined();
      expect(result.mirror!.mirrorKey!.length).toBe(64);
      expect(result.mirror!.mirrorKey).not.toBe('my-secret-key');
    });
  });

  describe('resolveMaxMirrors', () => {
    it('should return default (5) when no guild settings exist', async () => {
      __mocks.findOne.mockResolvedValueOnce(null);

      const limit = await service.resolveMaxMirrors('guild-1', 'org-1');

      expect(limit).toBe(5);
    });

    it('should return the configured value from guild settings', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        eventSettings: { maxMirrorsPerActivity: 8 },
      });

      const limit = await service.resolveMaxMirrors('guild-1', 'org-1');

      expect(limit).toBe(8);
    });

    it('should clamp values above 10 to 10', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        eventSettings: { maxMirrorsPerActivity: 50 },
      });

      const limit = await service.resolveMaxMirrors('guild-1', 'org-1');

      expect(limit).toBe(10);
    });

    it('should clamp values below 1 to 1', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        eventSettings: { maxMirrorsPerActivity: 0 },
      });

      const limit = await service.resolveMaxMirrors('guild-1', 'org-1');

      expect(limit).toBe(1);
    });

    it('should return default when eventSettings is undefined', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        eventSettings: undefined,
      });

      const limit = await service.resolveMaxMirrors('guild-1', 'org-1');

      expect(limit).toBe(5);
    });
  });

  describe('cancelMirror', () => {
    it('should cancel an existing mirror', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        id: 'mirror-123',
        status: MirroredActivityStatus.ACTIVE,
        syncEnabled: true,
      });

      const result = await service.cancelMirror('mirror-123');

      expect(result.success).toBe(true);
      expect(__mocks.save).toHaveBeenCalled();
    });

    it('should fail if mirror not found', async () => {
      __mocks.findOne.mockResolvedValueOnce(null);

      const result = await service.cancelMirror('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('expireMirrorsForEvent', () => {
    it('should expire all active mirrors for an event', async () => {
      __mocks.update.mockResolvedValueOnce({ affected: 3 });

      const count = await service.expireMirrorsForEvent('activity-123');

      expect(count).toBe(3);
      expect(__mocks.update).toHaveBeenCalledWith(
        {
          sourceActivityId: 'activity-123',
          status: MirroredActivityStatus.ACTIVE,
        },
        {
          status: MirroredActivityStatus.EXPIRED,
          syncEnabled: false,
        }
      );
    });
  });

  describe('mirror key authentication', () => {
    it('should hash mirror keys consistently', () => {
      const hash1 = EventMirrorService.hashMirrorKey('test-key');
      const hash2 = EventMirrorService.hashMirrorKey('test-key');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex digest
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = EventMirrorService.hashMirrorKey('key-1');
      const hash2 = EventMirrorService.hashMirrorKey('key-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should set mirror key on activity metadata', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        id: 'activity-123',
        activityType: ActivityType.EVENT,
        metadata: {},
      });

      const result = await service.setEventMirrorKey('activity-123', 'my-key');

      expect(result.success).toBe(true);
      expect(__mocks.save).toHaveBeenCalled();
    });

    it('should fail to set key if event not found', async () => {
      __mocks.findOne.mockResolvedValueOnce(null);

      const result = await service.setEventMirrorKey('nonexistent', 'my-key');

      expect(result.success).toBe(false);
    });

    it('should validate correct mirror key', async () => {
      const hashed = EventMirrorService.hashMirrorKey('correct-key');
      __mocks.findOne.mockResolvedValueOnce({
        id: 'activity-123',
        metadata: { mirrorKeyHash: hashed },
      });

      const isValid = await service.validateMirrorKey('activity-123', 'correct-key');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect mirror key', async () => {
      const hashed = EventMirrorService.hashMirrorKey('correct-key');
      __mocks.findOne.mockResolvedValueOnce({
        id: 'activity-123',
        metadata: { mirrorKeyHash: hashed },
      });

      const isValid = await service.validateMirrorKey('activity-123', 'wrong-key');
      expect(isValid).toBe(false);
    });

    it('should accept any key when no key is set on event', async () => {
      __mocks.findOne.mockResolvedValueOnce({
        id: 'activity-123',
        metadata: {},
      });

      const isValid = await service.validateMirrorKey('activity-123', 'any-key');
      expect(isValid).toBe(true);
    });
  });

  describe('setMirrorMessageId', () => {
    it('should update the mirror message ID', async () => {
      await service.setMirrorMessageId('mirror-123', 'msg-456');

      expect(__mocks.update).toHaveBeenCalledWith('mirror-123', {
        mirrorMessageId: 'msg-456',
      });
    });
  });

  describe('recordSync', () => {
    it('should update lastSyncAt', async () => {
      await service.recordSync('mirror-123');

      expect(__mocks.update).toHaveBeenCalledWith(
        'mirror-123',
        expect.objectContaining({
          lastSyncAt: expect.any(Date),
        })
      );
    });
  });
});

