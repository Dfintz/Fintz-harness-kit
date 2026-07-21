import { ActivityStatus, ActivityType, ParticipantRole } from '../../models/Activity';
import { ActivityParticipantService } from '../activity/ActivityParticipantService';
import { ActivityService } from '../activity/ActivityService';
import { LFGActivitySyncService } from '../aggregators/LFGActivitySyncService';
import { LFGSession, LFGSessionService, LFGSessionStatus } from '../social/LFGSessionService';

// Mock all dependencies
jest.mock('../activity/ActivityService');
jest.mock('../activity/ActivityParticipantService');
jest.mock('../social/LFGSessionService');

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    })),
    transaction: jest.fn((callback: (em: unknown) => Promise<unknown>) => callback({})),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────

function makeLFGSession(overrides: Partial<LFGSession> = {}): LFGSession {
  return {
    id: 'lfg-session-1',
    hostUserId: 'host-user-1',
    organizationId: 'org-1',
    activityType: 'mining',
    title: 'Mining Run',
    description: 'Quantanium mining at Lyria',
    maxPlayers: 4,
    minPlayers: 2,
    currentPlayers: ['host-user-1', 'player-2', 'player-3'],
    status: LFGSessionStatus.OPEN,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    expiresAt: new Date('2025-06-01T14:00:00Z'),
    updatedAt: new Date('2025-06-01T10:00:00Z'),
    tags: ['mining', 'lyria'],
    metadata: {},
    ...overrides,
  };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'activity-1',
    title: 'Mining Run',
    description: 'Quantanium mining at Lyria',
    activityType: ActivityType.LFG,
    organizationId: 'org-1',
    creatorId: 'host-user-1',
    status: ActivityStatus.DRAFT,
    participants: [],
    currentParticipants: 1,
    maxParticipants: 4,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('LFGActivitySyncService', () => {
  let service: LFGActivitySyncService;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockParticipantService: jest.Mocked<ActivityParticipantService>;
  let mockLfgSessionService: jest.Mocked<LFGSessionService>;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new LFGActivitySyncService();

    // Access internal mocked services
    mockActivityService = (service as any).activityService;
    mockParticipantService = (service as any).participantService;
    mockLfgSessionService = (service as any).lfgSessionService;
  });

  // ─── mapStatus ────────────────────────────────────────────

  describe('mapStatus', () => {
    it('should map OPEN to RECRUITING', () => {
      expect(service.mapStatus(LFGSessionStatus.OPEN)).toBe(ActivityStatus.RECRUITING);
    });

    it('should map FULL to READY', () => {
      expect(service.mapStatus(LFGSessionStatus.FULL)).toBe(ActivityStatus.READY);
    });

    it('should map IN_PROGRESS to IN_PROGRESS', () => {
      expect(service.mapStatus(LFGSessionStatus.IN_PROGRESS)).toBe(ActivityStatus.IN_PROGRESS);
    });

    it('should map COMPLETED to COMPLETED', () => {
      expect(service.mapStatus(LFGSessionStatus.COMPLETED)).toBe(ActivityStatus.COMPLETED);
    });

    it('should map CANCELLED to CANCELLED', () => {
      expect(service.mapStatus(LFGSessionStatus.CANCELLED)).toBe(ActivityStatus.CANCELLED);
    });
  });

  // ─── mapParticipants ──────────────────────────────────────

  describe('mapParticipants', () => {
    it('should set host as LEADER and others as MEMBER', () => {
      const session = makeLFGSession();
      const participants = service.mapParticipants(session);

      expect(participants).toHaveLength(3);

      const host = participants.find(p => p.userId === 'host-user-1');
      expect(host).toBeDefined();
      expect(host!.role).toBe(ParticipantRole.LEADER);
      expect(host!.status).toBe('accepted');

      const member = participants.find(p => p.userId === 'player-2');
      expect(member).toBeDefined();
      expect(member!.role).toBe(ParticipantRole.MEMBER);
      expect(member!.status).toBe('accepted');
    });

    it('should set organizationId on all participants', () => {
      const session = makeLFGSession({ organizationId: 'custom-org' });
      const participants = service.mapParticipants(session);

      participants.forEach(p => {
        expect(p.organizationId).toBe('custom-org');
      });
    });

    it('should handle empty player list', () => {
      const session = makeLFGSession({ currentPlayers: [] });
      const participants = service.mapParticipants(session);
      expect(participants).toHaveLength(0);
    });

    it('should handle single player (host only)', () => {
      const session = makeLFGSession({ currentPlayers: ['host-user-1'] });
      const participants = service.mapParticipants(session);

      expect(participants).toHaveLength(1);
      expect(participants[0].role).toBe(ParticipantRole.LEADER);
    });

    it('should attach lfgSessionId in metadata', () => {
      const session = makeLFGSession();
      const participants = service.mapParticipants(session);

      participants.forEach(p => {
        expect(p.metadata).toEqual({ linkedLfgSessionId: 'lfg-session-1' });
      });
    });
  });

  // ─── syncLFGToActivity ────────────────────────────────────

  describe('syncLFGToActivity', () => {
    it('should return error when session is not found', async () => {
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(null);

      const result = await service.syncLFGToActivity('bad-session');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('LFG session not found');
      expect(result.activityId).toBeUndefined();
    });

    it('should create an activity from an OPEN session with participants', async () => {
      const session = makeLFGSession();
      const activity = makeActivity();

      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(activity);
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(activity);

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.success).toBe(true);
      expect(result.activityId).toBe('activity-1');
      expect(result.participantsSynced).toBe(3); // host + 2 players

      // Verify createActivity was called with correct DTO
      expect(mockActivityService.createActivity).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          title: 'Mining Run',
          activityType: ActivityType.LFG,
          creatorId: 'host-user-1',
          maxParticipants: 4,
          minParticipants: 2,
          tags: ['mining', 'lyria'],
          metadata: expect.objectContaining({ linkedLfgSessionId: 'lfg-session-1' }),
        })
      );

      // joinActivity for non-host players only
      expect(mockParticipantService.joinActivity).toHaveBeenCalledTimes(2);
      expect(mockParticipantService.joinActivity).toHaveBeenCalledWith(
        'activity-1',
        expect.objectContaining({
          userId: 'player-2',
          role: ParticipantRole.MEMBER,
        })
      );
    });

    it('should not update status when session is OPEN', async () => {
      const session = makeLFGSession({ status: LFGSessionStatus.OPEN });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());

      await service.syncLFGToActivity('lfg-session-1');

      expect(mockActivityService.updateStatus).not.toHaveBeenCalled();
    });

    it('should update activity status when session is IN_PROGRESS', async () => {
      const session = makeLFGSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());
      mockActivityService.updateStatus = jest.fn().mockResolvedValue(makeActivity());

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.success).toBe(true);
      expect(result.statusMapped).toBe(ActivityStatus.IN_PROGRESS);
      expect(mockActivityService.updateStatus).toHaveBeenCalledWith(
        'activity-1',
        ActivityStatus.IN_PROGRESS,
        'host-user-1'
      );
    });

    it('should update activity status when session is COMPLETED', async () => {
      const session = makeLFGSession({ status: LFGSessionStatus.COMPLETED });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());
      mockActivityService.updateStatus = jest.fn().mockResolvedValue(makeActivity());

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.statusMapped).toBe(ActivityStatus.COMPLETED);
      expect(mockActivityService.updateStatus).toHaveBeenCalledWith(
        'activity-1',
        ActivityStatus.COMPLETED,
        'host-user-1'
      );
    });

    it('should skip participant sync when syncParticipants is false', async () => {
      const session = makeLFGSession();
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());

      const result = await service.syncLFGToActivity('lfg-session-1', {
        syncParticipants: false,
      });

      expect(result.success).toBe(true);
      expect(result.participantsSynced).toBe(1); // only the auto-added host
      expect(mockParticipantService.joinActivity).not.toHaveBeenCalled();
    });

    it('should use creatorName from options when provided', async () => {
      const session = makeLFGSession();
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());

      await service.syncLFGToActivity('lfg-session-1', {
        creatorName: 'Commander Rex',
      });

      expect(mockActivityService.createActivity).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ creatorName: 'Commander Rex' })
      );
    });

    it('should collect errors for failed participant syncs without failing overall', async () => {
      const session = makeLFGSession();
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());

      let callCount = 0;
      mockParticipantService.joinActivity = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Capacity exceeded');
        return Promise.resolve(makeActivity());
      });

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.success).toBe(true);
      expect(result.participantsSynced).toBe(2); // host auto + 1 successful join
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('player-2');
      expect(result.errors[0]).toContain('Capacity exceeded');
    });

    it('should handle createActivity failure gracefully', async () => {
      const session = makeLFGSession();
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest
        .fn()
        .mockRejectedValue(new Error('DB connection failed'));

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('DB connection failed');
      expect(result.activityId).toBeUndefined();
    });

    it('should handle status update failure without failing sync', async () => {
      const session = makeLFGSession({ status: LFGSessionStatus.FULL });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());
      mockActivityService.updateStatus = jest
        .fn()
        .mockRejectedValue(new Error('Status transition not allowed'));

      const result = await service.syncLFGToActivity('lfg-session-1');

      expect(result.success).toBe(true);
      expect(result.activityId).toBe('activity-1');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Status transition not allowed');
    });

    it('should use default description when session has none', async () => {
      const session = makeLFGSession({ description: undefined });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());

      await service.syncLFGToActivity('lfg-session-1');

      expect(mockActivityService.createActivity).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          description: 'LFG session: Mining Run',
        })
      );
    });

    it('should pass scheduledAt as scheduledStartDate', async () => {
      const scheduled = new Date('2025-12-25T18:00:00Z');
      const session = makeLFGSession({ scheduledAt: scheduled });
      mockLfgSessionService.getSession = jest.fn().mockResolvedValue(session);
      mockActivityService.createActivity = jest.fn().mockResolvedValue(makeActivity());
      mockParticipantService.joinActivity = jest.fn().mockResolvedValue(makeActivity());

      await service.syncLFGToActivity('lfg-session-1');

      expect(mockActivityService.createActivity).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          scheduledStartDate: scheduled,
        })
      );
    });
  });

  // ─── syncStatusToActivity ─────────────────────────────────

  describe('syncStatusToActivity', () => {
    it('should update activity status from LFG status', async () => {
      mockActivityService.updateStatus = jest.fn().mockResolvedValue(makeActivity());

      const result = await service.syncStatusToActivity(
        'lfg-session-1',
        LFGSessionStatus.COMPLETED,
        'host-user-1',
        'activity-1'
      );

      expect(result.success).toBe(true);
      expect(mockActivityService.updateStatus).toHaveBeenCalledWith(
        'activity-1',
        ActivityStatus.COMPLETED,
        'host-user-1'
      );
    });

    it('should return error on failure', async () => {
      mockActivityService.updateStatus = jest.fn().mockRejectedValue(new Error('Not found'));

      const result = await service.syncStatusToActivity(
        'lfg-1',
        LFGSessionStatus.IN_PROGRESS,
        'user-1',
        'act-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });

    it('should map FULL to READY', async () => {
      mockActivityService.updateStatus = jest.fn().mockResolvedValue(makeActivity());

      await service.syncStatusToActivity('lfg-1', LFGSessionStatus.FULL, 'user-1', 'act-1');

      expect(mockActivityService.updateStatus).toHaveBeenCalledWith(
        'act-1',
        ActivityStatus.READY,
        'user-1'
      );
    });

    it('should map CANCELLED to CANCELLED', async () => {
      mockActivityService.updateStatus = jest.fn().mockResolvedValue(makeActivity());

      await service.syncStatusToActivity('lfg-1', LFGSessionStatus.CANCELLED, 'user-1', 'act-1');

      expect(mockActivityService.updateStatus).toHaveBeenCalledWith(
        'act-1',
        ActivityStatus.CANCELLED,
        'user-1'
      );
    });
  });

  // ─── constructor ──────────────────────────────────────────

  describe('constructor', () => {
    it('should accept optional dependencies for testability', () => {
      const customActivity = new ActivityService();
      const customParticipant = new ActivityParticipantService();
      const customLfg = new LFGSessionService();

      const svc = new LFGActivitySyncService(customActivity, customParticipant, customLfg);

      expect((svc as any).activityService).toBe(customActivity);
      expect((svc as any).participantService).toBe(customParticipant);
      expect((svc as any).lfgSessionService).toBe(customLfg);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

