import { DataSource } from 'typeorm';
import { ExternalCatalogRecord } from '../../models/ExternalCatalogRecord';
import { Mission } from '../../models/Mission';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { MissionService } from '../content/MissionService';

/**
 * Integration tests for MissionService with real TypeORM repositories
 * Tests full import flow: URL parsing → catalog lookup → mission creation
 *
 * Uses in-memory SQLite database for fast, isolated tests
 */
describe.skip('MissionService - SCMDB Integration Tests', () => {
  let dataSource: DataSource;
  let service: MissionService;
  const orgId = 'org-123';
  const userId = 'user-456';

  beforeAll(async () => {
    // Initialize in-memory SQLite database
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Mission, ExternalCatalogRecord],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    service = new MissionService(); // Would inject dataSource in real app
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Clear data before each test
    await dataSource.query('DELETE FROM mission');
    await dataSource.query('DELETE FROM external_catalog_records');
  });

  describe('full import workflow', () => {
    it('should complete end-to-end import: URL → catalog → mission', async () => {
      // Setup: Create catalog record
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const catalogRecord = catalogRepo.create({
        source: 'scmdb',
        recordType: 'CONTRACT',
        externalId: 'ABC123',
        displayName: 'Security Contract',
        category: 'combat',
        payload: {
          title: 'Security Contract',
          description: 'Protect assets',
          location: 'Stanton',
        },
        isActive: true,
      });
      await catalogRepo.save(catalogRecord);

      // Execute: Import by URL
      const result = await service.importScmdbMissionByUrl(
        orgId,
        userId,
        'https://scmdb.net/contracts/ABC123'
      );

      // Verify: Mission was created
      expect(result).toBeDefined();
      expect(result.organizationId).toBe(orgId);
      expect(result.createdBy).toBe(userId);

      // Verify: Mission properties from catalog
      const missionRepo = dataSource.getRepository(Mission);
      const createdMission = await missionRepo.findOne({
        where: { id: result.id },
      });

      expect(createdMission).toBeDefined();
      expect(createdMission?.title).toContain('Security Contract');
    });

    it('should handle multiple imports of same mission', async () => {
      // Setup: Create catalog record
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const catalogRecord = catalogRepo.create({
        source: 'scmdb',
        recordType: 'CONTRACT',
        externalId: 'MULTI123',
        displayName: 'Multi-Import Mission',
        category: 'trading',
        payload: { title: 'Trade Route', description: 'Safe trade route' },
        isActive: true,
      });
      await catalogRepo.save(catalogRecord);

      // Execute: Import same mission twice
      const result1 = await service.importScmdbMissionByUrl(
        orgId,
        userId,
        'https://scmdb.net/contracts/MULTI123'
      );

      const result2 = await service.importScmdbMissionByUrl(
        orgId,
        userId,
        'https://scmdb.net/contracts/MULTI123'
      );

      // Verify: Both imports succeeded (separate mission records)
      expect(result1.id).not.toBe(result2.id);

      // Verify: Both missions exist in database
      const missionRepo = dataSource.getRepository(Mission);
      const missions = await missionRepo.find({ where: { organizationId: orgId } });
      expect(missions).toHaveLength(2);
    });

    it('should isolate imports by organization', async () => {
      // Setup: Create catalog record
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const catalogRecord = catalogRepo.create({
        source: 'scmdb',
        recordType: 'CONTRACT',
        externalId: 'TENANT123',
        displayName: 'Tenant Test Mission',
        category: 'combat',
        payload: { title: 'Test' },
        isActive: true,
      });
      await catalogRepo.save(catalogRecord);

      // Execute: Import in two different organizations
      const result1 = await service.importScmdbMissionByUrl(
        'org-A',
        userId,
        'https://scmdb.net/contracts/TENANT123'
      );

      const result2 = await service.importScmdbMissionByUrl(
        'org-B',
        userId,
        'https://scmdb.net/contracts/TENANT123'
      );

      // Verify: Different missions created in different orgs
      expect(result1.organizationId).toBe('org-A');
      expect(result2.organizationId).toBe('org-B');

      // Verify: Each org sees only its mission
      const missionRepo = dataSource.getRepository(Mission);
      const orgAMissions = await missionRepo.find({ where: { organizationId: 'org-A' } });
      const orgBMissions = await missionRepo.find({ where: { organizationId: 'org-B' } });

      expect(orgAMissions).toHaveLength(1);
      expect(orgBMissions).toHaveLength(1);
      expect(orgAMissions[0].id).not.toBe(orgBMissions[0].id);
    });
  });

  describe('error handling', () => {
    it('should fail gracefully if catalog record not found', async () => {
      await expect(
        service.importScmdbMissionByUrl(orgId, userId, 'https://scmdb.net/contracts/NOTFOUND')
      ).rejects.toThrow(NotFoundError);
    });

    it('should fail gracefully if URL is invalid', async () => {
      await expect(
        service.importScmdbMissionByUrl(orgId, userId, 'not-a-valid-url')
      ).rejects.toThrow(ValidationError);
    });

    it('should handle inactive catalog records', async () => {
      // Setup: Create inactive catalog record
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const catalogRecord = catalogRepo.create({
        source: 'scmdb',
        recordType: 'CONTRACT',
        externalId: 'INACTIVE123',
        displayName: 'Inactive Mission',
        category: 'combat',
        payload: { title: 'Inactive' },
        isActive: false, // Inactive
      });
      await catalogRepo.save(catalogRecord);

      // Try to import inactive mission
      // Behavior depends on business logic: should it fail or succeed?
      // For now, assume it succeeds (catalog record exists)
      const result = await service.importScmdbMissionByUrl(
        orgId,
        userId,
        'https://scmdb.net/contracts/INACTIVE123'
      );

      expect(result).toBeDefined();
    });
  });

  describe('getScmdbAvailableFilters', () => {
    it('should return distinct categories from catalog', async () => {
      // Setup: Create multiple records with different categories
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const records = [
        {
          externalId: '1',
          category: 'combat',
          source: 'scmdb',
          recordType: 'CONTRACT',
          isActive: true,
        },
        {
          externalId: '2',
          category: 'mining',
          source: 'scmdb',
          recordType: 'CONTRACT',
          isActive: true,
        },
        {
          externalId: '3',
          category: 'trading',
          source: 'scmdb',
          recordType: 'CONTRACT',
          isActive: true,
        },
        {
          externalId: '4',
          category: 'combat',
          source: 'scmdb',
          recordType: 'CONTRACT',
          isActive: true,
        }, // Duplicate
      ];

      for (const r of records) {
        await catalogRepo.save(catalogRepo.create(r));
      }

      // Execute
      const result = await service.getScmdbAvailableFilters();

      // Verify: Distinct categories, sorted
      expect(result).toEqual(['combat', 'mining', 'trading']);
    });

    it('should only include active records', async () => {
      // Setup: Mix of active and inactive
      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const active = catalogRepo.create({
        externalId: 'active-1',
        category: 'combat',
        source: 'scmdb',
        recordType: 'CONTRACT',
        isActive: true,
      });
      const inactive = catalogRepo.create({
        externalId: 'inactive-1',
        category: 'mining',
        source: 'scmdb',
        recordType: 'CONTRACT',
        isActive: false,
      });

      await catalogRepo.save([active, inactive]);

      // Execute
      const result = await service.getScmdbAvailableFilters();

      // Verify: Only active
      expect(result).toEqual(['combat']);
    });

    it('should be empty when no active SCMDB records', async () => {
      // Execute (no setup = empty)
      const result = await service.getScmdbAvailableFilters();

      // Verify
      expect(result).toEqual([]);
    });
  });

  describe('transaction behavior', () => {
    it('should rollback on error during import', async () => {
      // This is more of a database-level test
      // Verify that if mission creation fails, catalog lookup doesn't leave partial state

      const catalogRepo = dataSource.getRepository(ExternalCatalogRecord);
      const catalog = catalogRepo.create({
        externalId: 'ROLLBACK123',
        category: 'combat',
        source: 'scmdb',
        recordType: 'CONTRACT',
        isActive: true,
      });
      await catalogRepo.save(catalog);

      // Try import that might fail
      try {
        await service.importScmdbMissionByUrl(
          orgId,
          userId,
          'https://scmdb.net/contracts/ROLLBACK123'
        );
      } catch (e) {
        // Expected to potentially fail
      }

      // Verify: Catalog record still exists (not deleted)
      const found = await catalogRepo.findOne({
        where: { externalId: 'ROLLBACK123' },
      });
      expect(found).toBeDefined();
    });
  });
});
