/**
 * SquadronController Unit Tests
 *
 * Tests squadron (user group) membership management via TeamService delegation.
 * Sprint 12-D: Rewritten to use TeamService + Fleet repo (SquadronService removed).
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { SquadronController } from '../../controllers/squadronController';
import { TeamService } from '../../services/team/TeamService';
import { MockResponse } from '../helpers/testHelpers.helper';

// Mock TeamService
jest.mock('../../services/team/TeamService');

describe('SquadronController', () => {
  let controller: SquadronController;
  let mockTeamService: jest.Mocked<Partial<TeamService>>;
  let mockFleetRepo: { findOne: jest.Mock };

  // Helper to create request with organization context
  const createRequest = (overrides: any = {}) => ({
    organizationId: 'test-org-id',
    user: { id: 'test-user-id', username: 'testuser', role: 'user', organizationId: 'test-org-id' },
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock FleetService for resolveTeamId
    mockFleetRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'squad-1', teamId: 'team-1' }),
    };

    // Create mocked TeamService instance
    mockTeamService = {
      getTeamMembersFiltered: jest.fn(),
      getTeamMemberById: jest.fn(),
      getTeamMembers: jest.fn(),
      findByUser: jest.fn(),
      isMember: jest.fn(),
      getMembership: jest.fn(),
      addMember: jest.fn(),
      bulkAddMembers: jest.fn(),
      bulkUpdateMembers: jest.fn(),
      bulkDeleteMembers: jest.fn(),
      bulkUpdateStatus: jest.fn(),
      updateMember: jest.fn(),
      removeMember: jest.fn(),
      getTeamMemberCount: jest.fn(),
      getActiveCount: jest.fn(),
      getMembersByRole: jest.fn(),
      getMembersByShipType: jest.fn(),
      getTeamStatistics: jest.fn(),
      getUserTeamCount: jest.fn(),
    };

    controller = new SquadronController();
    (controller as any).teamService = mockTeamService;
    (controller as any).fleetService = mockFleetRepo;
  });

  describe('getSquadronMembers', () => {
    it('should retrieve squadron members with filters', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        query: {
          role: 'Pilot',
          status: 'active',
          page: '1',
          limit: '20',
        },
      });
      const res = MockResponse.create();
      const mockResult = {
        data: [{ id: '1', userId: 'user-1', role: 'Pilot' }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      (mockTeamService.getTeamMembersFiltered as jest.Mock).mockResolvedValue(mockResult);

      await controller.getSquadronMembers(req as any, res);

      expect(mockFleetRepo.findById).toHaveBeenCalledWith('test-org-id', 'squad-1');
      expect(mockTeamService.getTeamMembersFiltered).toHaveBeenCalledWith(
        'test-org-id',
        expect.objectContaining({
          teamId: 'team-1',
          role: 'Pilot',
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should throw error without organization context', async () => {
      const req = createRequest({ organizationId: undefined, user: {} });
      const res = MockResponse.create();

      await controller.getSquadronMembers(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSquadronMemberById', () => {
    it('should retrieve member by ID', async () => {
      const req = createRequest({
        params: { memberId: 'member-123' },
      });
      const res = MockResponse.create();
      const mockMember = { id: 'member-123', userId: 'user-1', role: 'Pilot' };
      (mockTeamService.getTeamMemberById as jest.Mock).mockResolvedValue(mockMember);

      await controller.getSquadronMemberById(req as any, res);

      expect(mockTeamService.getTeamMemberById).toHaveBeenCalledWith('test-org-id', 'member-123');
      expect(res.json).toHaveBeenCalledWith(mockMember);
    });

    it('should return 404 if member not found', async () => {
      const req = createRequest({
        params: { memberId: 'nonexistent' },
      });
      const res = MockResponse.create();
      (mockTeamService.getTeamMemberById as jest.Mock).mockResolvedValue(null);

      await controller.getSquadronMemberById(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getSquadronRoster', () => {
    it('should retrieve squadron roster', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
      });
      const res = MockResponse.create();
      const mockRoster = [
        { id: 'm1', userId: 'user-1' },
        { id: 'm2', userId: 'user-2' },
      ];
      (mockTeamService.getTeamMembers as jest.Mock).mockResolvedValue(mockRoster);

      await controller.getSquadronRoster(req as any, res);

      expect(mockTeamService.getTeamMembers).toHaveBeenCalledWith('test-org-id', 'team-1');
      expect(res.json).toHaveBeenCalledWith(mockRoster);
    });

    it('should throw error if squadron ID missing', async () => {
      const req = createRequest({
        params: {},
      });
      const res = MockResponse.create();

      await controller.getSquadronRoster(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getUserSquadrons', () => {
    it('should retrieve squadrons for user', async () => {
      const req = createRequest({
        params: { userId: 'user-123' },
      });
      const res = MockResponse.create();
      const mockSquadrons = [{ id: 'squad-1' }, { id: 'squad-2' }];
      (mockTeamService.findByUser as jest.Mock).mockResolvedValue(mockSquadrons);

      await controller.getUserSquadrons(req as any, res);

      expect(mockTeamService.findByUser).toHaveBeenCalledWith('test-org-id', 'user-123');
      expect(res.json).toHaveBeenCalledWith(mockSquadrons);
    });

    it('should use current user if userId not in params', async () => {
      const req = createRequest({
        params: {},
      });
      const res = MockResponse.create();
      (mockTeamService.findByUser as jest.Mock).mockResolvedValue([]);

      await controller.getUserSquadrons(req as any, res);

      expect(mockTeamService.findByUser).toHaveBeenCalledWith('test-org-id', 'test-user-id');
    });
  });

  describe('checkMembership', () => {
    it('should return true if user is member', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      (mockTeamService.isMember as jest.Mock).mockResolvedValue(true);

      await controller.checkMembership(req as any, res);

      expect(mockTeamService.isMember).toHaveBeenCalledWith('test-org-id', 'team-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ isMember: true });
    });

    it('should return false if user is not member', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      (mockTeamService.isMember as jest.Mock).mockResolvedValue(false);

      await controller.checkMembership(req as any, res);

      expect(res.json).toHaveBeenCalledWith({ isMember: false });
    });
  });

  describe('getMembership', () => {
    it('should retrieve membership details', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      const mockMembership = { id: 'm1', userId: 'user-1', teamId: 'team-1', role: 'member' };
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(mockMembership);

      await controller.getMembership(req as any, res);

      expect(mockTeamService.getMembership).toHaveBeenCalledWith('test-org-id', 'team-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith(mockMembership);
    });

    it('should return 404 if membership not found', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(null);

      await controller.getMembership(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addMember', () => {
    it('should add member to squadron successfully', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        body: { userId: 'user-1', role: 'Pilot' },
      });
      const res = MockResponse.create();
      const mockMember = { id: 'm1', userId: 'user-1', role: 'Pilot' };
      // getMembership returns null → not already a member
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(null);
      (mockTeamService.addMember as jest.Mock).mockResolvedValue(mockMember);

      await controller.addMember(req as any, res);

      expect(mockTeamService.addMember).toHaveBeenCalledWith(
        'test-org-id',
        'team-1',
        'user-1',
        'Pilot'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockMember);
    });

    it('should use default role if not provided', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        body: { userId: 'user-1' },
      });
      const res = MockResponse.create();
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(null);
      (mockTeamService.addMember as jest.Mock).mockResolvedValue({});

      await controller.addMember(req as any, res);

      expect(mockTeamService.addMember).toHaveBeenCalledWith(
        'test-org-id',
        'team-1',
        'user-1',
        'member'
      );
    });

    it('should throw error if userId not provided', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        body: {},
      });
      const res = MockResponse.create();

      await controller.addMember(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkAddMembers', () => {
    it('should bulk add members successfully', async () => {
      const members = [
        { userId: 'user-1', role: 'Pilot' },
        { userId: 'user-2', role: 'Gunner' },
      ];
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        body: { members },
      });
      const res = MockResponse.create();
      const createdMembers = members.map((m, i) => ({ id: `m${i}`, ...m }));
      (mockTeamService.bulkAddMembers as jest.Mock).mockResolvedValue(createdMembers);

      await controller.bulkAddMembers(req as any, res);

      expect(mockTeamService.bulkAddMembers).toHaveBeenCalledWith('test-org-id', 'team-1', members);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdMembers);
    });

    it('should throw error if members not an array', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1' },
        body: { members: 'not-array' },
      });
      const res = MockResponse.create();

      await controller.bulkAddMembers(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkUpdateMembers', () => {
    it('should bulk update members successfully', async () => {
      const updates = [
        { id: 'm1', data: { role: 'Captain' } },
        { id: 'm2', data: { role: 'Officer' } },
      ];
      const req = createRequest({
        body: { updates },
      });
      const res = MockResponse.create();
      const updatedMembers = updates.map(u => ({ id: u.id, ...u.data }));
      (mockTeamService.bulkUpdateMembers as jest.Mock).mockResolvedValue(updatedMembers);

      await controller.bulkUpdateMembers(req as any, res);

      expect(mockTeamService.bulkUpdateMembers).toHaveBeenCalledWith('test-org-id', updates);
      expect(res.json).toHaveBeenCalledWith(updatedMembers);
    });

    it('should throw error if updates not an array', async () => {
      const req = createRequest({
        body: { updates: 'not-array' },
      });
      const res = MockResponse.create();

      await controller.bulkUpdateMembers(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkDeleteMembers', () => {
    it('should bulk delete members successfully', async () => {
      const memberIds = ['m1', 'm2', 'm3'];
      const req = createRequest({
        body: { squadronId: 'squad-1', memberIds },
      });
      const res = MockResponse.create();
      (mockTeamService.bulkDeleteMembers as jest.Mock).mockResolvedValue(undefined);

      await controller.bulkDeleteMembers(req as any, res);

      expect(mockFleetRepo.findById).toHaveBeenCalled();
      expect(mockTeamService.bulkDeleteMembers).toHaveBeenCalledWith(
        'test-org-id',
        'team-1',
        memberIds
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw error if memberIds not an array', async () => {
      const req = createRequest({
        body: { squadronId: 'squad-1', memberIds: 'not-array' },
      });
      const res = MockResponse.create();

      await controller.bulkDeleteMembers(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update status successfully', async () => {
      const req = createRequest({
        body: {
          squadronId: 'squad-1',
          memberIds: ['m1', 'm2'],
          status: 'inactive',
        },
      });
      const res = MockResponse.create();
      (mockTeamService.bulkUpdateStatus as jest.Mock).mockResolvedValue(undefined);

      await controller.bulkUpdateStatus(req as any, res);

      expect(mockFleetRepo.findById).toHaveBeenCalled();
      expect(mockTeamService.bulkUpdateStatus).toHaveBeenCalledWith(
        'test-org-id',
        'team-1',
        ['m1', 'm2'],
        'inactive'
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should throw error if status not provided', async () => {
      const req = createRequest({
        body: { squadronId: 'squad-1', memberIds: ['m1'] },
      });
      const res = MockResponse.create();

      await controller.bulkUpdateStatus(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateRole', () => {
    it('should update member role successfully', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
        body: { role: 'Captain' },
      });
      const res = MockResponse.create();
      const mockMembership = { id: 'm1', userId: 'user-1', teamId: 'team-1', role: 'member' };
      const updatedMember = { id: 'm1', userId: 'user-1', role: 'Captain' };
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(mockMembership);
      (mockTeamService.updateMember as jest.Mock).mockResolvedValue(updatedMember);

      await controller.updateRole(req as any, res);

      expect(mockTeamService.getMembership).toHaveBeenCalledWith('test-org-id', 'team-1', 'user-1');
      expect(mockTeamService.updateMember).toHaveBeenCalledWith('test-org-id', 'team-1', 'm1', {
        role: 'Captain',
      });
      expect(res.json).toHaveBeenCalledWith(updatedMember);
    });

    it('should return 404 if membership not found', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
        body: { role: 'Captain' },
      });
      const res = MockResponse.create();
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(null);

      await controller.updateRole(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should throw error if role not provided', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
        body: {},
      });
      const res = MockResponse.create();

      await controller.updateRole(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      const mockMembership = { id: 'm1', userId: 'user-1', teamId: 'team-1' };
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(mockMembership);
      (mockTeamService.removeMember as jest.Mock).mockResolvedValue(undefined);

      await controller.removeMember(req as any, res);

      expect(mockTeamService.getMembership).toHaveBeenCalledWith('test-org-id', 'team-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 404 if membership not found', async () => {
      const req = createRequest({
        params: { squadronId: 'squad-1', userId: 'user-1' },
      });
      const res = MockResponse.create();
      (mockTeamService.getMembership as jest.Mock).mockResolvedValue(null);

      await controller.removeMember(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Analytics', () => {
    describe('getSquadronMemberCount', () => {
      it('should return member count', async () => {
        const req = createRequest({
          params: { squadronId: 'squad-1' },
        });
        const res = MockResponse.create();
        (mockTeamService.getTeamMemberCount as jest.Mock).mockResolvedValue(25);

        await controller.getSquadronMemberCount(req as any, res);

        expect(mockTeamService.getTeamMemberCount).toHaveBeenCalledWith('test-org-id', 'team-1');
        expect(res.json).toHaveBeenCalledWith({ count: 25 });
      });
    });

    describe('getActiveCount', () => {
      it('should return active member count', async () => {
        const req = createRequest({
          params: { squadronId: 'squad-1' },
        });
        const res = MockResponse.create();
        (mockTeamService.getActiveCount as jest.Mock).mockResolvedValue(20);

        await controller.getActiveCount(req as any, res);

        expect(mockTeamService.getActiveCount).toHaveBeenCalledWith('test-org-id', 'team-1');
        expect(res.json).toHaveBeenCalledWith({ count: 20 });
      });
    });

    describe('getMembersByRole', () => {
      it('should return role distribution', async () => {
        const req = createRequest({
          params: { squadronId: 'squad-1' },
        });
        const res = MockResponse.create();
        const distribution = { Pilot: 10, Gunner: 8, Engineer: 7 };
        (mockTeamService.getMembersByRole as jest.Mock).mockResolvedValue(distribution);

        await controller.getMembersByRole(req as any, res);

        expect(mockTeamService.getMembersByRole).toHaveBeenCalledWith('test-org-id', 'team-1');
        expect(res.json).toHaveBeenCalledWith(distribution);
      });
    });

    describe('getMembersByShipType', () => {
      it('should return ship type distribution', async () => {
        const req = createRequest({
          params: { squadronId: 'squad-1' },
        });
        const res = MockResponse.create();
        const distribution = { Constellation: 5, Carrack: 3, Aurora: 12 };
        (mockTeamService.getMembersByShipType as jest.Mock).mockResolvedValue(distribution);

        await controller.getMembersByShipType(req as any, res);

        expect(mockTeamService.getMembersByShipType).toHaveBeenCalledWith('test-org-id', 'team-1');
        expect(res.json).toHaveBeenCalledWith(distribution);
      });
    });

    describe('getSquadronStatistics', () => {
      it('should return squadron statistics', async () => {
        const req = createRequest({
          params: { squadronId: 'squad-1' },
        });
        const res = MockResponse.create();
        const stats = {
          totalMembers: 25,
          activeMembers: 20,
          roleDistribution: {},
          shipDistribution: {},
        };
        (mockTeamService.getTeamStatistics as jest.Mock).mockResolvedValue(stats);

        await controller.getSquadronStatistics(req as any, res);

        expect(mockTeamService.getTeamStatistics).toHaveBeenCalledWith('test-org-id', 'team-1');
        expect(res.json).toHaveBeenCalledWith(stats);
      });
    });

    describe('getUserSquadronCount', () => {
      it('should return user squadron count', async () => {
        const req = createRequest({
          params: { userId: 'user-1' },
        });
        const res = MockResponse.create();
        (mockTeamService.getUserTeamCount as jest.Mock).mockResolvedValue(3);

        await controller.getUserSquadronCount(req as any, res);

        expect(mockTeamService.getUserTeamCount).toHaveBeenCalledWith('test-org-id', 'user-1');
        expect(res.json).toHaveBeenCalledWith({ count: 3 });
      });
    });
  });
});
