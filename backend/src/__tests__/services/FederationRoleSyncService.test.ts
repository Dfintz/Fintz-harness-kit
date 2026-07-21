jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: jest.fn(() => ({
      getClient: jest.fn(() => ({
        isReady: jest.fn(() => false),
      })),
    })),
  },
}));

import { AppDataSource } from '../../data-source';
import { FederationRoleSyncService } from '../../services/federation/FederationRoleSyncService';

describe('FederationRoleSyncService', () => {
  let service: FederationRoleSyncService;
  let mockFedRepo: { findOne: jest.Mock; save: jest.Mock };
  let mockMemberRepo: { find: jest.Mock };
  let mockMembershipRepo: { find: jest.Mock };
  let mockUserRepo: { findOne: jest.Mock; find: jest.Mock };

  const FEDERATION_ID = 'fed-111';

  beforeEach(() => {
    jest.clearAllMocks();

    mockFedRepo = { findOne: jest.fn(), save: jest.fn() };
    mockMemberRepo = { find: jest.fn() };
    mockMembershipRepo = { find: jest.fn() };
    mockUserRepo = { findOne: jest.fn(), find: jest.fn() };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'Federation') return mockFedRepo;
      if (name === 'FederationMember') return mockMemberRepo;
      if (name === 'OrganizationMembership') return mockMembershipRepo;
      if (name === 'User') return mockUserRepo;
      return {};
    });

    service = new FederationRoleSyncService();
  });

  describe('evaluateNewMember', () => {
    it('removes no-access role when assigning valid federation member roles', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: {
          enableCentralDiscord: true,
          centralGuildId: 'guild-1',
          memberRoleId: 'role-member',
          ambassadorRoleId: 'role-ambassador',
          noAccessRoleId: 'role-no-access',
          conflictResolutionMode: 'primary_org',
        },
      });

      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', discordId: 'discord-1' });
      mockMemberRepo.find.mockResolvedValue([
        {
          organizationId: 'org-1',
          organizationName: 'Alpha Org',
          role: 'member',
          status: 'active',
        },
      ]);
      mockMembershipRepo.find.mockResolvedValue([
        {
          userId: 'user-1',
          organizationId: 'org-1',
          isActive: true,
        },
      ]);

      const mockMember = {
        guild: { id: 'guild-1' },
        user: { id: 'discord-1' },
        roles: {
          cache: {
            has: jest.fn((roleId: string) => roleId === 'role-no-access'),
          },
          add: jest.fn().mockResolvedValue(undefined),
          remove: jest.fn().mockResolvedValue(undefined),
        },
      };

      await service.evaluateNewMember(FEDERATION_ID, mockMember as unknown as never);

      expect(mockMember.roles.add).toHaveBeenCalledWith('role-member', 'Federation member');
      expect(mockMember.roles.remove).toHaveBeenCalledWith(
        'role-no-access',
        'Federation: member access restored'
      );
    });

    it('does not remove no-access role when the member does not have it', async () => {
      mockFedRepo.findOne.mockResolvedValue({
        id: FEDERATION_ID,
        settings: {
          enableCentralDiscord: true,
          centralGuildId: 'guild-1',
          memberRoleId: 'role-member',
          noAccessRoleId: 'role-no-access',
          conflictResolutionMode: 'primary_org',
        },
      });

      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', discordId: 'discord-1' });
      mockMemberRepo.find.mockResolvedValue([
        {
          organizationId: 'org-1',
          organizationName: 'Alpha Org',
          role: 'member',
          status: 'active',
        },
      ]);
      mockMembershipRepo.find.mockResolvedValue([
        {
          userId: 'user-1',
          organizationId: 'org-1',
          isActive: true,
        },
      ]);

      const mockMember = {
        guild: { id: 'guild-1' },
        user: { id: 'discord-1' },
        roles: {
          cache: {
            has: jest.fn(() => false),
          },
          add: jest.fn().mockResolvedValue(undefined),
          remove: jest.fn().mockResolvedValue(undefined),
        },
      };

      await service.evaluateNewMember(FEDERATION_ID, mockMember as unknown as never);

      expect(mockMember.roles.add).toHaveBeenCalledWith('role-member', 'Federation member');
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
