import { createMockQueryBuilder } from '@sc-fleet-manager/test-utils';
import { AppDataSource } from '../../config/database';
import { ConflictError, ValidationError } from '../../utils/apiErrors';
import { parseScmdbMissionUrl } from '../../utils/scmdbUtils';
import { MissionService } from '../content/MissionService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/scmdbUtils', () => ({
  parseScmdbMissionUrl: jest.fn(),
  isValidScmdbUrl: jest.fn(),
}));

describe('MissionService - SCMDB methods', () => {
  let missionService: MissionService;
  let mockExternalCatalogRepository: jest.Mocked<any>;
  let mockMissionRepository: jest.Mocked<any>;
  // Stable QB references — same object returned on every createQueryBuilder() call.
  // This ensures test-side mock configuration is visible to production code at runtime.
  let mockExternalCatalogQB: jest.Mocked<any>;
  let mockMissionQB: jest.Mocked<any>;

  const orgId = 'org-123';
  const userId = 'user-456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Stable query-builder objects — each createQueryBuilder() returns the same instance.
    // Uses createMockQueryBuilder() from @sc-fleet-manager/test-utils to avoid repeating
    // jest.fn().mockReturnThis() boilerplate that is duplicated across 10+ test files.
    mockExternalCatalogQB = createMockQueryBuilder();
    mockMissionQB = createMockQueryBuilder();

    // Mock external catalog repository (GLOBAL READ-ONLY — no organizationId field by design).
    // ExternalCatalogRecord is intentionally shared across all organizations.
    // Tests must NOT assert organizationId filtering on this repository.
    mockExternalCatalogRepository = {
      createQueryBuilder: jest.fn(() => mockExternalCatalogQB),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    // Mock mission repository (ORG-SCOPED — all queries include organizationId).
    // Tenant isolation is enforced at this layer, not at the catalog layer.
    mockMissionRepository = {
      createQueryBuilder: jest.fn(() => mockMissionQB),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity.name === 'ExternalCatalogRecord') {
        return mockExternalCatalogRepository;
      }
      if (entity.name === 'Mission') {
        return mockMissionRepository;
      }
      return mockMissionRepository; // Default fallback
    });

    missionService = new MissionService();
  });

  describe('getScmdbAvailableFilters', () => {
    it('should return sorted list of unique categories with counts from SCMDB records', async () => {
      const rawRows = [
        { category: 'combat', count: '5' },
        { category: 'mining', count: '3' },
        { category: 'trading', count: '7' },
      ];
      mockExternalCatalogQB.getRawMany.mockResolvedValue(rawRows);

      const result = await missionService.getScmdbAvailableFilters();

      expect(result.categories).toHaveLength(3);
      expect(result.categories[0]).toEqual({ name: 'combat', count: 5 });
      expect(result.categories[1]).toEqual({ name: 'mining', count: 3 });
      expect(mockExternalCatalogRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should return empty categories array when no SCMDB records exist', async () => {
      mockExternalCatalogQB.getRawMany.mockResolvedValue([]);

      const result = await missionService.getScmdbAvailableFilters();

      expect(result).toEqual({ categories: [] });
    });

    it('should query with correct filters (source=scmdb, recordType=CONTRACT, isActive=true)', async () => {
      mockExternalCatalogQB.getRawMany.mockResolvedValue([]);

      await missionService.getScmdbAvailableFilters();

      // Alias in production code is 'record', not 'ecr'
      expect(mockExternalCatalogQB.where).toHaveBeenCalledWith('record.source = :source', {
        source: 'scmdb',
      });
      expect(mockExternalCatalogQB.andWhere).toHaveBeenCalled();
      expect(mockExternalCatalogQB.orderBy).toHaveBeenCalledWith('record.category', 'ASC');
    });

    it('should return categories object on database error (graceful fallback)', async () => {
      // Production code has try/catch that returns { categories: [] } on error — intentional degradation
      const dbError = new Error('Database connection failed');
      mockExternalCatalogQB.getRawMany.mockRejectedValue(dbError);

      const result = await missionService.getScmdbAvailableFilters();

      // Graceful fallback: does NOT throw, returns empty categories
      expect(result).toEqual({ categories: [] });
    });

    it('should NOT filter by organizationId — catalog is intentionally global', async () => {
      // CRITICAL TENANT ISOLATION CHECK:
      // ExternalCatalogRecord has no organizationId field.
      // getScmdbAvailableFilters() must NOT scope by organization — all orgs see the same catalog.
      mockExternalCatalogQB.getRawMany.mockResolvedValue([]);

      await missionService.getScmdbAvailableFilters();

      // Verify no organizationId filtering was applied to the catalog query
      const whereArgs = (mockExternalCatalogQB.where as jest.Mock).mock.calls.flat();
      const andWhereArgs = (mockExternalCatalogQB.andWhere as jest.Mock).mock.calls.flat();
      const allArgs = [...whereArgs, ...andWhereArgs].join(' ');
      expect(allArgs).not.toContain('organizationId');
    });
  });

  describe('importScmdbMissionByUrl', () => {
    const testUrl = 'https://scmdb.net/contracts/ABC123';
    const testId = 'ABC123';

    describe('successful import', () => {
      it('should parse URL, read from global catalog, and create org-scoped mission', async () => {
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);

        const catalogRecord = {
          id: 'record-1',
          externalId: testId,
          displayName: 'Security Contract',
          category: 'combat',
          payload: { title: 'Security Contract', location: 'Stanton' },
        };

        // Mission duplicate-check returns null (not yet imported in this org)
        mockMissionQB.getOne.mockResolvedValue(null);
        // Catalog lookup returns the global record (no org filter)
        mockExternalCatalogQB.getOne.mockResolvedValue(catalogRecord);
        mockMissionRepository.create.mockReturnValue({ id: 'mission-1', organizationId: orgId });
        mockMissionRepository.save.mockResolvedValue({ id: 'mission-1', organizationId: orgId });

        const result = await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        expect(parseScmdbMissionUrl).toHaveBeenCalledWith(testUrl);
        expect(mockMissionRepository.create).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should use parsed ID if URL is already a bare ID', async () => {
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);

        mockMissionQB.getOne.mockResolvedValue(null);
        mockExternalCatalogQB.getOne.mockResolvedValue({
          externalId: testId,
          displayName: 'Test',
          payload: {},
        });
        mockMissionRepository.create.mockReturnValue({});
        mockMissionRepository.save.mockResolvedValue({});

        await missionService.importScmdbMissionByUrl(orgId, userId, testId);

        expect(parseScmdbMissionUrl).toHaveBeenCalledWith(testId);
      });
    });

    describe('validation errors', () => {
      it('should throw ValidationError if URL is invalid', async () => {
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(null);

        await expect(
          missionService.importScmdbMissionByUrl(orgId, userId, 'invalid-url')
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError with descriptive message', async () => {
        expect.assertions(2);
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(null);

        try {
          await missionService.importScmdbMissionByUrl(orgId, userId, 'bad@url');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          if (err instanceof Error) {
            expect(err.message).toContain('SCMDB');
          }
        }
      });

      it('should throw ValidationError if mission not in catalog', async () => {
        // Production throws ValidationError (not NotFoundError) when mission is missing from SCMDB cache
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);
        mockMissionQB.getOne.mockResolvedValue(null);
        mockExternalCatalogQB.getOne.mockResolvedValue(null);

        await expect(
          missionService.importScmdbMissionByUrl(orgId, userId, testUrl)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError with SCMDB message when mission not in catalog', async () => {
        expect.assertions(2);
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);
        mockMissionQB.getOne.mockResolvedValue(null);
        mockExternalCatalogQB.getOne.mockResolvedValue(null);

        try {
          await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          if (err instanceof Error) {
            expect(err.message).toContain('SCMDB');
          }
        }
      });

      it('should throw ConflictError when mission already imported in the same organization', async () => {
        // TENANT ISOLATION: ConflictError is org-scoped — same mission imported twice in same org
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);
        // Duplicate check returns an existing mission → conflict
        mockMissionQB.getOne.mockResolvedValue({
          id: 'existing-mission-id',
          organizationId: orgId,
        });

        await expect(
          missionService.importScmdbMissionByUrl(orgId, userId, testUrl)
        ).rejects.toThrow(ConflictError);
      });
    });

    describe('tenant scoping', () => {
      beforeEach(() => {
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);
        mockMissionQB.getOne.mockResolvedValue(null);
        mockExternalCatalogQB.getOne.mockResolvedValue({
          externalId: testId,
          displayName: 'Test',
          payload: {},
        });
        mockMissionRepository.create.mockReturnValue({});
        mockMissionRepository.save.mockResolvedValue({});
      });

      it('should set sourceReference to scmdb:<externalId> for DB-level duplicate protection', async () => {
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        const createCall = mockMissionRepository.create.mock.calls[0][0];
        expect(createCall.sourceReference).toBe(`scmdb:${testId}`);
      });

      it('should throw ConflictError when DB unique constraint fires (TOCTOU race)', async () => {
        // Simulate the race condition: soft check passes (no existing mission found),
        // but a concurrent import wins the race and the DB raises a unique-violation (23505).
        const uniqueViolation = Object.assign(
          new Error('duplicate key value violates unique constraint'),
          {
            code: '23505',
          }
        );
        mockMissionRepository.save.mockRejectedValue(uniqueViolation);

        await expect(
          missionService.importScmdbMissionByUrl(orgId, userId, testUrl)
        ).rejects.toThrow(ConflictError);
      });

      it('should create mission in correct organization', async () => {
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        const createCall = mockMissionRepository.create.mock.calls[0][0];
        expect(createCall.organizationId).toBe(orgId);
      });

      it('should attribute mission to correct user', async () => {
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        const createCall = mockMissionRepository.create.mock.calls[0][0];
        expect(createCall.createdBy).toBe(userId);
      });

      it('should NOT filter external catalog by organizationId — catalog is global', async () => {
        // CRITICAL: The SCMDB catalog (ExternalCatalogRecord) is GLOBAL.
        // Reads from this table must NEVER be scoped by organizationId.
        // Org isolation is enforced ONLY when writing/checking Mission records.
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        // Use the stable QB reference — same object the production code used
        const whereArgs = (mockExternalCatalogQB.where as jest.Mock).mock.calls.flat();
        const andWhereArgs = (mockExternalCatalogQB.andWhere as jest.Mock).mock.calls.flat();
        const allCatalogQueryArgs = [...whereArgs, ...andWhereArgs].join(' ');
        expect(allCatalogQueryArgs).not.toContain('organizationId');
      });

      it('should scope duplicate-check query by organizationId — org isolation at Mission layer', async () => {
        // The duplicate-import check runs against Mission (org-scoped), not ExternalCatalogRecord.
        // Verify the mission repo query includes organizationId to prevent cross-org conflicts.
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);

        const missionWhereArgs = (mockMissionQB.where as jest.Mock).mock.calls.flat();
        const allMissionQueryArgs = [...missionWhereArgs].join(' ');
        expect(allMissionQueryArgs).toContain('organizationId');
      });

      it('should allow the same SCMDB mission to be imported into a different organization', async () => {
        // CROSS-ORG ISOLATION: org-A importing mission 123 does NOT block org-B from importing 123.
        // Each org independently tracks its own imports via org-scoped Mission records.
        const orgB = 'org-B';

        // Org A import: success (no conflict)
        await missionService.importScmdbMissionByUrl(orgId, userId, testUrl);
        expect(mockMissionRepository.create).toHaveBeenCalledTimes(1);

        // Re-initialize QB chains after clearing (clearAllMocks resets mockReturnThis() on chains)
        jest.clearAllMocks();
        (parseScmdbMissionUrl as jest.Mock).mockReturnValue(testId);
        // Restore mockReturnThis() on QB chain methods so production chaining still works
        mockExternalCatalogQB.select.mockReturnThis();
        mockExternalCatalogQB.addSelect.mockReturnThis();
        mockExternalCatalogQB.where.mockReturnThis();
        mockExternalCatalogQB.andWhere.mockReturnThis();
        mockExternalCatalogQB.groupBy.mockReturnThis();
        mockExternalCatalogQB.orderBy.mockReturnThis();
        mockMissionQB.where.mockReturnThis();
        mockMissionQB.andWhere.mockReturnThis();
        mockMissionQB.getOne.mockResolvedValue(null); // No conflict in org-B
        mockExternalCatalogQB.getOne.mockResolvedValue({
          externalId: testId,
          displayName: 'Test',
          payload: {},
        });
        mockMissionRepository.create.mockReturnValue({ organizationId: orgB });
        mockMissionRepository.save.mockResolvedValue({ organizationId: orgB });

        // Org B import: also succeeds
        await missionService.importScmdbMissionByUrl(orgB, userId, testUrl);
        expect(mockMissionRepository.create).toHaveBeenCalledTimes(1);
        const orgBCreate = mockMissionRepository.create.mock.calls[0][0];
        expect(orgBCreate.organizationId).toBe(orgB);
      });
    });
  });
});
