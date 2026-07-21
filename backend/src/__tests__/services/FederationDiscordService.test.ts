jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationDiscordService } from '../../services/federation/FederationDiscordService';

describe('FederationDiscordService', () => {
  let service: FederationDiscordService;
  let mockFedRepo: { findOne: jest.Mock; save: jest.Mock };
  let mockMemberRepo: { find: jest.Mock; findOne: jest.Mock };
  let mockMembershipRepo: { find: jest.Mock };
  let mockUserRepo: { findOne: jest.Mock };
  let mockAmbassadorService: { hasPermission: jest.Mock };

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';
  const GUILD_ID = '123456789012345678';

  beforeEach(() => {
    jest.clearAllMocks();

    mockFedRepo = { findOne: jest.fn(), save: jest.fn() };
    mockMemberRepo = { find: jest.fn(), findOne: jest.fn() };
    mockMembershipRepo = { find: jest.fn() };
    mockUserRepo = { findOne: jest.fn() };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'Federation') return mockFedRepo;
      if (name === 'FederationMember') return mockMemberRepo;
      if (name === 'OrganizationMembership') return mockMembershipRepo;
      if (name === 'User') return mockUserRepo;
      return {};
    });

    mockAmbassadorService = { hasPermission: jest.fn() };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationDiscordService();
  });

  describe('setupCentralGuild', () => {
    it('should configure a central guild', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const federation = { id: FEDERATION_ID, settings: {} };
      mockFedRepo.findOne.mockResolvedValue(federation);
      mockFedRepo.save.mockResolvedValue(federation);

      const result = await service.setupCentralGuild(
        FEDERATION_ID,
        USER_ID,
        GUILD_ID,
        'Test Server'
      );

      expect(result.enabled).toBe(true);
      expect(result.centralGuildId).toBe(GUILD_ID);
    });
  });

  describe('unlinkCentralGuild', () => {
    it('should remove central guild configuration', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const federation = {
        id: FEDERATION_ID,
        settings: { enableCentralDiscord: true, centralGuildId: GUILD_ID },
      };
      mockFedRepo.findOne.mockResolvedValue(federation);
      mockFedRepo.save.mockResolvedValue(federation);

      const result = await service.unlinkCentralGuild(FEDERATION_ID, USER_ID);

      expect(result.enabled).toBe(false);
      expect(result.centralGuildId).toBeNull();
    });
  });

  describe('resolveUserRoles', () => {
    it('should return null roles for unknown Discord user', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: { enableCentralDiscord: true, centralGuildId: GUILD_ID },
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveUserRoles(FEDERATION_ID, 'discord-xyz');

      expect(result.orgRoleId).toBeNull();
      expect(result.conflict).toBe(false);
    });

    it('should assign roles for user in exactly one member org', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: {
          enableCentralDiscord: true,
          centralGuildId: GUILD_ID,
          orgRoleMappings: { 'org-1': 'discord-role-org-1' },
          hierarchyRoleMappings: { member: 'discord-role-member' },
        },
      });
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', discordId: 'discord-1' });
      mockMemberRepo.find.mockResolvedValue([
        {
          organizationId: 'org-1',
          organizationName: 'Alpha Corp',
          role: 'member',
          status: 'active',
        },
      ]);
      mockMembershipRepo.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', isActive: true },
      ]);

      const result = await service.resolveUserRoles(FEDERATION_ID, 'discord-1');

      expect(result.orgRoleId).toBe('discord-role-org-1');
      expect(result.hierarchyRoleId).toBe('discord-role-member');
      expect(result.conflict).toBe(false);
    });

    it('should flag conflict for user in multiple member orgs and persist it', async () => {
      const federation = {
        id: FEDERATION_ID,
        settings: { enableCentralDiscord: true, centralGuildId: GUILD_ID },
      };
      mockFedRepo.findOne.mockResolvedValue(federation);
      mockFedRepo.save.mockResolvedValue(federation);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        username: 'TestUser',
        discordId: 'discord-1',
      });
      mockMemberRepo.find.mockResolvedValue([
        {
          organizationId: 'org-1',
          organizationName: 'Alpha Corp',
          role: 'member',
          status: 'active',
        },
        {
          organizationId: 'org-2',
          organizationName: 'Beta Inc',
          role: 'council',
          status: 'active',
        },
      ]);
      mockMembershipRepo.find.mockResolvedValue([
        { userId: 'user-1', organizationId: 'org-1', isActive: true },
        { userId: 'user-1', organizationId: 'org-2', isActive: true },
      ]);

      const result = await service.resolveUserRoles(FEDERATION_ID, 'discord-1');

      expect(result.conflict).toBe(true);
      expect(result.conflictingOrgs).toHaveLength(2);
      expect(result.orgRoleId).toBeNull();

      // Verify conflict was persisted to federation settings
      expect(mockFedRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            discordConflicts: expect.arrayContaining([
              expect.objectContaining({
                discordUserId: 'discord-1',
                discordUsername: 'TestUser',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('resolveConflict', () => {
    it('should resolve a conflict by choosing an org and persist removal', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const federation = {
        id: FEDERATION_ID,
        settings: {
          orgRoleMappings: { 'org-1': 'role-1' },
          hierarchyRoleMappings: { member: 'role-m' },
          discordConflicts: [
            {
              discordUserId: 'discord-1',
              discordUsername: 'TestUser',
              conflictingOrgs: [
                { orgId: 'org-1', orgName: 'Alpha' },
                { orgId: 'org-2', orgName: 'Beta' },
              ],
              flaggedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      };
      mockFedRepo.findOne.mockResolvedValue(federation);
      mockFedRepo.save.mockResolvedValue(federation);
      mockMemberRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: 'member',
        status: 'active',
      });

      const result = await service.resolveConflict(FEDERATION_ID, USER_ID, 'discord-1', 'org-1');

      expect(result.orgRoleId).toBe('role-1');
      expect(result.hierarchyRoleId).toBe('role-m');

      // Verify conflict was removed from persisted queue
      expect(mockFedRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            discordConflicts: [],
          }),
        })
      );
    });

    it('should reject invalid chosen org', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, settings: {} });
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolveConflict(FEDERATION_ID, USER_ID, 'discord-1', 'invalid-org')
      ).rejects.toThrow('not an active federation member');
    });
  });

  describe('getStatus', () => {
    it('should return disabled status when not configured', async () => {
      mockFedRepo.findOne.mockResolvedValue({ id: FEDERATION_ID, settings: {} });

      const result = await service.getStatus(FEDERATION_ID);

      expect(result.enabled).toBe(false);
      expect(result.centralGuildId).toBeNull();
    });

    it('should include conflict count from persisted settings', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: {
          enableCentralDiscord: true,
          centralGuildId: GUILD_ID,
          discordConflicts: [
            {
              discordUserId: 'discord-1',
              discordUsername: 'User1',
              conflictingOrgs: [],
              flaggedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      });

      const result = await service.getStatus(FEDERATION_ID);

      expect(result.conflictCount).toBe(1);
    });
  });

  describe('getConflictQueue', () => {
    it('should return persisted conflicts from federation settings', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const conflicts = [
        {
          discordUserId: 'discord-1',
          discordUsername: 'User1',
          conflictingOrgs: [
            { orgId: 'org-1', orgName: 'Alpha' },
            { orgId: 'org-2', orgName: 'Beta' },
          ],
          flaggedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: { discordConflicts: conflicts },
      });

      const result = await service.getConflictQueue(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].discordUserId).toBe('discord-1');
    });

    it('should return empty array when no conflicts exist', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: {},
      });

      const result = await service.getConflictQueue(FEDERATION_ID, USER_ID);

      expect(result).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
