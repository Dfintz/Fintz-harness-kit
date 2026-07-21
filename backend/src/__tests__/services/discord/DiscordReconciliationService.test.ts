/**
 * DiscordReconciliationService Tests
 *
 * Tests the periodic member/role reconciliation logic:
 * - Skips when no guilds have role sync enabled
 * - Respects syncIntervalMinutes (skips guilds not due)
 * - Assigns verified role to members missing it
 * - Removes managed roles from users no longer in the org
 * - Syncs nicknames when enabled
 * - Handles bot being offline gracefully
 * - Skips bot users
 * - Caps errors at 50 per guild
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock data ──────────────────────────────────────────────────────

const mockRolesAdd = jest.fn().mockResolvedValue(undefined);
const mockRolesRemove = jest.fn().mockResolvedValue(undefined);
const mockSetNickname = jest.fn().mockResolvedValue(undefined);

function createMockMember(
  id: string,
  opts: {
    bot?: boolean;
    roles?: string[];
    nickname?: string | null;
    isOwner?: boolean;
  } = {}
) {
  const roleCache = new Map<string, any>();
  for (const r of opts.roles ?? []) {
    roleCache.set(r, { id: r });
  }
  return {
    user: { id, bot: opts.bot ?? false },
    roles: {
      cache: roleCache,
      add: mockRolesAdd,
      remove: mockRolesRemove,
    },
    displayName: `User ${id}`,
    nickname: opts.nickname ?? null,
    id,
    guild: { ownerId: opts.isOwner ? id : 'other-owner', id: 'guild-1' },
    setNickname: mockSetNickname,
  } as any;
}

function createMembersCollection(members: any[]) {
  const col = new Map<string, any>();
  for (const m of members) {
    col.set(m.user.id, m);
  }
  // Add [Symbol.iterator] and size to match Collection
  return col;
}

const mockGuildMembersFetch = jest.fn();
const mockGuild = {
  id: 'guild-1',
  name: 'Test Guild',
  members: { fetch: mockGuildMembersFetch },
} as any;

const mockClient = {
  guilds: { cache: new Map<string, any>([['guild-1', mockGuild]]) },
  isReady: () => true,
} as any;

// ─── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: () => ({
      getClient: () => mockClient,
    }),
  },
}));

const mockMarkSynced = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  DiscordSettingsService: jest.fn().mockImplementation(() => ({
    markSynced: mockMarkSynced,
  })),
}));

const mockFindSettings = jest.fn();
const mockFindOrgMembers = jest.fn();
const mockFindUsers = jest.fn();

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation((entity: any) => {
      const name = entity?.name ?? entity;
      if (name === 'DiscordGuildSettings') {
        return { find: mockFindSettings };
      }
      if (name === 'OrganizationMembership') {
        return { find: mockFindOrgMembers };
      }
      if (name === 'User') {
        return { find: mockFindUsers };
      }
      return { find: jest.fn().mockResolvedValue([]) };
    }),
  },
}));

// Must import after mocks are in place
import { DiscordReconciliationService } from '../../../services/discord/DiscordReconciliationService';

// ─── Helpers ────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<any> = {}) {
  return {
    guildId: 'guild-1',
    organizationId: 'org-1',
    roleSyncSettings: {
      enabled: true,
      syncIntervalMinutes: 60,
      removeRolesOnLeave: true,
      verifiedRoleId: 'role-verified',
      syncNicknames: false,
      roleMappings: {},
      ...overrides.roleSyncSettings,
    },
    lastSyncedAt: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('DiscordReconciliationService', () => {
  let service: DiscordReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    (DiscordReconciliationService as any).instance = null;
    service = DiscordReconciliationService.getInstance();
    // Override the delay to speed up tests
    (service as any).delay = () => Promise.resolve();
  });

  describe('runPass', () => {
    it('should skip when no guilds have role sync enabled', async () => {
      mockFindSettings.mockResolvedValue([makeSettings({ roleSyncSettings: { enabled: false } })]);

      const result = await service.runPass();

      expect(result.guildsProcessed).toBe(0);
      expect(result.guildsSkipped).toBe(0);
      expect(mockMarkSynced).not.toHaveBeenCalled();
    });

    it('should skip guilds not yet due for sync', async () => {
      mockFindSettings.mockResolvedValue([
        makeSettings({
          lastSyncedAt: new Date(), // just synced
          roleSyncSettings: { enabled: true, syncIntervalMinutes: 60 },
        }),
      ]);

      const result = await service.runPass();

      expect(result.guildsProcessed).toBe(0);
      // loadDueSettings returns null when nothing due → emptyPassResult
      expect(result.guildsSkipped).toBe(0);
    });

    it('should force-process all guilds when force=true', async () => {
      const members = createMembersCollection([]);
      mockGuildMembersFetch.mockResolvedValue(members);
      mockFindSettings.mockResolvedValue([
        makeSettings({
          lastSyncedAt: new Date(), // just synced
          roleSyncSettings: { enabled: true, syncIntervalMinutes: 60 },
        }),
      ]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass(true);

      expect(result.guildsProcessed).toBe(1);
    });

    it('should process guilds that are due for sync', async () => {
      const members = createMembersCollection([]);
      mockGuildMembersFetch.mockResolvedValue(members);
      mockFindSettings.mockResolvedValue([
        makeSettings({
          lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          roleSyncSettings: { enabled: true, syncIntervalMinutes: 60 },
        }),
      ]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass();

      expect(result.guildsProcessed).toBe(1);
      expect(mockMarkSynced).toHaveBeenCalledWith('org-1', 'guild-1', undefined);
    });

    it('should prevent concurrent passes', async () => {
      const members = createMembersCollection([]);
      mockGuildMembersFetch.mockResolvedValue(members);
      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      // Start first pass (will be processing)
      const pass1 = service.runPass();
      // Start second pass while first is running
      const pass2 = service.runPass();

      const [result1, result2] = await Promise.all([pass1, pass2]);

      // One should process, the other should return empty
      expect(result1.guildsProcessed + result2.guildsProcessed).toBe(1);
    });
  });

  describe('reconcileMember', () => {
    it('should assign verified role to org member missing it', async () => {
      const member = createMockMember('discord-1', { roles: [] });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([{ userId: 'user-1' }]);
      mockFindUsers.mockResolvedValue([
        { id: 'user-1', discordId: 'discord-1', rsiHandle: 'TestPilot' },
      ]);

      const result = await service.runPass();

      expect(result.totalRolesAssigned).toBe(1);
      expect(mockRolesAdd).toHaveBeenCalledWith('role-verified', 'Reconciliation: verified role');
    });

    it('should not re-assign verified role if already present', async () => {
      const member = createMockMember('discord-1', { roles: ['role-verified'] });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([{ userId: 'user-1' }]);
      mockFindUsers.mockResolvedValue([
        { id: 'user-1', discordId: 'discord-1', rsiHandle: 'TestPilot' },
      ]);

      const result = await service.runPass();

      expect(result.totalRolesAssigned).toBe(0);
      expect(mockRolesAdd).not.toHaveBeenCalled();
    });

    it('should remove managed roles from users not in the org', async () => {
      // Discord member has verified role but is not an org member
      const member = createMockMember('discord-stranger', {
        roles: ['role-verified'],
      });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([]); // no org members
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass();

      expect(result.totalRolesRemoved).toBe(1);
      expect(mockRolesRemove).toHaveBeenCalledWith(
        'role-verified',
        'Reconciliation: user not in org'
      );
    });

    it('should not remove roles when removeRolesOnLeave is false', async () => {
      const member = createMockMember('discord-stranger', {
        roles: ['role-verified'],
      });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([
        makeSettings({
          roleSyncSettings: {
            enabled: true,
            removeRolesOnLeave: false,
            verifiedRoleId: 'role-verified',
          },
        }),
      ]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass();

      expect(result.totalRolesRemoved).toBe(0);
      expect(mockRolesRemove).not.toHaveBeenCalled();
    });

    it('should skip bot users', async () => {
      const botMember = createMockMember('bot-1', { bot: true });
      const members = createMembersCollection([botMember]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass();

      expect(mockRolesAdd).not.toHaveBeenCalled();
      expect(mockRolesRemove).not.toHaveBeenCalled();
    });

    it('should sync nicknames when enabled', async () => {
      const member = createMockMember('discord-1', {
        roles: ['role-verified'],
        nickname: 'OldNick',
      });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([
        makeSettings({
          roleSyncSettings: {
            enabled: true,
            verifiedRoleId: 'role-verified',
            syncNicknames: true,
            nicknameFormat: '{rsiHandle}',
          },
        }),
      ]);
      mockFindOrgMembers.mockResolvedValue([{ userId: 'user-1' }]);
      mockFindUsers.mockResolvedValue([
        { id: 'user-1', discordId: 'discord-1', rsiHandle: 'TestPilot' },
      ]);

      const result = await service.runPass();

      expect(result.totalNicknamesSynced).toBe(1);
      expect(mockSetNickname).toHaveBeenCalledWith('TestPilot', 'Reconciliation: nickname sync');
    });

    it('should not sync nickname when it already matches', async () => {
      const member = createMockMember('discord-1', {
        roles: ['role-verified'],
        nickname: 'TestPilot',
      });
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([
        makeSettings({
          roleSyncSettings: {
            enabled: true,
            verifiedRoleId: 'role-verified',
            syncNicknames: true,
          },
        }),
      ]);
      mockFindOrgMembers.mockResolvedValue([{ userId: 'user-1' }]);
      mockFindUsers.mockResolvedValue([
        { id: 'user-1', discordId: 'discord-1', rsiHandle: 'TestPilot' },
      ]);

      const result = await service.runPass();

      expect(result.totalNicknamesSynced).toBe(0);
      expect(mockSetNickname).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle role removal failures gracefully without crashing', async () => {
      // Member whose roles.remove throws — safeRemoveRole catches this
      const member = createMockMember('discord-stranger', {
        roles: ['role-verified'],
      });
      member.roles.remove = jest.fn().mockRejectedValue(new Error('Missing Permissions'));
      const members = createMembersCollection([member]);
      mockGuildMembersFetch.mockResolvedValue(members);

      mockFindSettings.mockResolvedValue([makeSettings()]);
      mockFindOrgMembers.mockResolvedValue([]);
      mockFindUsers.mockResolvedValue([]);

      const result = await service.runPass();

      // safeRemoveRole catches the error — no crash, role not counted as removed
      expect(result.guildsProcessed).toBe(1);
      expect(result.totalRolesRemoved).toBe(0);
      // markSynced still called (pass completed)
      expect(mockMarkSynced).toHaveBeenCalledWith('org-1', 'guild-1', undefined);
    });

    it('should handle guild not in bot cache', async () => {
      mockFindSettings.mockResolvedValue([makeSettings({ guildId: 'unknown-guild' })]);

      const result = await service.runPass();

      expect(result.guildsProcessed).toBe(0);
      expect(result.guildsSkipped).toBe(1);
    });

    it('should handle bot client not ready', async () => {
      const origGetClient = mockClient.isReady;
      mockClient.isReady = () => false;

      // Need a fresh instance that will get the non-ready client
      (DiscordReconciliationService as any).instance = null;
      const freshService = DiscordReconciliationService.getInstance();

      mockFindSettings.mockResolvedValue([makeSettings()]);

      const result = await freshService.runPass();

      expect(result.guildsProcessed).toBe(0);
      mockClient.isReady = origGetClient;
    });
  });
});
