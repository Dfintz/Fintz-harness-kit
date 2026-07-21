jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationIntelService } from '../../services/federation/FederationIntelService';

describe('FederationIntelService', () => {
  let service: FederationIntelService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockIntelRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockIntelRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'FederationIntelEntry') return mockIntelRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationIntelService();
  });

  describe('submitIntel', () => {
    it('should submit intel as pending_review', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const saved = {
        id: 'intel-1',
        federationId: FEDERATION_ID,
        title: 'Pirate Activity',
        content: 'Increased pirate raids in Pyro system sector 4.',
        classification: 'open',
        status: 'pending_review',
        submittedBy: USER_ID,
        submittedByName: null,
        submittedByOrgId: null,
        approvedBy: null,
        tags: [],
        visibleToTreaties: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockIntelRepo.create.mockReturnValue(saved);
      mockIntelRepo.save.mockResolvedValue(saved);

      const result = await service.submitIntel(FEDERATION_ID, USER_ID, {
        title: 'Pirate Activity',
        content: 'Increased pirate raids in Pyro system sector 4.',
      });

      expect(result.id).toBe('intel-1');
      expect(result.status).toBe('pending_review');
      expect(mockIntelRepo.save).toHaveBeenCalled();
    });

    it('should reject if lacking intel permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(
        service.submitIntel(FEDERATION_ID, USER_ID, {
          title: 'Test',
          content: 'Test content that is long enough for validation.',
        })
      ).rejects.toThrow('intel permission required');
    });

    it('should reject short title', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      await expect(
        service.submitIntel(FEDERATION_ID, USER_ID, {
          title: 'ab',
          content: 'Valid content length for the intel report body.',
        })
      ).rejects.toThrow('title must be at least 3 characters');
    });
  });

  describe('listIntel', () => {
    it('should return intel entries', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const entries = [
        {
          id: 'i1',
          federationId: FEDERATION_ID,
          title: 'Report 1',
          content: 'Content',
          classification: 'open',
          status: 'published',
          submittedBy: USER_ID,
          submittedByName: null,
          submittedByOrgId: null,
          approvedBy: null,
          tags: [],
          visibleToTreaties: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockIntelRepo.find.mockResolvedValue(entries);

      const result = await service.listIntel(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Report 1');
    });
  });

  describe('approveIntel', () => {
    it('should approve a pending entry', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const entry = {
        id: 'i1',
        federationId: FEDERATION_ID,
        status: 'pending_review',
        approvedBy: null,
      };
      mockIntelRepo.findOne.mockResolvedValue({ ...entry });
      mockIntelRepo.save.mockImplementation(async (e: Record<string, unknown>) => e);

      const result = await service.approveIntel(FEDERATION_ID, USER_ID, 'i1');

      expect(result.status).toBe('published');
      expect(result.approvedBy).toBe(USER_ID);
    });

    it('should reject approving already published entry', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockIntelRepo.findOne.mockResolvedValue({
        id: 'i1',
        federationId: FEDERATION_ID,
        status: 'published',
      });

      await expect(service.approveIntel(FEDERATION_ID, USER_ID, 'i1')).rejects.toThrow(
        'Only pending or draft'
      );
    });
  });

  describe('archiveIntel', () => {
    it('should archive an entry', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockIntelRepo.findOne.mockResolvedValue({
        id: 'i1',
        federationId: FEDERATION_ID,
        status: 'published',
      });
      mockIntelRepo.save.mockImplementation(async (e: Record<string, unknown>) => e);

      const result = await service.archiveIntel(FEDERATION_ID, USER_ID, 'i1');

      expect(result.status).toBe('archived');
    });
  });

  describe('deleteIntel', () => {
    it('should delete an intel entry', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const entry = { id: 'i1', federationId: FEDERATION_ID };
      mockIntelRepo.findOne.mockResolvedValue(entry);

      await service.deleteIntel(FEDERATION_ID, USER_ID, 'i1');

      expect(mockIntelRepo.remove).toHaveBeenCalledWith(entry);
    });

    it('should throw NotFoundError if not found', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockIntelRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteIntel(FEDERATION_ID, USER_ID, 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('updateIntel', () => {
    it('should reject updates to archived entries', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockIntelRepo.findOne.mockResolvedValue({
        id: 'i1',
        federationId: FEDERATION_ID,
        status: 'archived',
      });

      await expect(
        service.updateIntel(FEDERATION_ID, USER_ID, 'i1', { title: 'New Title' })
      ).rejects.toThrow('Archived intel cannot be edited');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
