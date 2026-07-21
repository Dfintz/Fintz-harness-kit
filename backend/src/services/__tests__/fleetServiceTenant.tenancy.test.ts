import { mockAppDataSource } from '../../__tests__/helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import { resetFullTextSearchCache } from '../../utils/query/fullTextSearch';
import { FleetService } from '../fleet';

describe('FleetService - Multi-Tenancy Tests', () => {
  let fleetService: FleetService;
  const ORG_A = 'test-org-a';
  const ORG_B = 'test-org-b';
  const ORG_C = 'test-org-c';

  let testFleetA: Fleet;
  let testFleetA2: Fleet;
  let testFleetB: Fleet;
  let testFleetC: Fleet;

  beforeAll(async () => {
    resetFullTextSearchCache();
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    fleetService = new FleetService();

    // Create test fleets for each organization
    // ORG_A gets 2 fleets to ensure different fleet counts for the
    // "should not include other organization fleets in statistics" test
    testFleetA = await fleetService.createFleet(ORG_A, {
      id: 'fleet-a-1',
      name: 'Alpha Fleet',
      members: ['user1', 'user2'],
    });

    testFleetA2 = await fleetService.createFleet(ORG_A, {
      id: 'fleet-a-2',
      name: 'Alpha Fleet 2',
      members: ['user6'],
    });

    testFleetB = await fleetService.createFleet(ORG_B, {
      id: 'fleet-b-1',
      name: 'Bravo Fleet',
      members: ['user3', 'user4'],
    });

    testFleetC = await fleetService.createFleet(ORG_C, {
      id: 'fleet-c-1',
      name: 'Charlie Fleet',
      members: ['user5'],
    });
  });

  afterAll(async () => {
    // Cleanup
    const fleetRepo = AppDataSource.getRepository(Fleet);
    await fleetRepo.delete({ id: testFleetA.id });
    await fleetRepo.delete({ id: testFleetA2.id });
    await fleetRepo.delete({ id: testFleetB.id });
    await fleetRepo.delete({ id: testFleetC.id });

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('Tenant Isolation', () => {
    it('should only return fleets for the requesting organization', async () => {
      const orgAFleets = await fleetService.getAllFleets(ORG_A);
      const orgBFleets = await fleetService.getAllFleets(ORG_B);

      expect(orgAFleets.length).toBeGreaterThanOrEqual(1);
      expect(orgBFleets.length).toBeGreaterThanOrEqual(1);

      expect(orgAFleets.every(f => f.organizationId === ORG_A)).toBe(true);
      expect(orgBFleets.every(f => f.organizationId === ORG_B)).toBe(true);

      const orgAHasOrgBFleet = orgAFleets.some(f => f.id === testFleetB.id);
      expect(orgAHasOrgBFleet).toBe(false);
    });

    it('should not allow Org B to access Org A fleet by ID', async () => {
      const fleet = await fleetService.getFleetById(ORG_B, testFleetA.id);
      expect(fleet).toBeNull();
    });

    it('should allow organization to access their own fleet', async () => {
      const fleet = await fleetService.getFleetById(ORG_A, testFleetA.id);
      expect(fleet).not.toBeNull();
      expect(fleet?.id).toBe(testFleetA.id);
      expect(fleet?.organizationId).toBe(ORG_A);
    });

    it('should not update fleet from different organization', async () => {
      const updated = await fleetService.updateFleet(ORG_B, testFleetA.id, {
        name: 'Hacked Fleet',
      });

      expect(updated).toBeNull();

      // Verify original fleet unchanged
      const original = await fleetService.getFleetById(ORG_A, testFleetA.id);
      expect(original?.name).toBe('Alpha Fleet');
    });

    it('should not delete fleet from different organization', async () => {
      await expect(fleetService.deleteFleet(ORG_B, testFleetA.id)).rejects.toThrow();

      // Verify fleet still exists
      const fleet = await fleetService.getFleetById(ORG_A, testFleetA.id);
      expect(fleet).not.toBeNull();
    });
  });

  describe('Fleet CRUD Operations', () => {
    it('should create fleet with correct organization ID', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-test-create',
        name: 'Test Create Fleet',
        members: [],
      });

      expect(fleet.organizationId).toBe(ORG_A);
      expect(fleet.name).toBe('Test Create Fleet');

      // Cleanup
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should update fleet successfully within same organization', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-test-update',
        name: 'Original Name',
        members: [],
      });

      const updated = await fleetService.updateFleet(ORG_A, fleet.id, {
        name: 'Updated Name',
        members: ['newUser1', 'newUser2'],
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.members).toEqual(['newUser1', 'newUser2']);

      // Cleanup
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should delete fleet successfully within same organization', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-test-delete',
        name: 'To Be Deleted',
        members: [],
      });

      await fleetService.deleteFleet(ORG_A, fleet.id);

      const deleted = await fleetService.getFleetById(ORG_A, fleet.id);
      expect(deleted).toBeNull();
    });

    it('should get fleet count for organization', async () => {
      const count = await fleetService.getFleetCount(ORG_A);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cross-Organization Sharing', () => {
    it('should share fleet with another organization', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-share-test',
        name: 'Fleet to Share',
        members: [],
      });

      const shared = await fleetService.shareFleetWith(ORG_A, fleet.id, ORG_B);

      expect(shared).not.toBeNull();
      expect(shared?.sharedWithOrgs).toContain(ORG_B);

      // Cleanup
      await fleetService.unshareFleetWith(ORG_A, fleet.id, ORG_B);
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should allow shared organization to view shared fleet', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-view-shared',
        name: 'Shared Fleet',
        members: [],
      });

      await fleetService.shareFleetWith(ORG_A, fleet.id, ORG_B);

      const sharedFleets = await fleetService.getSharedFleets(ORG_B);
      const foundFleet = sharedFleets.find(f => f.id === fleet.id);

      expect(foundFleet).toBeDefined();
      expect(foundFleet?.organizationId).toBe(ORG_A);

      // Cleanup
      await fleetService.unshareFleetWith(ORG_A, fleet.id, ORG_B);
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should unshare fleet from organization', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-unshare-test',
        name: 'Fleet to Unshare',
        members: [],
      });

      await fleetService.shareFleetWith(ORG_A, fleet.id, ORG_B);
      const unshared = await fleetService.unshareFleetWith(ORG_A, fleet.id, ORG_B);

      expect(unshared).not.toBeNull();
      expect(unshared?.sharedWithOrgs).not.toContain(ORG_B);

      // Cleanup
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should not allow non-owner to share fleet', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-unauthorized-share',
        name: 'Protected Fleet',
        members: [],
      });

      const result = await fleetService.shareFleetWith(ORG_B, fleet.id, ORG_C);

      expect(result).toBeNull();

      // Cleanup
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });

    it('should not include unshared fleets in shared fleet list', async () => {
      const sharedFleets = await fleetService.getSharedFleets(ORG_B);
      const hasOrgAFleet = sharedFleets.some(f => f.id === testFleetA.id);

      expect(hasOrgAFleet).toBe(false);
    });

    it('should support paginated shared fleet retrieval with limit/offset', async () => {
      const fleet = await fleetService.createFleet(ORG_A, {
        id: 'fleet-pagination-shared',
        name: 'Shared Fleet Pagination',
        members: [],
      });

      await fleetService.shareFleetWith(ORG_A, fleet.id, ORG_B);

      const fullPage = await fleetService.getSharedFleetsPaginated(ORG_B, {
        limit: 100,
        offset: 0,
      });

      expect(fullPage.data.some(f => f.id === fleet.id)).toBe(true);
      expect(fullPage.pagination.total).toBeGreaterThanOrEqual(fullPage.data.length);

      const limitedPage = await fleetService.getSharedFleetsPaginated(ORG_B, {
        limit: 1,
        offset: 0,
      });

      expect(limitedPage.data.length).toBeLessThanOrEqual(1);
      expect(limitedPage.pagination.limit).toBe(1);
      expect(limitedPage.pagination.offset).toBe(0);

      await fleetService.unshareFleetWith(ORG_A, fleet.id, ORG_B);
      await fleetService.deleteFleet(ORG_A, fleet.id);
    });
  });

  describe('Fleet Search', () => {
    it('should search fleets by name within organization', async () => {
      const results = await fleetService.searchFleetsByName(ORG_A, 'Alpha');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every(f => f.organizationId === ORG_A)).toBe(true);
      expect(results.some(f => f.name.includes('Alpha'))).toBe(true);
    });

    it('should not return other organization fleets in search', async () => {
      const results = await fleetService.searchFleetsByName(ORG_A, 'Bravo');

      const hasBravoFleet = results.some(f => f.id === testFleetB.id);
      expect(hasBravoFleet).toBe(false);
    });

    it('should handle case-insensitive search', async () => {
      const results = await fleetService.searchFleetsByName(ORG_A, 'alpha');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(f => f.name.toLowerCase().includes('alpha'))).toBe(true);
    });
  });

  describe('Fleet Statistics', () => {
    it('should return statistics for organization fleets', async () => {
      const stats = await fleetService.getFleetStatistics(ORG_A);

      expect(stats.totalFleets).toBeGreaterThanOrEqual(1);
      expect(stats.sharedFleets).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.fleetsWithMembers)).toBe(true);
    });

    it('should not include other organization fleets in statistics', async () => {
      const orgAStats = await fleetService.getFleetStatistics(ORG_A);
      const orgBStats = await fleetService.getFleetStatistics(ORG_B);

      expect(orgAStats.totalFleets).not.toBe(orgBStats.totalFleets);
    });
  });

  describe('Fleet Ownership', () => {
    it('should verify fleet ownership correctly', async () => {
      const isOwned = await fleetService.isFleetOwnedBy(ORG_A, testFleetA.id);
      expect(isOwned).toBe(true);
    });

    it('should return false for non-owned fleet', async () => {
      const isOwned = await fleetService.isFleetOwnedBy(ORG_B, testFleetA.id);
      expect(isOwned).toBe(false);
    });

    it('should return false for non-existent fleet', async () => {
      const isOwned = await fleetService.isFleetOwnedBy(ORG_A, 'non-existent-fleet');
      expect(isOwned).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty fleet list gracefully', async () => {
      const fleets = await fleetService.getAllFleets('empty-org');
      expect(Array.isArray(fleets)).toBe(true);
      expect(fleets.length).toBe(0);
    });

    it('should handle non-existent fleet ID', async () => {
      const fleet = await fleetService.getFleetById(ORG_A, 'non-existent');
      expect(fleet).toBeNull();
    });

    it('should handle empty search term', async () => {
      const results = await fleetService.searchFleetsByName(ORG_A, '');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle search with no results', async () => {
      const results = await fleetService.searchFleetsByName(ORG_A, 'ZZZNonExistent');
      expect(results.length).toBe(0);
    });
  });
});

