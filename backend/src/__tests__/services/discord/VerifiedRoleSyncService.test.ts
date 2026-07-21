/**
 * VerifiedRoleSyncService Tests
 *
 * Tests the "Verified" Discord role auto-assignment logic:
 * - Assigns role when RSI verification completes
 * - Removes role when verification is revoked
 * - Creates role if it doesn't exist
 * - Reuses existing role if found
 * - Handles missing guild/member gracefully
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mocks ──────────────────────────────────────────────────────────

/** Minimal Discord.js Collection-like Map with a find() method */
function createRoleCache() {
  const map = new Map<string, any>();
  (map as any).find = (fn: (v: any) => boolean) => {
    for (const v of map.values()) {
      if (fn(v)) return v;
    }
    return undefined;
  };
  return map;
}

const mockRolesAdd = jest.fn().mockResolvedValue(undefined);
const mockRolesRemove = jest.fn().mockResolvedValue(undefined);
const mockRolesCreate = jest.fn();
const mockMembersFetch = jest.fn();

const guildRolesCache = createRoleCache();

const mockGuild = {
  id: 'guild-1',
  name: 'Test Guild',
  roles: {
    cache: guildRolesCache,
    create: mockRolesCreate,
  },
  members: { fetch: mockMembersFetch },
} as any;

const mockClient = {
  guilds: { cache: new Map<string, any>([['guild-1', mockGuild]]) },
} as any;

jest.mock('../../../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: () => ({
      isReady: () => true,
      getClient: () => mockClient,
    }),
  },
}));

const mockGetSettings = jest.fn();
const mockGetOrCreateSettings = jest.fn();
const mockUpdateRoleSyncSettings = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  DiscordSettingsService: jest.fn().mockImplementation(() => ({
    getSettings: mockGetSettings,
    getOrCreateSettings: mockGetOrCreateSettings,
    updateRoleSyncSettings: mockUpdateRoleSyncSettings,
  })),
}));

const mockGetGuildsForOrganization = jest.fn();

jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: () => ({
      getGuildsForOrganization: mockGetGuildsForOrganization,
    }),
  },
}));

import { VerifiedRoleSyncService } from '../../../services/discord/VerifiedRoleSyncService';

// ─── Tests ──────────────────────────────────────────────────────────

describe('VerifiedRoleSyncService', () => {
  let service: VerifiedRoleSyncService;

  const verifiedRole = { id: 'role-verified', name: '✅ Verified' };
  const mockMember = {
    roles: {
      cache: new Map<string, any>(),
      add: mockRolesAdd,
      remove: mockRolesRemove,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (VerifiedRoleSyncService as any).instance = null;
    service = VerifiedRoleSyncService.getInstance();

    // Default guild mapping
    mockGetGuildsForOrganization.mockResolvedValue([
      { guildId: 'guild-1', organizationId: 'org-1', isActive: true },
    ]);

    // Default settings with no role configured yet
    mockGetOrCreateSettings.mockResolvedValue({ roleSyncSettings: {} });
    mockGetSettings.mockResolvedValue({ roleSyncSettings: {} });

    // Default: member exists, no roles
    mockMembersFetch.mockResolvedValue(mockMember);
    mockMember.roles.cache.clear();

    // Role creation returns a new role
    mockRolesCreate.mockResolvedValue(verifiedRole);

    // Guild roles cache
    guildRolesCache.clear();
  });

  // ═══════════════════════════════════════════════════════════════════
  //  assignVerifiedRole
  // ═══════════════════════════════════════════════════════════════════

  describe('assignVerifiedRole', () => {
    it('should create the role and assign it to the member', async () => {
      await service.assignVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: '✅ Verified' })
      );
      expect(mockRolesAdd).toHaveBeenCalledWith(verifiedRole, 'RSI verification completed');
    });

    it('should reuse existing role from settings if still in guild', async () => {
      mockGetOrCreateSettings.mockResolvedValue({
        roleSyncSettings: { verifiedRoleId: 'role-verified' },
      });
      mockGuild.roles.cache.set('role-verified', verifiedRole);

      await service.assignVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesCreate).not.toHaveBeenCalled();
      expect(mockRolesAdd).toHaveBeenCalledWith(verifiedRole, 'RSI verification completed');
    });

    it('should skip if member already has the role', async () => {
      mockGetOrCreateSettings.mockResolvedValue({
        roleSyncSettings: { verifiedRoleId: 'role-verified' },
      });
      mockGuild.roles.cache.set('role-verified', verifiedRole);
      mockMember.roles.cache.set('role-verified', verifiedRole);

      await service.assignVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesAdd).not.toHaveBeenCalled();
    });

    it('should skip if no guilds are linked to the org', async () => {
      mockGetGuildsForOrganization.mockResolvedValue([]);

      await service.assignVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesAdd).not.toHaveBeenCalled();
    });

    it('should skip if member is not in the guild', async () => {
      mockMembersFetch.mockResolvedValue(null);

      await service.assignVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesAdd).not.toHaveBeenCalled();
    });

    it('should not throw on errors (graceful degradation)', async () => {
      mockMembersFetch.mockRejectedValue(new Error('Discord API error'));

      await expect(service.assignVerifiedRole('discord-1', ['org-1'])).resolves.toBeUndefined();
    });

    it('should handle empty discordId', async () => {
      await service.assignVerifiedRole('', ['org-1']);

      expect(mockGetGuildsForOrganization).not.toHaveBeenCalled();
    });

    it('should handle empty orgIds', async () => {
      await service.assignVerifiedRole('discord-1', []);

      expect(mockGetGuildsForOrganization).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  removeVerifiedRole
  // ═══════════════════════════════════════════════════════════════════

  describe('removeVerifiedRole', () => {
    it('should remove the verified role from the member', async () => {
      mockGetSettings.mockResolvedValue({
        roleSyncSettings: { verifiedRoleId: 'role-verified' },
      });
      mockMember.roles.cache.set('role-verified', verifiedRole);

      await service.removeVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesRemove).toHaveBeenCalledWith('role-verified', 'RSI verification removed');
    });

    it('should skip if no verifiedRoleId is configured', async () => {
      mockGetSettings.mockResolvedValue({ roleSyncSettings: {} });

      await service.removeVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesRemove).not.toHaveBeenCalled();
    });

    it('should skip if member does not have the role', async () => {
      mockGetSettings.mockResolvedValue({
        roleSyncSettings: { verifiedRoleId: 'role-verified' },
      });
      // Member doesn't have the role
      mockMember.roles.cache.clear();

      await service.removeVerifiedRole('discord-1', ['org-1']);

      expect(mockRolesRemove).not.toHaveBeenCalled();
    });

    it('should not throw on errors', async () => {
      mockGetSettings.mockRejectedValue(new Error('DB error'));

      await expect(service.removeVerifiedRole('discord-1', ['org-1'])).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  setupVerifiedRole
  // ═══════════════════════════════════════════════════════════════════

  describe('setupVerifiedRole', () => {
    it('should create a role and persist it', async () => {
      const role = await service.setupVerifiedRole(mockGuild, 'org-1');

      expect(mockRolesCreate).toHaveBeenCalled();
      expect(mockUpdateRoleSyncSettings).toHaveBeenCalledWith(
        'org-1',
        'guild-1',
        { verifiedRoleId: verifiedRole.id },
        'system:verified-role-sync'
      );
      expect(role).toEqual(verifiedRole);
    });

    it('should use an existing role when roleId is provided', async () => {
      mockGuild.roles.cache.set('custom-role', { id: 'custom-role', name: 'RSI Verified' });

      const role = await service.setupVerifiedRole(mockGuild, 'org-1', 'custom-role');

      expect(mockRolesCreate).not.toHaveBeenCalled();
      expect(role).toEqual({ id: 'custom-role', name: 'RSI Verified' });
    });

    it('should return null if specified role not found in guild', async () => {
      const role = await service.setupVerifiedRole(mockGuild, 'org-1', 'nonexistent');

      expect(role).toBeNull();
    });
  });
});
