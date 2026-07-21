jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationWikiService } from '../../services/federation/FederationWikiService';

describe('FederationWikiService', () => {
  let service: FederationWikiService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPageRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRevisionRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockPageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockRevisionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      }),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'WikiPage') return mockPageRepo;
      if (name === 'WikiPageRevision') return mockRevisionRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationWikiService();
  });

  // ─── createPage ───────────────────────────────────────────

  describe('createPage', () => {
    it('should create a wiki page with revision', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockPageRepo.findOne.mockResolvedValue(null); // no slug conflict

      const newPage = {
        id: 'page-1',
        federationId: FEDERATION_ID,
        title: 'Getting Started',
        slug: 'getting-started',
        content: 'Welcome!',
        version: 1,
        createdBy: USER_ID,
        organizationId: FEDERATION_ID,
        federationVisibility: 'members',
        parentPageId: null,
        tags: [],
        isLocked: false,
        lastEditedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPageRepo.create.mockReturnValue(newPage);
      mockPageRepo.save.mockResolvedValue(newPage);
      mockRevisionRepo.create.mockReturnValue({});
      mockRevisionRepo.save.mockResolvedValue({});

      const result = await service.createPage(FEDERATION_ID, USER_ID, {
        title: 'Getting Started',
        content: 'Welcome!',
      });

      expect(result.id).toBe('page-1');
      expect(result.title).toBe('Getting Started');
      expect(mockPageRepo.save).toHaveBeenCalled();
      expect(mockRevisionRepo.save).toHaveBeenCalled();
    });

    it('should reject if user lacks wiki permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(service.createPage(FEDERATION_ID, USER_ID, { title: 'Test' })).rejects.toThrow(
        'wiki permission required'
      );
    });
  });

  // ─── listPages ────────────────────────────────────────────

  describe('listPages', () => {
    it('should return all pages for a federation', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      const pages = [
        { id: 'p1', title: 'Page 1', federationId: FEDERATION_ID },
        { id: 'p2', title: 'Page 2', federationId: FEDERATION_ID },
      ];
      mockPageRepo.find.mockResolvedValue(pages);

      const result = await service.listPages(FEDERATION_ID, USER_ID);

      expect(result).toHaveLength(2);
      expect(mockPageRepo.find).toHaveBeenCalledWith({
        where: { federationId: FEDERATION_ID },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });

    it('should reject if user lacks view permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(service.listPages(FEDERATION_ID, USER_ID)).rejects.toThrow('ambassador');
    });
  });

  // ─── updatePage ───────────────────────────────────────────

  describe('updatePage', () => {
    it('should update page content and create revision', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const existing = {
        id: 'p1',
        federationId: FEDERATION_ID,
        title: 'Old Title',
        content: 'Old content',
        version: 1,
        isLocked: false,
        lastEditedBy: null,
      };
      mockPageRepo.findOne.mockResolvedValue({ ...existing });

      const updated = { ...existing, title: 'New Title', content: 'New content', version: 2 };
      mockPageRepo.save.mockResolvedValue(updated);
      mockRevisionRepo.create.mockReturnValue({});
      mockRevisionRepo.save.mockResolvedValue({});

      const result = await service.updatePage(FEDERATION_ID, USER_ID, 'p1', {
        title: 'New Title',
        content: 'New content',
      });

      expect(result.title).toBe('New Title');
      expect(mockRevisionRepo.save).toHaveBeenCalled();
    });

    it('should reject if page is locked', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockPageRepo.findOne.mockResolvedValue({
        id: 'p1',
        federationId: FEDERATION_ID,
        isLocked: true,
      });

      await expect(
        service.updatePage(FEDERATION_ID, USER_ID, 'p1', { content: 'New' })
      ).rejects.toThrow('locked');
    });

    it('should throw NotFoundError if page not found', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockPageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePage(FEDERATION_ID, USER_ID, 'nonexistent', { content: 'x' })
      ).rejects.toThrow('not found');
    });
  });

  // ─── deletePage ───────────────────────────────────────────

  describe('deletePage', () => {
    it('should delete page and revisions', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockPageRepo.findOne.mockResolvedValue({
        id: 'p1',
        federationId: FEDERATION_ID,
      });
      // No descendants
      mockPageRepo.find.mockResolvedValue([]);

      await service.deletePage(FEDERATION_ID, USER_ID, 'p1');

      expect(mockRevisionRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockPageRepo.delete).toHaveBeenCalledWith(['p1']);
    });

    it('should throw NotFoundError if page not found', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockPageRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePage(FEDERATION_ID, USER_ID, 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
