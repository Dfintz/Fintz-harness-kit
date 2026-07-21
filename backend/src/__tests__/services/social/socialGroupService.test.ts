/**
 * SocialGroupService Tests
 *
 * Tests for consolidated social group functionality:
 * - LFG post creation, joining, leaving, closing
 * - Session history recording and stats
 * - Matchmaking and activity conversion
 * - Expired post cleanup
 * - Guild-based post queries
 */

jest.mock('../../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../utils/redis', () => ({
  redisClient: {
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    keys: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../../services/social/LFGSessionService', () => ({
  lfgSessionService: {
    createSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    getSession: jest.fn().mockResolvedValue(null),
  },
  LFGSessionService: jest.fn(),
}));
jest.mock('../../../services/activity/ActivityService');

import { SocialGroupService } from '../../../services/social/SocialGroupService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockActivityRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve({ id: 'act-1', ...e })),
    create: jest.fn().mockImplementation((e: any) => ({ ...e })),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    }),
    metadata: { name: 'Activity' },
  };
}

function createMockHistoryRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve({ id: 'hist-1', ...e })),
    create: jest.fn().mockImplementation((e: any) => ({ ...e })),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    }),
    metadata: { name: 'LFGGroupHistory' },
  };
}

describe('SocialGroupService', () => {
  let service: SocialGroupService;
  let mockActivityRepo: ReturnType<typeof createMockActivityRepo>;
  let mockHistoryRepo: ReturnType<typeof createMockHistoryRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockActivityRepo = createMockActivityRepo();
    mockHistoryRepo = createMockHistoryRepo();

    const { AppDataSource } = require('../../../data-source');
    let callCount = 0;
    (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
      callCount++;
      // First call is Activity repo (super), second is LFGGroupHistory
      return callCount === 1 ? mockActivityRepo : mockHistoryRepo;
    });

    service = new SocialGroupService();
  });

  afterEach(() => {
    service.stopCleanup();
    service.clearAllPosts();
    jest.useRealTimers();
  });

  // ==================== LFG POST CREATION ====================

  describe('createPost', () => {
    it('should create a new LFG post with correct defaults', () => {
      const post = service.createPost(
        'Mining' as any,
        'Prospector run in Aaron Halo',
        'pilot-drake',
        'DrakeOwner',
        4,
        'guild-uee-001',
        'channel-lfg-001',
        120
      );

      expect(post).toBeDefined();
      expect(post.id).toMatch(/^lfg-/);
      expect(post.activity).toBe('Mining');
      expect(post.description).toBe('Prospector run in Aaron Halo');
      expect(post.creatorId).toBe('pilot-drake');
      expect(post.creatorName).toBe('DrakeOwner');
      expect(post.currentPlayers).toBe(1);
      expect(post.maxPlayers).toBe(4);
      expect(post.members).toContain('pilot-drake');
      expect(post.status).toBe('open');
      expect(post.guildId).toBe('guild-uee-001');
      expect(post.channelId).toBe('channel-lfg-001');
    });

    it('should set expiration based on provided minutes', () => {
      const before = Date.now();
      const post = service.createPost(
        'Trading' as any,
        'Laranite haul',
        'pilot-hull-c',
        'HullCaptain',
        3,
        'guild-corp',
        'ch-trade',
        30
      );

      const expectedExpiry = before + 30 * 60000;
      expect(post.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(post.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 100);
    });

    it('should default expiration to 60 minutes', () => {
      const before = Date.now();
      const post = service.createPost(
        'Combat' as any,
        'Bounty hunting',
        'pilot-vanguard',
        'VanguardPilot',
        2,
        'guild-merc',
        'ch-combat'
      );

      const expectedExpiry = before + 60 * 60000;
      expect(post.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 100);
    });
  });

  // ==================== GET POST ====================

  describe('getPost', () => {
    it('should retrieve an existing post by ID', () => {
      const created = service.createPost(
        'Exploration' as any,
        'Jump point scouting',
        'pilot-315p',
        'ScoutPilot',
        2,
        'guild-exp',
        'ch-exp'
      );

      const found = service.getPost(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent post', () => {
      const found = service.getPost('lfg-nonexistent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== JOIN POST ====================

  describe('joinPost', () => {
    it('should add a user to an open post', () => {
      const post = service.createPost(
        'Mining' as any,
        'Quantanium extraction',
        'pilot-mole',
        'MoleCaptain',
        3,
        'guild-miners',
        'ch-mining'
      );

      const updated = service.joinPost(post.id, 'pilot-prospector');
      expect(updated.members).toContain('pilot-prospector');
      expect(updated.currentPlayers).toBe(2);
    });

    it('should mark post as full when max players reached', () => {
      const post = service.createPost(
        'Racing' as any,
        'Daymar Rally',
        'pilot-razor',
        'RazorPilot',
        2,
        'guild-racers',
        'ch-race'
      );

      const updated = service.joinPost(post.id, 'pilot-m50');
      expect(updated.status).toBe('full');
      expect(updated.currentPlayers).toBe(2);
    });

    it('should throw if post not found', () => {
      expect(() => service.joinPost('lfg-ghost', 'pilot-1')).toThrow('LFG post not found');
    });

    it('should throw if post is closed', () => {
      const post = service.createPost(
        'Salvage' as any,
        'Reclaimer op',
        'pilot-reclaimer',
        'ReclaimerCrew',
        4,
        'guild-salvage',
        'ch-salvage'
      );
      service.closePost(post.id, 'pilot-reclaimer');

      expect(() => service.joinPost(post.id, 'pilot-vulture')).toThrow('This LFG post is closed');
    });

    it('should throw if post is already full', () => {
      const post = service.createPost(
        'Cargo' as any,
        'C2 run',
        'pilot-c2',
        'C2Captain',
        2,
        'guild-haulers',
        'ch-cargo'
      );
      service.joinPost(post.id, 'pilot-freelancer');

      expect(() => service.joinPost(post.id, 'pilot-caterpillar')).toThrow(
        'This group is already full'
      );
    });

    it('should throw if user already in group', () => {
      const post = service.createPost(
        'Combat' as any,
        'Xenothreat',
        'pilot-hornet',
        'HornetAce',
        4,
        'guild-fighters',
        'ch-combat'
      );

      expect(() => service.joinPost(post.id, 'pilot-hornet')).toThrow(
        'You are already in this group'
      );
    });

    it('should throw if post has expired and is marked closed during cleanup', () => {
      const post = service.createPost(
        'Refueling' as any,
        'Starfarer duty',
        'pilot-starfarer',
        'FuelCrew',
        3,
        'guild-logistics',
        'ch-fuel',
        1
      );

      // Advance time past expiration — cleanup marks post as closed first,
      // then removes it after the grace window.
      jest.advanceTimersByTime(2 * 60000);

      expect(() => service.joinPost(post.id, 'pilot-2')).toThrow('This LFG post is closed');
    });
  });

  // ==================== LEAVE POST ====================

  describe('leavePost', () => {
    it('should remove a user from the post', () => {
      const post = service.createPost(
        'Mining' as any,
        'Ore run',
        'pilot-captain',
        'Captain',
        4,
        'guild-1',
        'ch-1'
      );
      service.joinPost(post.id, 'pilot-crew');

      const updated = service.leavePost(post.id, 'pilot-crew');
      expect(updated.members).not.toContain('pilot-crew');
      expect(updated.currentPlayers).toBe(1);
    });

    it('should reopen a full post when someone leaves', () => {
      const post = service.createPost(
        'Bounty' as any,
        'VHRT bounties',
        'pilot-lead',
        'BountyLead',
        2,
        'guild-bounty',
        'ch-bounty'
      );
      service.joinPost(post.id, 'pilot-wing');
      expect(post.status).toBe('full');

      const updated = service.leavePost(post.id, 'pilot-wing');
      expect(updated.status).toBe('open');
    });

    it('should throw if post not found', () => {
      expect(() => service.leavePost('lfg-fake', 'pilot-1')).toThrow('LFG post not found');
    });

    it('should throw if user is not in the group', () => {
      const post = service.createPost(
        'Patrol' as any,
        'Stanton patrol',
        'pilot-avenger',
        'AvPilot',
        4,
        'guild-patrol',
        'ch-patrol'
      );

      expect(() => service.leavePost(post.id, 'pilot-stranger')).toThrow(
        'You are not in this group'
      );
    });

    it('should throw if creator tries to leave', () => {
      const post = service.createPost(
        'Delivery' as any,
        'Box run',
        'pilot-pisces',
        'PiscesPilot',
        3,
        'guild-delivery',
        'ch-delivery'
      );

      expect(() => service.leavePost(post.id, 'pilot-pisces')).toThrow(
        'Creator cannot leave. Use close instead'
      );
    });
  });

  // ==================== CLOSE POST ====================

  describe('closePost', () => {
    it('should close the post when creator requests', () => {
      const post = service.createPost(
        'Exploration' as any,
        'Cave exploration',
        'pilot-pathfinder',
        'PathFinder',
        5,
        'guild-explore',
        'ch-explore'
      );

      const closed = service.closePost(post.id, 'pilot-pathfinder');
      expect(closed.status).toBe('closed');
    });

    it('should throw if non-creator tries to close', () => {
      const post = service.createPost(
        'Medical' as any,
        'Cutlass Red medivac',
        'pilot-medic',
        'Medic',
        3,
        'guild-medical',
        'ch-medical'
      );

      expect(() => service.closePost(post.id, 'pilot-impostor')).toThrow(
        'Only the creator can close this LFG post'
      );
    });

    it('should throw if post not found', () => {
      expect(() => service.closePost('lfg-nope', 'pilot-1')).toThrow('LFG post not found');
    });
  });

  // ==================== DELETE POST ====================

  describe('deletePost', () => {
    it('should remove the post from in-memory storage', () => {
      const post = service.createPost(
        'Racing' as any,
        'Snake Pit race',
        'pilot-racer',
        'Racer',
        6,
        'guild-race',
        'ch-race'
      );

      service.deletePost(post.id);
      expect(service.getPost(post.id)).toBeUndefined();
    });

    it('should do nothing for non-existent post', () => {
      expect(() => service.deletePost('lfg-missing')).not.toThrow();
    });
  });

  // ==================== SESSION HISTORY ====================

  describe('recordSession', () => {
    it('should create history records for each participant', async () => {
      const result = await service.recordSession({
        lfgPostId: 'lfg-session-001',
        activity: 'Mining',
        description: 'Quantanium run in Aaron Halo',
        creatorId: 'pilot-mole-captain',
        creatorName: 'MoleCaptain',
        participantIds: ['pilot-mole-captain', 'pilot-hand-1', 'pilot-hand-2'],
        guildId: 'guild-miners',
        channelId: 'ch-mining',
        wasSuccessful: true,
        durationMinutes: 45,
      });

      expect(result).toHaveLength(3);
      expect(mockHistoryRepo.create).toHaveBeenCalledTimes(3);
      expect(mockHistoryRepo.save).toHaveBeenCalledTimes(3);
    });

    it('should pass completion notes when provided', async () => {
      await service.recordSession({
        lfgPostId: 'lfg-session-002',
        activity: 'Bounty Hunting',
        description: 'HRT bounties in Crusader',
        creatorId: 'pilot-bounty-lead',
        creatorName: 'BountyLead',
        participantIds: ['pilot-bounty-lead'],
        guildId: 'guild-bounty',
        channelId: 'ch-bounty',
        wasSuccessful: false,
        completionNotes: {
          submittedBy: 'pilot-bounty-lead',
          note: 'Ship destroyed by NPC Hammerhead',
          timestamp: new Date(),
        },
      });

      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wasSuccessful: false,
          completionNotes: expect.objectContaining({ note: 'Ship destroyed by NPC Hammerhead' }),
        })
      );
    });
  });

  // ==================== USER STATS ====================

  describe('getUserStats', () => {
    it('should return zero stats for user with no history', async () => {
      mockHistoryRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const stats = await service.getUserStats('pilot-newbie');

      expect(stats.totalSessions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.totalPlayersEncountered).toBe(0);
    });

    it('should calculate stats correctly', async () => {
      const mockHistory = [
        {
          activity: 'Mining',
          wasSuccessful: true,
          durationMinutes: 60,
          participantIds: ['pilot-main', 'pilot-buddy-1'],
        },
        {
          activity: 'Mining',
          wasSuccessful: true,
          durationMinutes: 30,
          participantIds: ['pilot-main', 'pilot-buddy-2'],
        },
        {
          activity: 'Combat',
          wasSuccessful: false,
          durationMinutes: 15,
          participantIds: ['pilot-main', 'pilot-buddy-1', 'pilot-buddy-3'],
        },
      ];

      mockHistoryRepo.createQueryBuilder().getMany.mockResolvedValue(mockHistory);

      const stats = await service.getUserStats('pilot-main');

      expect(stats.totalSessions).toBe(3);
      expect(stats.successfulSessions).toBe(2);
      expect(stats.failedSessions).toBe(1);
      expect(stats.successRate).toBe(67); // 2/3 rounded
      expect(stats.averageDuration).toBe(35); // (60+30+15)/3 rounded
      expect(stats.favoriteActivity).toBe('Mining');
      expect(stats.totalPlayersEncountered).toBe(3);
    });
  });

  // ==================== USER HISTORY ====================

  describe('getUserHistory', () => {
    it('should query history with default limit', async () => {
      await service.getUserHistory('pilot-veteran');

      const qb = mockHistoryRepo.createQueryBuilder();
      expect(qb.where).toHaveBeenCalledWith('history.userId = :userId', {
        userId: 'pilot-veteran',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('history.completedAt', 'DESC');
      expect(qb.limit).toHaveBeenCalledWith(50);
    });

    it('should respect custom limit', async () => {
      await service.getUserHistory('pilot-veteran', 10);

      const qb = mockHistoryRepo.createQueryBuilder();
      expect(qb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getUserHistoryByActivity', () => {
    it('should filter by activity type', async () => {
      await service.getUserHistoryByActivity('pilot-miner', 'Mining');

      const qb = mockHistoryRepo.createQueryBuilder();
      expect(qb.where).toHaveBeenCalledWith('history.userId = :userId', { userId: 'pilot-miner' });
      expect(qb.andWhere).toHaveBeenCalledWith('history.activity = :activity', {
        activity: 'Mining',
      });
    });
  });

  // ==================== RECENT SESSIONS ====================

  describe('getRecentSessions', () => {
    it('should get recent sessions for a guild', async () => {
      await service.getRecentSessions('guild-stanton', 10);

      const qb = mockHistoryRepo.createQueryBuilder();
      expect(qb.where).toHaveBeenCalledWith('history.guildId = :guildId', {
        guildId: 'guild-stanton',
      });
      expect(qb.limit).toHaveBeenCalledWith(10);
    });
  });

  // ==================== SHARED SESSIONS ====================

  describe('getSharedSessions', () => {
    it('should find sessions two users participated in together', async () => {
      const mockHistory = [
        { id: 's1', participantIds: ['pilot-a', 'pilot-b', 'pilot-c'] },
        { id: 's2', participantIds: ['pilot-a', 'pilot-d'] },
        { id: 's3', participantIds: ['pilot-a', 'pilot-b'] },
      ];
      mockHistoryRepo.createQueryBuilder().getMany.mockResolvedValue(mockHistory);

      const shared = await service.getSharedSessions('pilot-a', 'pilot-b');

      expect(shared).toHaveLength(2);
      expect(shared[0].id).toBe('s1');
      expect(shared[1].id).toBe('s3');
    });
  });

  // ==================== CLEANUP ====================

  describe('cleanupOldHistory', () => {
    it('should delete records older than specified days', async () => {
      mockHistoryRepo.createQueryBuilder().execute.mockResolvedValue({ affected: 42 });

      const deleted = await service.cleanupOldHistory(90);

      expect(deleted).toBe(42);
      const qb = mockHistoryRepo.createQueryBuilder();
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  describe('clearAllPosts', () => {
    it('should remove all in-memory posts', () => {
      service.createPost('Mining' as any, 'Test 1', 'p1', 'P1', 2, 'g1', 'c1');
      service.createPost('Combat' as any, 'Test 2', 'p2', 'P2', 4, 'g1', 'c1');

      service.clearAllPosts();
      expect(service.getPost('anything')).toBeUndefined();
    });
  });

  // ==================== STOP CLEANUP ====================

  describe('stopCleanup', () => {
    it('should stop the cleanup interval without error', () => {
      expect(() => service.stopCleanup()).not.toThrow();
    });

    it('should handle being called multiple times', () => {
      service.stopCleanup();
      expect(() => service.stopCleanup()).not.toThrow();
    });
  });
});
