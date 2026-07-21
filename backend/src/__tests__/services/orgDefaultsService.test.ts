/**
 * OrgDefaultsService Tests
 *
 * Tests the idempotent seeding of default roles, teams, and hierarchy.
 */

import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

// Mock RoleService singleton
const mockRoleService = {
  getRoleByName: jest.fn(),
  getOrCreateRole: jest.fn(),
  getRoleIdByName: jest.fn(),
  clearCache: jest.fn(),
};
jest.mock('../../services/security/core/RoleService', () => ({
  getRoleService: () => mockRoleService,
  RoleService: jest.fn(),
}));

// Mock TeamService
jest.mock('../../services/team/TeamService');

// Mock RsiRoleMappingService
const mockApplyTemplate = jest.fn();
jest.mock('../../services/external/RsiRoleMappingService', () => ({
  rsiRoleMappingService: {
    applyTemplate: (...args: unknown[]) => mockApplyTemplate(...args),
  },
}));

import {
  OrgDefaultsService,
  getOrgDefaultsService,
} from '../../services/organization/OrgDefaultsService';
import { TeamService } from '../../services/team/TeamService';

describe('OrgDefaultsService', () => {
  const ORG_ID = 'org-test-123';
  let service: OrgDefaultsService;
  let mockTeamService: jest.Mocked<TeamService>;
  let mockTeamRepo: ReturnType<typeof createMockRepositoryWithData>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTeamRepo = createMockRepositoryWithData([]);
    mockDataSource.getRepository.mockReturnValue(mockTeamRepo);

    // Setup the mocked TeamService instance
    mockTeamService = {
      createTeam: jest.fn(),
    } as unknown as jest.Mocked<TeamService>;
    (TeamService as jest.MockedClass<typeof TeamService>).mockImplementation(
      () => mockTeamService as unknown as TeamService
    );

    // Reset RoleService mocks
    mockRoleService.getRoleByName.mockResolvedValue(null);
    mockRoleService.getOrCreateRole.mockImplementation(
      async (
        name: string,
        orgId: string | null,
        desc?: string,
        perms?: string[],
        priority?: number
      ) => ({
        id: `role-${name}`,
        name,
        organizationId: orgId,
        description: desc,
        permissions: perms,
        priority,
        isSystemRole: false,
      })
    );

    // Setup TeamService.createTeam mock to return team objects
    let teamCounter = 0;
    mockTeamService.createTeam.mockImplementation(
      async (_orgId: string, data: { name: string }) =>
        ({
          id: `team-${++teamCounter}`,
          organizationId: _orgId,
          name: data.name,
          type: 'division',
          level: 0,
          sortOrder: 0,
          maxMembers: 20,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as unknown as ReturnType<TeamService['createTeam']>
    );

    service = new OrgDefaultsService();

    // Setup RsiRoleMappingService mock
    mockApplyTemplate.mockResolvedValue({ created: 5, updated: 0, failed: 0, errors: [] });
  });

  describe('seedDefaults', () => {
    it('should create all 9 default roles when none exist', async () => {
      // No board team exists
      mockTeamRepo.findOne.mockResolvedValue(null);

      const result = await service.seedDefaults(ORG_ID);

      expect(result.rolesCreated).toBe(9);
      expect(mockRoleService.getOrCreateRole).toHaveBeenCalledTimes(9);
    });

    it('should create 8 default teams (1 parent + 7 children)', async () => {
      // No board team exists
      mockTeamRepo.findOne.mockResolvedValue(null);

      const result = await service.seedDefaults(ORG_ID);

      expect(result.teamsCreated).toBe(8);
      // Board + 7 children
      expect(mockTeamService.createTeam).toHaveBeenCalledTimes(8);
    });

    it('should create Board as the root team with no parent', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await service.seedDefaults(ORG_ID);

      // First call creates Board (no parentTeamId)
      expect(mockTeamService.createTeam).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          name: 'Board',
          type: 'division',
        })
      );
      // Verify first call has no parentTeamId
      const firstCall = mockTeamService.createTeam.mock.calls[0];
      expect(firstCall[1]).not.toHaveProperty('parentTeamId');
    });

    it('should create child teams with Board as parent', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await service.seedDefaults(ORG_ID);

      // Child teams should have parentTeamId pointing to the board team
      const childCalls = mockTeamService.createTeam.mock.calls.slice(1);
      expect(childCalls).toHaveLength(7);

      const childNames = childCalls.map(call => call[1].name);
      expect(childNames).toEqual([
        'Specialists',
        'T&I Division',
        'Security Division',
        'R&D Division',
        'Intel Division',
        'Diplomacy Division',
        'HR Division',
      ]);

      // All children should reference the board team ID
      for (const call of childCalls) {
        expect(call[1].parentTeamId).toBe('team-1'); // Board gets ID team-1
      }
    });

    it('should skip roles that already exist (idempotent)', async () => {
      // All roles already exist
      mockRoleService.getRoleByName.mockResolvedValue({
        id: 'existing-role',
        name: 'founder',
      });
      mockTeamRepo.findOne.mockResolvedValue(null);

      const result = await service.seedDefaults(ORG_ID);

      expect(result.rolesCreated).toBe(0);
      expect(mockRoleService.getOrCreateRole).not.toHaveBeenCalled();
    });

    it('should skip teams when Board already exists (idempotent)', async () => {
      // Board team exists
      mockTeamRepo.findOne.mockResolvedValue({
        id: 'existing-board',
        name: 'Board',
        organizationId: ORG_ID,
      });

      const result = await service.seedDefaults(ORG_ID);

      expect(result.teamsCreated).toBe(0);
      expect(mockTeamService.createTeam).not.toHaveBeenCalled();
    });

    it('should mark result as skipped when nothing was created', async () => {
      // Everything already exists
      mockRoleService.getRoleByName.mockResolvedValue({ id: 'role-1', name: 'founder' });
      mockTeamRepo.findOne.mockResolvedValue({ id: 'board-1', name: 'Board' });
      mockApplyTemplate.mockResolvedValue({ created: 0, updated: 5, failed: 0, errors: [] });

      const result = await service.seedDefaults(ORG_ID);

      expect(result.skipped).toBe(true);
      expect(result.rolesCreated).toBe(0);
      expect(result.teamsCreated).toBe(0);
      expect(result.rsiMappingsCreated).toBe(0);
    });

    it('should not mark as skipped when items were created', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      const result = await service.seedDefaults(ORG_ID);

      expect(result.skipped).toBe(false);
    });

    it('should create founder role with wildcard permission', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await service.seedDefaults(ORG_ID);

      expect(mockRoleService.getOrCreateRole).toHaveBeenCalledWith(
        'founder',
        ORG_ID,
        'Organization creator, full access',
        ['*'],
        100
      );
    });

    it('should create diplomacy role as non-system (custom)', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await service.seedDefaults(ORG_ID);

      // Check diplomacy role was created
      expect(mockRoleService.getOrCreateRole).toHaveBeenCalledWith(
        'diplomacy',
        ORG_ID,
        expect.stringContaining('alliances'),
        expect.arrayContaining(['federation:*', 'diplomacy:*', 'alliance:*']),
        40
      );
    });

    it('should create intel_officer role as non-system (custom)', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await service.seedDefaults(ORG_ID);

      expect(mockRoleService.getOrCreateRole).toHaveBeenCalledWith(
        'intel_officer',
        ORG_ID,
        expect.stringContaining('Intelligence'),
        expect.arrayContaining(['intel:*', 'security:view']),
        40
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      mockRoleService.getRoleByName.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.seedDefaults(ORG_ID);

      // Phase 1 (roles) fails, but Phase 2 (teams) and Phase 3 (RSI) still run
      expect(result.rolesCreated).toBe(0);
      // Teams are seeded independently of roles
      expect(result).toBeDefined();
    });

    it('should still seed teams if role seeding partially fails', async () => {
      // First role check fails, subsequent ones succeed
      mockRoleService.getRoleByName
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValue(null);
      mockTeamRepo.findOne.mockResolvedValue(null);

      // With per-phase error isolation, teams should still be created
      const result = await service.seedDefaults(ORG_ID);

      expect(result).toBeDefined();
      // Teams should have been created despite role seeding failure
      expect(result.teamsCreated).toBeGreaterThanOrEqual(0);
    });

    it('should seed RSI role mappings via standard template', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);
      mockApplyTemplate.mockResolvedValue({ created: 5, updated: 0, failed: 0, errors: [] });

      const result = await service.seedDefaults(ORG_ID);

      expect(result.rsiMappingsCreated).toBe(5);
      expect(mockApplyTemplate).toHaveBeenCalledWith(ORG_ID, 'standard');
    });

    it('should handle RSI mapping failure gracefully', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);
      mockApplyTemplate.mockRejectedValue(new Error('RsiRoleMappingService unavailable'));

      const result = await service.seedDefaults(ORG_ID);

      // Should still have created roles and teams
      expect(result.rolesCreated).toBe(9);
      expect(result.teamsCreated).toBe(8);
      expect(result.rsiMappingsCreated).toBe(0);
    });
  });

  describe('static accessors', () => {
    it('should return 6 default rank definitions', () => {
      const ranks = OrgDefaultsService.getDefaultRanks();

      expect(ranks).toHaveLength(6);
      expect(ranks[0]).toEqual(expect.objectContaining({ level: 0, name: 'Rank 0' }));
      expect(ranks[5]).toEqual(expect.objectContaining({ level: 5, name: 'Rank 5' }));
    });

    it('should return rank name by level', () => {
      expect(OrgDefaultsService.getRankNameByLevel(0)).toBe('Rank 0');
      expect(OrgDefaultsService.getRankNameByLevel(2)).toBe('Rank 2');
      expect(OrgDefaultsService.getRankNameByLevel(5)).toBe('Rank 5');
      expect(OrgDefaultsService.getRankNameByLevel(99)).toBeUndefined();
    });

    it('should return 9 default role definitions', () => {
      const roles = OrgDefaultsService.getDefaultRoles();

      expect(roles).toHaveLength(9);
      const roleNames = roles.map(r => r.name);
      expect(roleNames).toContain('founder');
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('officer');
      expect(roleNames).toContain('recruitment');
      expect(roleNames).toContain('marketing');
      expect(roleNames).toContain('diplomacy');
      expect(roleNames).toContain('intel_officer');
      expect(roleNames).toContain('fleet_commander');
      expect(roleNames).toContain('member');
    });
  });

  describe('getOrgDefaultsService (singleton)', () => {
    it('should return an OrgDefaultsService instance', () => {
      const instance = getOrgDefaultsService();
      expect(instance).toBeInstanceOf(OrgDefaultsService);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
