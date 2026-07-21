jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationAnnouncementService } from '../../services/federation/FederationAnnouncementService';

describe('FederationAnnouncementService', () => {
  let service: FederationAnnouncementService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAnnouncementRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAnnouncementRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'Announcement') return mockAnnouncementRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationAnnouncementService();
  });

  // ─── createAnnouncement ───────────────────────────────────

  describe('createAnnouncement', () => {
    it('should create and return an announcement', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const saved = {
        id: 'ann-1',
        federationId: FEDERATION_ID,
        title: 'Fleet Day',
        content: 'Join us for a joint fleet day this Saturday.',
        targetAudience: 'all-members',
        targetType: 'all',
        status: 'sent',
        createdBy: USER_ID,
        createdByName: null,
        createdAt: new Date(),
        sentAt: new Date(),
        pinnedAt: null,
      };
      mockAnnouncementRepo.create.mockReturnValue(saved);
      mockAnnouncementRepo.save.mockResolvedValue(saved);

      const result = await service.createAnnouncement(FEDERATION_ID, USER_ID, {
        title: 'Fleet Day',
        content: 'Join us for a joint fleet day this Saturday.',
      });

      expect(result.id).toBe('ann-1');
      expect(result.title).toBe('Fleet Day');
      expect(mockAnnouncementRepo.save).toHaveBeenCalled();
    });

    it('should reject if user lacks announce permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(
        service.createAnnouncement(FEDERATION_ID, USER_ID, {
          title: 'Test',
          content: 'Test content for announcement',
        })
      ).rejects.toThrow('announce permission required');
    });

    it('should reject short titles', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      await expect(
        service.createAnnouncement(FEDERATION_ID, USER_ID, {
          title: 'ab',
          content: 'Valid content here for the announcement body.',
        })
      ).rejects.toThrow('title must be at least 3 characters');
    });

    it('should reject short content', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      await expect(
        service.createAnnouncement(FEDERATION_ID, USER_ID, {
          title: 'Good Title',
          content: 'Short',
        })
      ).rejects.toThrow('content must be at least 10 characters');
    });
  });

  // ─── listAnnouncements ────────────────────────────────────

  describe('listAnnouncements', () => {
    it('should return announcements for a federation', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const items = [
        {
          id: 'a1',
          federationId: FEDERATION_ID,
          title: 'First',
          content: 'Content',
          targetAudience: 'all-members',
          targetType: 'all',
          status: 'sent',
          createdBy: USER_ID,
          createdByName: null,
          createdAt: new Date(),
          sentAt: null,
          pinnedAt: null,
        },
      ];
      mockAnnouncementRepo.find.mockResolvedValue(items);

      const result = await service.listAnnouncements(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('First');
    });
  });

  // ─── deleteAnnouncement ───────────────────────────────────

  describe('deleteAnnouncement', () => {
    it('should delete an announcement', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const existing = { id: 'a1', federationId: FEDERATION_ID };
      mockAnnouncementRepo.findOne.mockResolvedValue(existing);

      await service.deleteAnnouncement(FEDERATION_ID, USER_ID, 'a1');

      expect(mockAnnouncementRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundError if not found', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockAnnouncementRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteAnnouncement(FEDERATION_ID, USER_ID, 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

  // ─── togglePin ────────────────────────────────────────────

  describe('togglePin', () => {
    it('should pin an unpinned announcement', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const existing = {
        id: 'a1',
        federationId: FEDERATION_ID,
        title: 'Test',
        content: 'Content',
        targetAudience: 'all-members',
        targetType: 'all',
        status: 'sent',
        createdBy: USER_ID,
        createdByName: null,
        createdAt: new Date(),
        sentAt: null,
        pinnedAt: null,
        pinnedBy: undefined,
      };
      mockAnnouncementRepo.findOne.mockResolvedValue({ ...existing });
      mockAnnouncementRepo.save.mockImplementation(async (entity: Record<string, unknown>) => ({
        ...entity,
      }));

      const result = await service.togglePin(FEDERATION_ID, USER_ID, 'a1');

      expect(result.pinnedAt).not.toBeNull();
    });

    it('should unpin a pinned announcement', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const existing = {
        id: 'a1',
        federationId: FEDERATION_ID,
        title: 'Test',
        content: 'Content',
        targetAudience: 'all-members',
        targetType: 'all',
        status: 'sent',
        createdBy: USER_ID,
        createdByName: null,
        createdAt: new Date(),
        sentAt: null,
        pinnedAt: new Date(),
        pinnedBy: USER_ID,
      };
      mockAnnouncementRepo.findOne.mockResolvedValue({ ...existing });
      mockAnnouncementRepo.save.mockImplementation(async (entity: Record<string, unknown>) => ({
        ...entity,
      }));

      const result = await service.togglePin(FEDERATION_ID, USER_ID, 'a1');

      expect(result.pinnedAt).toBeNull();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
