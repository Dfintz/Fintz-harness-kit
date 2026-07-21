jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';

describe('FederationAmbassadorService', () => {
  let service: FederationAmbassadorService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMemberRepo: any;

  const FEDERATION_ID = 'fed-111';
  const ACTOR_ORG_ID = 'org-founder';
  const TARGET_ORG_ID = 'org-member';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAmbassadorRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockMemberRepo = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'FederationAmbassador') return mockAmbassadorRepo;
      if (name === 'FederationMember') return mockMemberRepo;
      return {};
    });

    service = new FederationAmbassadorService();
  });

  // ─── listAmbassadors ─────────────────────────────────────────

  describe('listAmbassadors', () => {
    it('should return all ambassadors for a federation', async () => {
      const entities = [
        {
          id: 'amb-1',
          federationId: FEDERATION_ID,
          organizationId: TARGET_ORG_ID,
          organizationName: 'Test Org',
          userId: USER_ID,
          userName: 'TestUser',
          role: 'representative',
          permissions: ['view'],
          isActive: true,
          title: null,
          appointedAt: new Date(),
        },
      ];
      mockAmbassadorRepo.find.mockResolvedValue(entities);

      const result = await service.listAmbassadors(FEDERATION_ID);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
      expect(mockAmbassadorRepo.find).toHaveBeenCalledWith({
        where: { federationId: FEDERATION_ID },
        order: { appointedAt: 'ASC' },
      });
    });
  });

  // ─── appointAmbassador ────────────────────────────────────────

  describe('appointAmbassador', () => {
    const appointData = {
      userId: USER_ID,
      userName: 'TestUser',
      organizationId: TARGET_ORG_ID,
      organizationName: 'Member Org',
      role: 'representative' as const,
      permissions: ['view' as const, 'vote' as const],
    };

    it('should appoint an ambassador successfully', async () => {
      // Actor is founder
      mockMemberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-1',
          federationId: FEDERATION_ID,
          organizationId: ACTOR_ORG_ID,
          role: 'founder',
          status: 'active',
        })
        // Target org is active member
        .mockResolvedValueOnce({
          id: 'mem-2',
          federationId: FEDERATION_ID,
          organizationId: TARGET_ORG_ID,
          role: 'member',
          status: 'active',
        });

      // No existing ambassador
      mockAmbassadorRepo.findOne.mockResolvedValue(null);

      const newEntity = {
        id: 'amb-new',
        ...appointData,
        federationId: FEDERATION_ID,
        isActive: true,
        title: null,
        appointedAt: new Date(),
      };
      mockAmbassadorRepo.create.mockReturnValue(newEntity);
      mockAmbassadorRepo.save.mockResolvedValue(newEntity);

      const result = await service.appointAmbassador(FEDERATION_ID, ACTOR_ORG_ID, appointData);

      expect(result.id).toBe('amb-new');
      expect(result.userId).toBe(USER_ID);
      expect(result.role).toBe('representative');
      expect(mockAmbassadorRepo.save).toHaveBeenCalled();
    });

    it('should reject if actor is not founder/leader', async () => {
      mockMemberRepo.findOne.mockResolvedValueOnce({
        id: 'mem-1',
        federationId: FEDERATION_ID,
        organizationId: ACTOR_ORG_ID,
        role: 'member', // not founder/leader
        status: 'active',
      });

      await expect(
        service.appointAmbassador(FEDERATION_ID, ACTOR_ORG_ID, appointData)
      ).rejects.toThrow('Only founder or leader organizations can appoint ambassadors');
    });

    it('should reject if user is already an ambassador', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-1',
          federationId: FEDERATION_ID,
          organizationId: ACTOR_ORG_ID,
          role: 'founder',
          status: 'active',
        })
        .mockResolvedValueOnce({
          id: 'mem-2',
          federationId: FEDERATION_ID,
          organizationId: TARGET_ORG_ID,
          role: 'member',
          status: 'active',
        });

      // User already exists as ambassador
      mockAmbassadorRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.appointAmbassador(FEDERATION_ID, ACTOR_ORG_ID, appointData)
      ).rejects.toThrow('already an ambassador');
    });

    it('should reject if target org is not an active member', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-1',
          federationId: FEDERATION_ID,
          organizationId: ACTOR_ORG_ID,
          role: 'founder',
          status: 'active',
        })
        // Target org not found
        .mockResolvedValueOnce(null);

      await expect(
        service.appointAmbassador(FEDERATION_ID, ACTOR_ORG_ID, appointData)
      ).rejects.toThrow('not an active member');
    });

    it('should reject if permissions exceed org role', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-1',
          federationId: FEDERATION_ID,
          organizationId: ACTOR_ORG_ID,
          role: 'founder',
          status: 'active',
        })
        .mockResolvedValueOnce({
          id: 'mem-2',
          federationId: FEDERATION_ID,
          organizationId: TARGET_ORG_ID,
          role: 'observer', // observer can't grant vote
          status: 'active',
        });

      mockAmbassadorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.appointAmbassador(FEDERATION_ID, ACTOR_ORG_ID, {
          ...appointData,
          role: 'observer' as const,
          permissions: ['view', 'vote'], // observer can't vote
        })
      ).rejects.toThrow("Organization role 'observer' cannot grant 'vote' permission");
    });
  });

  // ─── updateAmbassador ─────────────────────────────────────────

  describe('updateAmbassador', () => {
    it('should update an ambassador role and permissions', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-1',
          federationId: FEDERATION_ID,
          organizationId: ACTOR_ORG_ID,
          role: 'founder',
          status: 'active',
        })
        .mockResolvedValueOnce({
          id: 'mem-2',
          federationId: FEDERATION_ID,
          organizationId: TARGET_ORG_ID,
          role: 'council',
          status: 'active',
        });

      const existing = {
        id: 'amb-1',
        federationId: FEDERATION_ID,
        organizationId: TARGET_ORG_ID,
        organizationName: 'Org',
        userId: USER_ID,
        userName: 'User',
        role: 'representative' as const,
        permissions: ['view' as const],
        isActive: true,
        title: null,
        appointedAt: new Date(),
      };
      mockAmbassadorRepo.findOne.mockResolvedValue({ ...existing });

      const updated = { ...existing, role: 'council', permissions: ['view', 'vote'] };
      mockAmbassadorRepo.save.mockResolvedValue(updated);

      const result = await service.updateAmbassador(FEDERATION_ID, 'amb-1', ACTOR_ORG_ID, {
        role: 'council',
        permissions: ['view', 'vote'],
      });

      expect(result?.role).toBe('council');
    });

    it('should return null if ambassador not found', async () => {
      mockMemberRepo.findOne.mockResolvedValueOnce({
        id: 'mem-1',
        federationId: FEDERATION_ID,
        organizationId: ACTOR_ORG_ID,
        role: 'founder',
        status: 'active',
      });
      mockAmbassadorRepo.findOne.mockResolvedValue(null);

      const result = await service.updateAmbassador(
        FEDERATION_ID,
        'amb-nonexistent',
        ACTOR_ORG_ID,
        { role: 'observer' }
      );
      expect(result).toBeNull();
    });
  });

  // ─── removeAmbassador ─────────────────────────────────────────

  describe('removeAmbassador', () => {
    it('should remove an ambassador', async () => {
      mockMemberRepo.findOne.mockResolvedValueOnce({
        id: 'mem-1',
        federationId: FEDERATION_ID,
        organizationId: ACTOR_ORG_ID,
        role: 'leader',
        status: 'active',
      });

      const existing = {
        id: 'amb-1',
        federationId: FEDERATION_ID,
        userId: USER_ID,
      };
      mockAmbassadorRepo.findOne.mockResolvedValue(existing);

      await service.removeAmbassador(FEDERATION_ID, 'amb-1', ACTOR_ORG_ID);

      expect(mockAmbassadorRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw if ambassador not found', async () => {
      mockMemberRepo.findOne.mockResolvedValueOnce({
        id: 'mem-1',
        federationId: FEDERATION_ID,
        organizationId: ACTOR_ORG_ID,
        role: 'founder',
        status: 'active',
      });
      mockAmbassadorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeAmbassador(FEDERATION_ID, 'amb-missing', ACTOR_ORG_ID)
      ).rejects.toThrow("Ambassador with id 'amb-missing' not found");
    });
  });

  // ─── hasPermission ────────────────────────────────────────────

  describe('hasPermission', () => {
    it('should return true for view permission on active ambassador', async () => {
      mockAmbassadorRepo.findOne.mockResolvedValue({
        userId: USER_ID,
        isActive: true,
        permissions: ['view'],
      });

      expect(await service.hasPermission(FEDERATION_ID, USER_ID, 'view')).toBe(true);
    });

    it('should return false for non-granted permission', async () => {
      mockAmbassadorRepo.findOne.mockResolvedValue({
        userId: USER_ID,
        isActive: true,
        permissions: ['view'],
      });

      expect(await service.hasPermission(FEDERATION_ID, USER_ID, 'vote')).toBe(false);
    });

    it('should return false if user is not an ambassador', async () => {
      mockAmbassadorRepo.findOne.mockResolvedValue(null);

      expect(await service.hasPermission(FEDERATION_ID, USER_ID, 'view')).toBe(false);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
