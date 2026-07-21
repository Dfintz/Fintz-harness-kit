jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationTeamService } from '../../services/federation/FederationTeamService';

describe('FederationTeamService', () => {
  let service: FederationTeamService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTeamRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockTeamRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'FederationTeam') return mockTeamRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationTeamService();
  });

  describe('createTeam', () => {
    it('should create a team', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockTeamRepo.findOne.mockResolvedValue(null); // no name conflict

      const saved = {
        id: 'team-1',
        federationId: FEDERATION_ID,
        name: 'Alpha Strike',
        description: null,
        type: 'task_force',
        leaderId: null,
        leaderName: null,
        leaderOrgId: null,
        members: [],
        status: 'active',
        maxMembers: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTeamRepo.create.mockReturnValue(saved);
      mockTeamRepo.save.mockResolvedValue(saved);

      const result = await service.createTeam(FEDERATION_ID, USER_ID, {
        name: 'Alpha Strike',
      });

      expect(result.id).toBe('team-1');
      expect(result.name).toBe('Alpha Strike');
    });

    it('should reject duplicate team name', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockTeamRepo.findOne.mockResolvedValue({ id: 'existing' }); // name conflict

      await expect(
        service.createTeam(FEDERATION_ID, USER_ID, { name: 'Alpha Strike' })
      ).rejects.toThrow('already exists');
    });

    it('should reject if lacking HR permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(service.createTeam(FEDERATION_ID, USER_ID, { name: 'Test' })).rejects.toThrow(
        'HR permission required'
      );
    });
  });

  describe('addMember', () => {
    it('should add a member to a team', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const team = {
        id: 'team-1',
        federationId: FEDERATION_ID,
        members: [],
        status: 'active',
        maxMembers: 20,
      };
      mockTeamRepo.findOne.mockResolvedValue({ ...team });
      mockTeamRepo.save.mockImplementation(async (entity: Record<string, unknown>) => entity);

      const result = await service.addMember(FEDERATION_ID, USER_ID, 'team-1', {
        userId: 'member-1',
        userName: 'JohnDoe',
        organizationId: 'org-1',
        organizationName: 'Test Org',
        role: 'member',
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe('member-1');
    });

    it('should reject duplicate member', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockTeamRepo.findOne.mockResolvedValue({
        id: 'team-1',
        federationId: FEDERATION_ID,
        members: [
          {
            userId: 'member-1',
            userName: 'John',
            organizationId: 'org-1',
            organizationName: 'Org',
            role: 'member',
          },
        ],
        status: 'active',
        maxMembers: 20,
      });

      await expect(
        service.addMember(FEDERATION_ID, USER_ID, 'team-1', {
          userId: 'member-1',
          userName: 'John',
          organizationId: 'org-1',
          organizationName: 'Org',
          role: 'member',
        })
      ).rejects.toThrow('already a member');
    });

    it('should reject when at capacity', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockTeamRepo.findOne.mockResolvedValue({
        id: 'team-1',
        federationId: FEDERATION_ID,
        members: [{ userId: 'a' }, { userId: 'b' }],
        status: 'active',
        maxMembers: 2,
      });

      await expect(
        service.addMember(FEDERATION_ID, USER_ID, 'team-1', {
          userId: 'member-3',
          userName: 'New',
          organizationId: 'org-1',
          organizationName: 'Org',
          role: 'member',
        })
      ).rejects.toThrow('maximum capacity');
    });
  });

  describe('removeMember', () => {
    it('should remove a member from a team', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockTeamRepo.findOne.mockResolvedValue({
        id: 'team-1',
        federationId: FEDERATION_ID,
        members: [
          {
            userId: 'member-1',
            userName: 'John',
            organizationId: 'org-1',
            organizationName: 'Org',
            role: 'member',
          },
          {
            userId: 'member-2',
            userName: 'Jane',
            organizationId: 'org-1',
            organizationName: 'Org',
            role: 'member',
          },
        ],
        status: 'active',
        maxMembers: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTeamRepo.save.mockImplementation(async (entity: Record<string, unknown>) => entity);

      const result = await service.removeMember(FEDERATION_ID, USER_ID, 'team-1', 'member-1');

      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe('member-2');
    });
  });

  describe('deleteTeam', () => {
    it('should delete a team', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const team = { id: 'team-1', federationId: FEDERATION_ID };
      mockTeamRepo.findOne.mockResolvedValue(team);

      await service.deleteTeam(FEDERATION_ID, USER_ID, 'team-1');

      expect(mockTeamRepo.remove).toHaveBeenCalledWith(team);
    });

    it('should throw NotFoundError if team not found', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockTeamRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteTeam(FEDERATION_ID, USER_ID, 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
