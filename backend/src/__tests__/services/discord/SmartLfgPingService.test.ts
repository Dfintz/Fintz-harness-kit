/**
 * SmartLfgPingService Tests
 *
 * Tests for the Smart LFG Ping Service:
 * - Finding online candidates
 * - Cooldown management
 * - Activity filter
 * - Opt-in role filter
 * - DM sending with error handling
 * - Max pings per post limit
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
    DEFAULT_SMART_LFG_PING_SETTINGS,
    SmartLfgPingService,
    SmartLfgPingSettings,
} from '../../../services/discord/SmartLfgPingService';
import { LFGActivity, LFGPost } from '../../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): SmartLfgPingService {
  (SmartLfgPingService as any).instance = undefined;
  const svc = SmartLfgPingService.getInstance();
  return svc;
}

function createMockMember(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    user: { bot: false, tag: `User#${id}` },
    presence: { status: 'online' },
    roles: {
      cache: new Map(overrides.roles || []),
    },
    guild: { id: 'guild-1' },
    ...overrides,
  };
}

function createMockGuild(members: any[]) {
  const cache = new Map();
  for (const m of members) {
    cache.set(m.id, m);
  }
  return {
    id: 'guild-1',
    name: 'Test Guild',
    members: {
      cache,
      fetch: jest.fn().mockResolvedValue(cache),
    },
  };
}

function createMockClient(guild: any) {
  const mockUser = {
    send: jest.fn().mockResolvedValue({}),
  };
  return {
    guilds: {
      fetch: jest.fn().mockResolvedValue(guild),
    },
    users: {
      fetch: jest.fn().mockResolvedValue(mockUser),
    },
    _mockUser: mockUser,
  };
}

function createMockPost(overrides: Partial<LFGPost> = {}): LFGPost {
  return {
    id: 'post-1',
    activity: LFGActivity.MINING,
    description: 'Lets mine!',
    creatorId: 'creator-1',
    creatorName: 'Creator',
    currentPlayers: 1,
    maxPlayers: 4,
    members: ['creator-1'],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    guildId: 'guild-1',
    channelId: 'channel-1',
    status: 'open',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SmartLfgPingService', () => {
  afterEach(() => {
    const svc = SmartLfgPingService.getInstance();
    svc.shutdown();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      (SmartLfgPingService as any).instance = undefined;
      const a = SmartLfgPingService.getInstance();
      const b = SmartLfgPingService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('DEFAULT_SMART_LFG_PING_SETTINGS', () => {
    it('should be disabled by default', () => {
      expect(DEFAULT_SMART_LFG_PING_SETTINGS.enabled).toBe(false);
    });

    it('should have 8 hour cooldown', () => {
      expect(DEFAULT_SMART_LFG_PING_SETTINGS.cooldownHours).toBe(8);
    });

    it('should have max 5 pings per post', () => {
      expect(DEFAULT_SMART_LFG_PING_SETTINGS.maxPingsPerPost).toBe(5);
    });
  });

  describe('notifyMatchingMembers', () => {
    it('should return 0 when disabled', async () => {
      const service = getService();
      const settings: SmartLfgPingSettings = {
        ...DEFAULT_SMART_LFG_PING_SETTINGS,
        enabled: false,
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(0);
    });

    it('should return 0 when no client initialized', async () => {
      const service = getService();
      const settings: SmartLfgPingSettings = {
        ...DEFAULT_SMART_LFG_PING_SETTINGS,
        enabled: true,
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(0);
    });

    it('should ping online members who are not the creator', async () => {
      const service = getService();
      const members = [
        createMockMember('creator-1'), // post creator — should skip
        createMockMember('member-1'), // online — should ping
        createMockMember('member-2'), // online — should ping
      ];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 5,
        activityFilter: [],
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(2); // member-1 + member-2
      expect(client.users.fetch).toHaveBeenCalledTimes(2);
    });

    it('should skip offline members', async () => {
      const service = getService();
      const members = [
        createMockMember('member-1', { presence: { status: 'online' } }),
        createMockMember('member-2', { presence: { status: 'offline' } }),
        createMockMember('member-3', { presence: { status: 'dnd' } }),
        createMockMember('member-4', { presence: null }),
      ];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 10,
        activityFilter: [],
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(1); // only member-1
    });

    it('should skip bots', async () => {
      const service = getService();
      const members = [
        createMockMember('bot-1', { user: { bot: true, tag: 'Bot#0000' } }),
        createMockMember('member-1'),
      ];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 10,
        activityFilter: [],
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(1); // only member-1
    });

    it('should skip members already in the post', async () => {
      const service = getService();
      const members = [
        createMockMember('existing-member'),
        createMockMember('new-member'),
      ];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const post = createMockPost({ members: ['creator-1', 'existing-member'] });
      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 10,
        activityFilter: [],
      };

      const result = await service.notifyMatchingMembers(post, settings);
      expect(result).toBe(1); // only new-member
    });

    it('should respect maxPingsPerPost limit', async () => {
      const service = getService();
      const members = Array.from({ length: 20 }, (_, i) =>
        createMockMember(`member-${i}`)
      );
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 3,
        activityFilter: [],
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(3);
    });

    it('should filter by activity type', async () => {
      const service = getService();
      const members = [createMockMember('member-1')];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const post = createMockPost({ activity: LFGActivity.MINING });
      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 5,
        activityFilter: [LFGActivity.PVP], // Only PvP — should skip Mining post
      };

      const result = await service.notifyMatchingMembers(post, settings);
      expect(result).toBe(0);
    });

    it('should respect opt-in role filter', async () => {
      const service = getService();
      const memberWithRole = createMockMember('member-with-role');
      memberWithRole.roles.cache.set('lfg-role', { id: 'lfg-role' });
      const members = [
        memberWithRole,
        createMockMember('member-without-role'),
      ];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 10,
        activityFilter: [],
        optInRoleId: 'lfg-role',
      };

      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(1); // only member-with-role
    });

    it('should handle DM failures gracefully', async () => {
      const service = getService();
      const members = [createMockMember('member-1')];
      const guild = createMockGuild(members);
      const client = createMockClient(guild);
      client.users.fetch.mockResolvedValue({
        send: jest.fn().mockRejectedValue(new Error('Cannot send DMs')),
      });
      service.initialize(client as any);

      const settings: SmartLfgPingSettings = {
        enabled: true,
        cooldownHours: 8,
        maxPingsPerPost: 5,
        activityFilter: [],
      };

      // Should not throw
      const result = await service.notifyMatchingMembers(createMockPost(), settings);
      expect(result).toBe(0); // DM failed so 0 successful pings
    });
  });
});
