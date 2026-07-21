/**
 * LFGSessionService Tests
 *
 * Tests for Redis-backed LFG session management:
 * - Session creation and retrieval
 * - Joining and leaving sessions
 * - Session lifecycle (start, complete, cancel)
 * - Filtering and querying
 * - Session extension and health checks
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
}));

const mockRedisClient = {
  set: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  keys: jest.fn().mockResolvedValue([]),
};

jest.mock('../../../utils/redis', () => ({
  redisClient: mockRedisClient,
}));

import type { CreateLFGSessionDto, LFGSession } from '../../../services/social/LFGSessionService';
import { LFGSessionService, LFGSessionStatus } from '../../../services/social/LFGSessionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCreateDto(overrides: Partial<CreateLFGSessionDto> = {}): CreateLFGSessionDto {
  return {
    hostUserId: 'pilot-hammerhead-captain',
    organizationId: 'org-uee-fleet',
    activityType: 'Bounty Hunting',
    title: 'VHRT Bounties in Crusader',
    description: 'Need wingmen for Very High Risk Target bounties near Yela',
    maxPlayers: 4,
    minPlayers: 2,
    tags: ['bounty', 'combat', 'crusader'],
    ttlSeconds: 7200,
    ...overrides,
  };
}

function buildStoredSession(overrides: Partial<LFGSession> = {}): LFGSession {
  const now = new Date();
  return {
    id: 'session-vanduul-001',
    hostUserId: 'pilot-hammerhead-captain',
    organizationId: 'org-uee-fleet',
    activityType: 'Bounty Hunting',
    title: 'VHRT Bounties in Crusader',
    description: 'Need wingmen',
    maxPlayers: 4,
    minPlayers: 2,
    currentPlayers: ['pilot-hammerhead-captain'],
    status: LFGSessionStatus.OPEN,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 7200 * 1000),
    updatedAt: now,
    tags: ['bounty', 'combat'],
    ...overrides,
  };
}

describe('LFGSessionService', () => {
  let service: LFGSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LFGSessionService();
  });

  // ==================== SESSION CREATION ====================

  describe('createSession', () => {
    it('should create a session with host as first player', async () => {
      const dto = buildCreateDto();
      const session = await service.createSession(dto);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.hostUserId).toBe('pilot-hammerhead-captain');
      expect(session.currentPlayers).toContain('pilot-hammerhead-captain');
      expect(session.currentPlayers).toHaveLength(1);
      expect(session.status).toBe(LFGSessionStatus.OPEN);
      expect(session.activityType).toBe('Bounty Hunting');
    });

    it('should store session in Redis with TTL', async () => {
      const dto = buildCreateDto({ ttlSeconds: 3600 });
      await service.createSession(dto);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('lfg:session:'),
        expect.objectContaining({ hostUserId: dto.hostUserId }),
        3600
      );
    });

    it('should add session to activity, org, host, and user indexes', async () => {
      const dto = buildCreateDto();
      await service.createSession(dto);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'lfg:activity:Bounty Hunting',
        expect.any(String)
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'lfg:org:org-uee-fleet',
        expect.any(String)
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'lfg:host:pilot-hammerhead-captain',
        expect.any(String)
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'lfg:user:pilot-hammerhead-captain:sessions',
        expect.any(String)
      );
    });

    it('should add session to guild index when guildId is in metadata', async () => {
      const dto = buildCreateDto({
        metadata: { guildId: 'guild-uee-navy', channelId: 'ch-001' },
      });
      await service.createSession(dto);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'lfg:guild:guild-uee-navy',
        expect.any(String)
      );
    });

    it('should not add to guild index when no guildId in metadata', async () => {
      const dto = buildCreateDto({ metadata: {} });
      await service.createSession(dto);

      const guildCalls = mockRedisClient.sadd.mock.calls.filter(
        (call: string[]) => typeof call[0] === 'string' && call[0].startsWith('lfg:guild:')
      );
      expect(guildCalls).toHaveLength(0);
    });

    it('should use default TTL of 4 hours when not specified', async () => {
      const dto = buildCreateDto();
      delete (dto as any).ttlSeconds;
      const session = await service.createSession(dto);

      // Default TTL is 4 hours = 14400 seconds
      expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBeCloseTo(
        14400 * 1000,
        -2
      );
    });

    it('should set minPlayers to 1 by default', async () => {
      const dto = buildCreateDto();
      delete (dto as any).minPlayers;
      const session = await service.createSession(dto);

      expect(session.minPlayers).toBe(1);
    });
  });

  // ==================== GET SESSION ====================

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.getSession('session-ghost');

      expect(result).toBeNull();
    });

    it('should deserialize dates from stored data', async () => {
      const storedData = {
        id: 'session-001',
        hostUserId: 'pilot-1',
        organizationId: 'org-1',
        activityType: 'Mining',
        title: 'Quantanium run',
        maxPlayers: 3,
        minPlayers: 1,
        currentPlayers: ['pilot-1'],
        status: LFGSessionStatus.OPEN,
        createdAt: '2026-02-08T10:00:00.000Z',
        updatedAt: '2026-02-08T10:00:00.000Z',
        expiresAt: '2026-02-08T14:00:00.000Z',
      };
      mockRedisClient.get.mockResolvedValueOnce(storedData);

      const session = await service.getSession('session-001');

      expect(session).toBeDefined();
      expect(session!.createdAt).toBeInstanceOf(Date);
      expect(session!.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ==================== UPDATE SESSION ====================

  describe('updateSession', () => {
    it('should return null if session does not exist', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.updateSession('session-fake', { title: 'New title' });

      expect(result).toBeNull();
    });

    it('should preserve immutable fields (id, hostUserId, organizationId, createdAt)', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.updateSession(stored.id, {
        title: 'Updated title',
        id: 'hacked-id' as any,
        hostUserId: 'hacker' as any,
        organizationId: 'hacked-org' as any,
      });

      expect(result!.id).toBe(stored.id);
      expect(result!.hostUserId).toBe(stored.hostUserId);
      expect(result!.organizationId).toBe(stored.organizationId);
      expect(result!.title).toBe('Updated title');
    });
  });

  // ==================== JOIN SESSION ====================

  describe('joinSession', () => {
    it('should add a user to an open session', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.joinSession(stored.id, 'pilot-wingman-1');

      expect(result.success).toBe(true);
      expect(result.session!.currentPlayers).toContain('pilot-wingman-1');
    });

    it('should return error when session not found', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.joinSession('session-missing', 'pilot-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should return error when session is not open', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.joinSession(stored.id, 'pilot-late');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is not accepting players');
    });

    it('should return error when user is already in session', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.joinSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already in this session');
    });

    it('should return error when session is full', async () => {
      const stored = buildStoredSession({
        maxPlayers: 2,
        currentPlayers: ['pilot-1', 'pilot-2'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.joinSession(stored.id, 'pilot-3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is full');
    });

    it('should mark session as FULL when last slot is taken', async () => {
      const stored = buildStoredSession({
        maxPlayers: 2,
        currentPlayers: ['pilot-captain'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.joinSession(stored.id, 'pilot-last-slot');

      expect(result.success).toBe(true);
      expect(result.session!.status).toBe(LFGSessionStatus.FULL);
    });
  });

  // ==================== LEAVE SESSION ====================

  describe('leaveSession', () => {
    it('should remove user from session', async () => {
      const stored = buildStoredSession({
        currentPlayers: ['pilot-captain', 'pilot-crew'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.leaveSession(stored.id, 'pilot-crew');

      expect(result.success).toBe(true);
      expect(result.session!.currentPlayers).not.toContain('pilot-crew');
    });

    it('should return error if host tries to leave', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.leaveSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Host cannot leave session, use cancel instead');
    });

    it('should return error if user not in session', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.leaveSession(stored.id, 'pilot-stranger');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not in this session');
    });

    it('should reopen a FULL session when someone leaves', async () => {
      const stored = buildStoredSession({
        status: LFGSessionStatus.FULL,
        maxPlayers: 2,
        currentPlayers: ['pilot-captain', 'pilot-crew'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.leaveSession(stored.id, 'pilot-crew');

      expect(result.success).toBe(true);
      expect(result.session!.status).toBe(LFGSessionStatus.OPEN);
    });
  });

  // ==================== START SESSION ====================

  describe('startSession', () => {
    it('should start session when host has enough players', async () => {
      const stored = buildStoredSession({
        minPlayers: 2,
        currentPlayers: ['pilot-captain', 'pilot-crew'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.startSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(true);
      expect(result.session!.status).toBe(LFGSessionStatus.IN_PROGRESS);
    });

    it('should return error if non-host tries to start', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.startSession(stored.id, 'pilot-impostor');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only the host can start the session');
    });

    it('should return error if already in progress', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.startSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session already in progress');
    });

    it('should return error if not enough players', async () => {
      const stored = buildStoredSession({
        minPlayers: 3,
        currentPlayers: ['pilot-captain', 'pilot-crew'],
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.startSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Need at least 3 players');
    });

    it('should return error if session already ended', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.COMPLETED });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.startSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is already ended');
    });
  });

  // ==================== COMPLETE SESSION ====================

  describe('completeSession', () => {
    it('should mark session as completed', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.completeSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(true);
      expect(result.session!.status).toBe(LFGSessionStatus.COMPLETED);
    });

    it('should return error if non-host tries to complete', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.completeSession(stored.id, 'pilot-crew');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only the host can complete the session');
    });

    it('should store with short TTL for cleanup', async () => {
      const stored = buildStoredSession({ status: LFGSessionStatus.IN_PROGRESS });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      await service.completeSession(stored.id, 'pilot-hammerhead-captain');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('lfg:session:'),
        expect.objectContaining({ status: LFGSessionStatus.COMPLETED }),
        300
      );
    });

    it('should clean up all indexes after completion', async () => {
      const stored = buildStoredSession({
        status: LFGSessionStatus.IN_PROGRESS,
        currentPlayers: ['pilot-hammerhead-captain', 'pilot-wing-1'],
        metadata: { guildId: 'guild-uee-navy', channelId: 'ch-001' },
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      await service.completeSession(stored.id, 'pilot-hammerhead-captain');

      // Should remove from activity, org, host, and player indexes
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `lfg:activity:${stored.activityType}`,
        stored.id
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `lfg:org:${stored.organizationId}`,
        stored.id
      );
      // Should remove from guild index
      expect(mockRedisClient.srem).toHaveBeenCalledWith('lfg:guild:guild-uee-navy', stored.id);
    });
  });

  // ==================== CANCEL SESSION ====================

  describe('cancelSession', () => {
    it('should mark session as cancelled', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.cancelSession(stored.id, 'pilot-hammerhead-captain');

      expect(result.success).toBe(true);
      expect(result.session!.status).toBe(LFGSessionStatus.CANCELLED);
    });

    it('should return error if non-host tries to cancel', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.cancelSession(stored.id, 'pilot-random');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only the host can cancel the session');
    });
  });

  // ==================== FIND OPEN SESSIONS ====================

  describe('findOpenSessions', () => {
    it('should return empty array when no sessions found', async () => {
      mockRedisClient.keys.mockResolvedValueOnce([]);

      const result = await service.findOpenSessions();

      expect(result).toEqual([]);
    });

    it('should filter by activity type index', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['session-1']);
      const stored = buildStoredSession({ id: 'session-1' });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.findOpenSessions({ activityType: 'Mining' });

      expect(mockRedisClient.smembers).toHaveBeenCalledWith('lfg:activity:Mining');
      expect(result).toHaveLength(1);
    });

    it('should filter by organization index', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['session-1']);
      const stored = buildStoredSession({ id: 'session-1' });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      await service.findOpenSessions({ organizationId: 'org-uee-fleet' });

      expect(mockRedisClient.smembers).toHaveBeenCalledWith('lfg:org:org-uee-fleet');
    });
  });

  // ==================== USER & HOST SESSIONS ====================

  describe('getUserSessions', () => {
    it('should return empty array for user with no sessions', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await service.getUserSessions('pilot-loner');

      expect(result).toEqual([]);
    });
  });

  describe('getHostedSessions', () => {
    it('should return empty array for user with no hosted sessions', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await service.getHostedSessions('pilot-never-hosted');

      expect(result).toEqual([]);
    });
  });

  // ==================== SESSION COUNT ====================

  describe('getSessionCountByActivity', () => {
    it('should return count from Redis set', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['s1', 's2', 's3']);

      const count = await service.getSessionCountByActivity('Mining');

      expect(count).toBe(3);
    });

    it('should return 0 for activity with no sessions', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const count = await service.getSessionCountByActivity('PvP Arena');

      expect(count).toBe(0);
    });
  });

  // ==================== EXTEND SESSION ====================

  describe('extendSession', () => {
    it('should extend session expiry by specified seconds', async () => {
      const stored = buildStoredSession();
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.extendSession(stored.id, 3600);

      expect(result).not.toBeNull();
      expect(result!.expiresAt.getTime()).toBe(stored.expiresAt.getTime() + 3600 * 1000);
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.extendSession('session-gone', 3600);

      expect(result).toBeNull();
    });
  });

  // ==================== GET SESSIONS BY GUILD ====================

  describe('getSessionsByGuild', () => {
    it('should return empty array when no sessions for guild', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await service.getSessionsByGuild('guild-empty');

      expect(result).toEqual([]);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith('lfg:guild:guild-empty');
    });

    it('should return sessions for a specific guild', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['session-1']);
      const stored = buildStoredSession({
        id: 'session-1',
        metadata: { guildId: 'guild-uee-navy', channelId: 'ch-001' },
      });
      mockRedisClient.get.mockResolvedValueOnce(stored);

      const result = await service.getSessionsByGuild('guild-uee-navy');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });

    it('should filter out expired sessions (null returns from getSession)', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['session-1', 'session-expired']);
      const stored = buildStoredSession({ id: 'session-1' });
      mockRedisClient.get
        .mockResolvedValueOnce(stored) // session-1 exists
        .mockResolvedValueOnce(null); // session-expired is gone

      const result = await service.getSessionsByGuild('guild-uee-navy');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });
  });

  // ==================== HEALTH CHECK ====================

  describe('healthCheck', () => {
    it('should return healthy with session count', async () => {
      mockRedisClient.keys.mockResolvedValueOnce(['lfg:session:1', 'lfg:session:2']);

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.sessionCount).toBe(2);
    });

    it('should return unhealthy on Redis error', async () => {
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis connection refused'));

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.sessionCount).toBe(0);
    });
  });
});
