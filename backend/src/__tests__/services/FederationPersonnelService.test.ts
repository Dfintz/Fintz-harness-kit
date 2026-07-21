jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationPersonnelService } from '../../services/federation/FederationPersonnelService';

describe('FederationPersonnelService', () => {
  let service: FederationPersonnelService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMemberRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMembershipRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockMemberRepo = {
      find: jest.fn(),
    };

    mockMembershipRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };

    mockAmbassadorRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'FederationMember') return mockMemberRepo;
      if (name === 'OrganizationMembership') return mockMembershipRepo;
      if (name === 'FederationAmbassador') return mockAmbassadorRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationPersonnelService();
  });

  describe('listPersonnel', () => {
    it('should aggregate personnel from all member orgs', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      // Two member orgs
      mockMemberRepo.find.mockResolvedValue([
        { organizationId: 'org-1', organizationName: 'Alpha Corp', status: 'active' },
        { organizationId: 'org-2', organizationName: 'Beta Inc', status: 'active' },
      ]);

      // Ambassadors
      mockAmbassadorRepo.find.mockResolvedValue([
        { userId: 'user-1', role: 'council', title: 'Chief Diplomat', isActive: true },
      ]);

      // Memberships for org-1
      mockMembershipRepo.find
        .mockResolvedValueOnce([
          {
            userId: 'user-1',
            organizationId: 'org-1',
            user: { username: 'AlphaLeader' },
            role: { name: 'Admin' },
            title: null,
            joinedAt: new Date(),
            isActive: true,
          },
        ])
        // Memberships for org-2
        .mockResolvedValueOnce([
          {
            userId: 'user-2',
            organizationId: 'org-2',
            user: { username: 'BetaPilot' },
            role: { name: 'Member' },
            title: 'Pilot',
            joinedAt: new Date(),
            isActive: true,
          },
        ]);

      const result = await service.listPersonnel(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].isAmbassador).toBe(true);
      expect(result[0].ambassadorRole).toBe('council');
      expect(result[1].isAmbassador).toBe(false);
    });

    it('should return empty for no member orgs', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockMemberRepo.find.mockResolvedValue([]);

      const result = await service.listPersonnel(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(0);
    });

    it('should reject if lacking view permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(service.listPersonnel(FEDERATION_ID, USER_ID)).rejects.toThrow('ambassador');
    });
  });

  describe('getPersonnelSummary', () => {
    it('should return summary statistics', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockMemberRepo.find.mockResolvedValue([
        { organizationId: 'org-1', organizationName: 'Alpha', status: 'active' },
      ]);
      mockMembershipRepo.count.mockResolvedValue(15);
      mockAmbassadorRepo.count.mockResolvedValue(3);

      const result = await service.getPersonnelSummary(FEDERATION_ID, USER_ID);

      expect(result.totalPersonnel).toBe(15);
      expect(result.totalAmbassadors).toBe(3);
      expect(result.byOrganization).toHaveProperty('Alpha', 15);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
