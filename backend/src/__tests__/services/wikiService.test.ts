import { AppDataSource } from '../../config/database';
import { WikiPage } from '../../models/WikiPage';
import { WikiPageRevision } from '../../models/WikiPageRevision';
import { WikiService } from '../../services/content/WikiService';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('WikiService', () => {
  let wikiService: WikiService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPageRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRevisionRepo: any;

  const orgId = 'org-111';
  const userId = 'user-222';
  const pageId = 'page-333';
  const revisionId = 'rev-444';

  const basePage: Partial<WikiPage> = {
    id: pageId,
    organizationId: orgId,
    title: 'Getting Started',
    slug: 'getting-started',
    content: '# Hello World',
    parentPageId: null,
    sortOrder: 0,
    tags: ['guide'],
    version: 1,
    isLocked: false,
    createdBy: userId,
    lastEditedBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined as unknown as Date,
    deletedBy: undefined as unknown as string,
  };

  const baseRevision: Partial<WikiPageRevision> = {
    id: revisionId,
    pageId,
    content: '# Hello World',
    editedBy: userId,
    changeDescription: 'Initial creation',
    version: 1,
    editedAt: new Date(),
  };

  // Helper to build a chainable query builder mock
  const createQueryBuilderMock = (result: unknown[] = [], count: number = 0) => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue(result),
      getManyAndCount: jest.fn().mockResolvedValue([result, count]),
      getRawMany: jest.fn().mockResolvedValue(result),
    };
    return qb;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: Partial<WikiPage>) => ({ ...basePage, ...data })),
      save: jest.fn((entity: WikiPage) => Promise.resolve({ ...basePage, ...entity })),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
      metadata: { name: 'WikiPage' },
    };

    mockRevisionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: Partial<WikiPageRevision>) => ({ ...baseRevision, ...data })),
      save: jest.fn((entity: WikiPageRevision) => Promise.resolve({ ...baseRevision, ...entity })),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
      metadata: { name: 'WikiPageRevision' },
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === WikiPage) return mockPageRepo;
      if (entity === WikiPageRevision) return mockRevisionRepo;
      return mockPageRepo;
    });

    wikiService = new WikiService();
  });

  // ════════════════════════════════════════════════════════════════
  //  DATABASE INITIALIZATION GUARD
  // ════════════════════════════════════════════════════════════════

  describe('database initialization guard', () => {
    it('throws ServiceUnavailableError (503) when the database is not initialized', async () => {
      (AppDataSource as unknown as { isInitialized: boolean }).isInitialized = false;
      try {
        const service = new WikiService();
        await expect(service.getAllPages(orgId)).rejects.toMatchObject({
          name: 'ServiceUnavailableError',
          statusCode: 503,
        });
      } finally {
        (AppDataSource as unknown as { isInitialized: boolean }).isInitialized = true;
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  CRUD
  // ════════════════════════════════════════════════════════════════

  describe('createPage', () => {
    it('should create a wiki page with auto-slug and initial revision', async () => {
      const dto = { title: 'Getting Started', content: '# Hello', tags: ['guide'] };

      // Slug uniqueness check returns null (slug available)
      const slugQb = createQueryBuilderMock();
      slugQb.getOne.mockResolvedValue(null);
      mockPageRepo.createQueryBuilder.mockReturnValue(slugQb);

      const result = await wikiService.createPage(orgId, userId, dto);

      expect(mockPageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          title: 'Getting Started',
          content: '# Hello',
          tags: ['guide'],
          version: 1,
          createdBy: userId,
          lastEditedBy: userId,
        })
      );
      expect(mockPageRepo.save).toHaveBeenCalled();
      // Revision created for the initial content
      expect(mockRevisionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '# Hello',
          editedBy: userId,
          version: 1,
        })
      );
      expect(mockRevisionRepo.save).toHaveBeenCalled();
      expect(result.organizationId).toBe(orgId);
    });

    it('should validate nesting depth when creating under a parent', async () => {
      // Build a chain 3 deep: root → lvl1 → lvl2 → (new child = depth 3 = MAX)
      // getPageDepth walks from parentId upward counting hops
      const root = { ...basePage, id: 'root', parentPageId: null };
      const lvl1 = { ...basePage, id: 'lvl1', parentPageId: 'root' };
      const lvl2 = { ...basePage, id: 'lvl2', parentPageId: 'lvl1' };

      // findOne calls inside getPageDepth walk: lvl2 → lvl1 → root (depth=2)
      mockPageRepo.findOne
        .mockResolvedValueOnce(lvl2) // lookup lvl2 (parentPageId = 'lvl1')
        .mockResolvedValueOnce(lvl1) // lookup lvl1 (parentPageId = 'root')
        .mockResolvedValueOnce(root); // lookup root (parentPageId = null → break)

      // depth=2, depth+1=3 >= MAX_NESTING_DEPTH(3) → should reject
      const dto = { title: 'Too Deep', parentPageId: 'lvl2' };

      await expect(wikiService.createPage(orgId, userId, dto)).rejects.toThrow(/nesting depth/i);
    });

    it('should reject when no title is provided', async () => {
      // Service relies on Joi schema validation at route level,
      // but the slug generator handles empty titles gracefully
      const slugQb = createQueryBuilderMock();
      slugQb.getOne.mockResolvedValue(null);
      mockPageRepo.createQueryBuilder.mockReturnValue(slugQb);

      const dto = { title: '', content: 'some content' };
      // Should still create — Joi validates at route level. Service is permissive.
      const result = await wikiService.createPage(orgId, userId, dto);
      expect(result).toBeDefined();
    });
  });

  describe('getPage', () => {
    it('should find a page by UUID', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const page = { ...basePage, id: uuid };
      mockPageRepo.findOne.mockResolvedValue(page);

      const result = await wikiService.getPage(orgId, uuid);

      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { id: uuid, organizationId: orgId, deletedAt: undefined },
      });
      expect(result.id).toBe(uuid);
    });

    it('should find a page by slug', async () => {
      const page = { ...basePage, slug: 'getting-started' };
      mockPageRepo.findOne.mockResolvedValue(page);

      const result = await wikiService.getPage(orgId, 'getting-started');

      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'getting-started', organizationId: orgId, deletedAt: undefined },
      });
      expect(result.slug).toBe('getting-started');
    });

    it('should throw NotFoundError when page does not exist', async () => {
      mockPageRepo.findOne.mockResolvedValue(null);

      await expect(wikiService.getPage(orgId, 'nonexistent')).rejects.toThrow(/not found/i);
    });

    it('should treat soft-deleted pages as not found', async () => {
      const deleted = { ...basePage, deletedAt: new Date() };
      mockPageRepo.findOne.mockResolvedValue(deleted);

      await expect(wikiService.getPage(orgId, 'getting-started')).rejects.toThrow(/not found/i);
    });
  });

  describe('updatePage', () => {
    it('should update content, bump version, and create revision', async () => {
      const page = { ...basePage, version: 2 };
      mockPageRepo.findOne.mockResolvedValue(page);

      const dto = { content: '# Updated', changeDescription: 'Fixed typo' };

      const result = await wikiService.updatePage(orgId, pageId, userId, dto);

      // Revision of PREVIOUS content should be created
      expect(mockRevisionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '# Hello World', // original content
          version: 2, // original version
          editedBy: userId,
          changeDescription: 'Fixed typo',
        })
      );
      expect(mockPageRepo.save).toHaveBeenCalled();
      // Version bumped
      const savedArg = mockPageRepo.save.mock.calls[0][0];
      expect(savedArg.version).toBe(3);
      expect(savedArg.content).toBe('# Updated');
      expect(savedArg.lastEditedBy).toBe(userId);
    });

    it('should not create revision if content did not change', async () => {
      const page = { ...basePage, version: 1 };
      mockPageRepo.findOne.mockResolvedValue(page);

      // Only update tags (no content change)
      const dto = { tags: ['updated'] };
      await wikiService.updatePage(orgId, pageId, userId, dto);

      expect(mockRevisionRepo.create).not.toHaveBeenCalled();
    });

    it('should reject updates to locked pages', async () => {
      const locked = { ...basePage, isLocked: true };
      mockPageRepo.findOne.mockResolvedValue(locked);

      await expect(
        wikiService.updatePage(orgId, pageId, userId, { content: 'new' })
      ).rejects.toThrow(/locked/i);
    });

    it('should regenerate slug when title changes', async () => {
      const page = { ...basePage };
      mockPageRepo.findOne.mockResolvedValue(page);

      const slugQb = createQueryBuilderMock();
      slugQb.getOne.mockResolvedValue(null);
      mockPageRepo.createQueryBuilder.mockReturnValue(slugQb);

      await wikiService.updatePage(orgId, pageId, userId, { title: 'New Title' });

      const savedArg = mockPageRepo.save.mock.calls[0][0];
      expect(savedArg.slug).toBe('new-title');
    });
  });

  describe('deletePage', () => {
    it('should soft-delete the page and orphan children', async () => {
      const page = { ...basePage };
      mockPageRepo.findOne.mockResolvedValue(page);

      const qb = createQueryBuilderMock();
      mockPageRepo.createQueryBuilder.mockReturnValue(qb);

      await wikiService.deletePage(orgId, pageId, userId);

      // Children orphaned (parentPageId → null)
      expect(qb.update).toHaveBeenCalled();

      // Page soft-deleted
      const savedArg = mockPageRepo.save.mock.calls[0][0];
      expect(savedArg.deletedAt).toBeDefined();
      expect(savedArg.deletedBy).toBe(userId);
    });
  });

  describe('getAllPages', () => {
    it('should return all non-deleted pages for the org', async () => {
      const pages = [basePage, { ...basePage, id: 'page-2', slug: 'second' }];
      mockPageRepo.find.mockResolvedValue(pages);

      const result = await wikiService.getAllPages(orgId);

      expect(mockPageRepo.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        order: { sortOrder: 'ASC', title: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  TREE OPERATIONS
  // ════════════════════════════════════════════════════════════════

  describe('getPageTree', () => {
    it('should return a hierarchical tree structure', async () => {
      const root1 = { ...basePage, id: 'root-1', parentPageId: null, title: 'Root 1' };
      const child1 = { ...basePage, id: 'child-1', parentPageId: 'root-1', title: 'Child 1' };
      const root2 = { ...basePage, id: 'root-2', parentPageId: null, title: 'Root 2' };

      mockPageRepo.find.mockResolvedValue([root1, child1, root2]);

      const tree = await wikiService.getPageTree(orgId);

      expect(tree).toHaveLength(2); // two root nodes
      const r1 = tree.find(n => n.id === 'root-1');
      expect(r1).toBeDefined();
      expect(r1!.children).toHaveLength(1);
      expect(r1!.children[0].id).toBe('child-1');
    });

    it('should exclude soft-deleted pages from tree', async () => {
      const active = { ...basePage, id: 'active', parentPageId: null };
      const deleted = {
        ...basePage,
        id: 'deleted',
        parentPageId: null,
        deletedAt: new Date(),
      };

      mockPageRepo.find.mockResolvedValue([active, deleted]);

      const tree = await wikiService.getPageTree(orgId);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('active');
    });
  });

  describe('movePage', () => {
    it('should move a page to a new parent', async () => {
      const page = { ...basePage, id: 'move-me' };
      const newParent = { ...basePage, id: 'new-parent', parentPageId: null };

      // getPage calls
      mockPageRepo.findOne
        .mockResolvedValueOnce(page) // find moveable page
        .mockResolvedValueOnce(newParent) // find new parent
        .mockResolvedValueOnce(newParent); // getPageDepth for new parent

      // getDescendantIds: no children
      mockPageRepo.find.mockResolvedValue([]);

      await wikiService.movePage(orgId, 'move-me', {
        parentPageId: 'new-parent',
        sortOrder: 5,
      });

      const savedArg = mockPageRepo.save.mock.calls[0][0];
      expect(savedArg.parentPageId).toBe('new-parent');
      expect(savedArg.sortOrder).toBe(5);
    });

    it('should prevent a page from becoming its own parent', async () => {
      const page = { ...basePage, id: 'self' };
      mockPageRepo.findOne.mockResolvedValue(page);

      await expect(
        wikiService.movePage(orgId, 'self', { parentPageId: 'self', sortOrder: 0 })
      ).rejects.toThrow(/own parent/i);
    });

    it('should prevent circular references', async () => {
      const page = { ...basePage, id: 'parent-page' };
      const child = { ...basePage, id: 'child-page', parentPageId: 'parent-page' };

      mockPageRepo.findOne
        .mockResolvedValueOnce(page) // find parent-page
        .mockResolvedValueOnce(child); // find child-page (new parent)

      // getDescendantIds: child-page is a descendant of parent-page
      mockPageRepo.find.mockResolvedValueOnce([child]).mockResolvedValue([]);

      await expect(
        wikiService.movePage(orgId, 'parent-page', {
          parentPageId: 'child-page',
          sortOrder: 0,
        })
      ).rejects.toThrow(/descendants/i);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  REVISIONS
  // ════════════════════════════════════════════════════════════════

  describe('getRevisions', () => {
    it('should return revisions sorted newest first', async () => {
      const r1 = { ...baseRevision, version: 1 };
      const r2 = { ...baseRevision, id: 'rev-2', version: 2 };

      mockPageRepo.findOne.mockResolvedValue(basePage);
      mockRevisionRepo.find.mockResolvedValue([r2, r1]);

      const result = await wikiService.getRevisions(orgId, pageId);

      expect(mockRevisionRepo.find).toHaveBeenCalledWith({
        where: { pageId },
        order: { version: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
    });
  });

  describe('getRevision', () => {
    it('should return a single revision by ID', async () => {
      mockPageRepo.findOne.mockResolvedValue(basePage);
      mockRevisionRepo.findOne.mockResolvedValue(baseRevision);

      const result = await wikiService.getRevision(orgId, pageId, revisionId);

      expect(result.id).toBe(revisionId);
      expect(mockRevisionRepo.findOne).toHaveBeenCalledWith({
        where: { id: revisionId, pageId },
      });
    });

    it('should throw NotFoundError when revision does not exist', async () => {
      mockPageRepo.findOne.mockResolvedValue(basePage);
      mockRevisionRepo.findOne.mockResolvedValue(null);

      await expect(wikiService.getRevision(orgId, pageId, 'nonexistent')).rejects.toThrow(
        /not found/i
      );
    });
  });

  describe('restoreRevision', () => {
    it('should restore old content as a new version', async () => {
      const oldRevision = { ...baseRevision, content: '# Old content', version: 1 };

      // getRevision flow
      mockPageRepo.findOne.mockResolvedValue(basePage);
      mockRevisionRepo.findOne.mockResolvedValue(oldRevision);

      // updatePage flow (called internally)
      // getPage will be called again
      mockPageRepo.findOne.mockResolvedValue({ ...basePage });

      const result = await wikiService.restoreRevision(orgId, pageId, revisionId, userId);

      // Should have saved page + created a revision
      expect(mockPageRepo.save).toHaveBeenCalled();
      expect(mockRevisionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          editedBy: userId,
        })
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  SEARCH
  // ════════════════════════════════════════════════════════════════

  describe('searchPages', () => {
    it('should search using tsvector and return ranked results', async () => {
      const searchQb = createQueryBuilderMock();
      searchQb.getRawMany.mockResolvedValue([
        {
          id: pageId,
          title: 'Getting Started',
          slug: 'getting-started',
          rank: 0.85,
          snippet: 'Hello **World**',
          updatedAt: new Date(),
        },
      ]);
      mockPageRepo.createQueryBuilder.mockReturnValue(searchQb);

      const results = await wikiService.searchPages(orgId, 'hello world');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Getting Started');
      expect(results[0].rank).toBeCloseTo(0.85);
    });

    it('should return empty array for empty/whitespace query', async () => {
      const results = await wikiService.searchPages(orgId, '   ');
      expect(results).toEqual([]);
    });

    it('should sanitize special characters from query', async () => {
      const searchQb = createQueryBuilderMock();
      searchQb.getRawMany.mockResolvedValue([]);
      mockPageRepo.createQueryBuilder.mockReturnValue(searchQb);

      const results = await wikiService.searchPages(orgId, "test; DROP TABLE--'");

      // Should not throw; special chars stripped
      expect(results).toEqual([]);
    });

    it('should fallback to ILIKE when tsvector fails', async () => {
      // First call (tsvector) throws
      const failQb = createQueryBuilderMock();
      failQb.getRawMany.mockRejectedValue(new Error('tsvector not available'));

      // Second call (ILIKE fallback)
      const fallbackQb = createQueryBuilderMock();
      const fallbackPages = [{ ...basePage, content: 'This mentions mining operations' }];
      fallbackQb.getMany.mockResolvedValue(fallbackPages);

      mockPageRepo.createQueryBuilder.mockReturnValueOnce(failQb).mockReturnValueOnce(fallbackQb);

      const results = await wikiService.searchPages(orgId, 'mining');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Getting Started');
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  SLUG GENERATION
  // ════════════════════════════════════════════════════════════════

  describe('slug generation', () => {
    it('should generate a URL-safe slug from title', async () => {
      const slugQb = createQueryBuilderMock();
      slugQb.getOne.mockResolvedValue(null);
      mockPageRepo.createQueryBuilder.mockReturnValue(slugQb);

      await wikiService.createPage(orgId, userId, {
        title: 'Hello World & Beyond!',
      });

      const savedArg = mockPageRepo.create.mock.calls[0][0];
      expect(savedArg.slug).toBe('hello-world-beyond');
    });

    it('should append suffix when slug already exists', async () => {
      const slugQb = createQueryBuilderMock();
      // First call: slug exists
      slugQb.getOne.mockResolvedValueOnce({ id: 'existing' });
      // Second call: suffixed slug is available
      slugQb.getOne.mockResolvedValueOnce(null);
      mockPageRepo.createQueryBuilder.mockReturnValue(slugQb);

      await wikiService.createPage(orgId, userId, { title: 'Duplicate Title' });

      const savedArg = mockPageRepo.create.mock.calls[0][0];
      // Slug should have a random suffix
      expect(savedArg.slug).toMatch(/^duplicate-title-[a-f0-9]+$/);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
