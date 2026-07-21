// Mock database for unit testing
import { mockAppDataSource } from '../../__tests__/helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

import { Ship, ShipSize, ShipStatus } from '../../models/Ship';
import { ShipService } from '../ship';

const AppDataSource = mockAppDataSource;

// Integration test that requires real database - skip in CI
const describeIfDatabase =
  process.env.DATABASE_URL || process.env.DB_HOST ? describe : describe.skip;

describeIfDatabase('ShipService - Multi-Tenancy Tests', () => {
  let shipService: ShipService;
  const ORG_A = 'org-a-uuid';
  const ORG_B = 'org-b-uuid';

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    shipService = new ShipService();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up ships before each test
    const shipRepository = AppDataSource.getRepository(Ship);
    await shipRepository.delete({});
  });

  describe('Tenant Isolation', () => {
    it('should create ships scoped to organization', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      expect(ship).toBeDefined();
      expect(ship.organizationId).toBe(ORG_A);
      expect(ship.name).toBe('Aurora MR');
    });

    it('should not retrieve ships from other organizations', async () => {
      // Create ship for Org A
      await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Try to retrieve with Org B context
      const ships = await shipService.findAll(ORG_B);

      expect(ships).toHaveLength(0);
    });

    it('should only retrieve ships for the requesting organization', async () => {
      // Create ships for both orgs
      await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      await shipService.create(ORG_B, {
        name: 'Mustang Alpha',
        manufacturer: 'Consolidated Outland',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Org A should only see their ship
      const orgAShips = await shipService.findAll(ORG_A);
      expect(orgAShips).toHaveLength(1);
      expect(orgAShips[0].name).toBe('Aurora MR');

      // Org B should only see their ship
      const orgBShips = await shipService.findAll(ORG_B);
      expect(orgBShips).toHaveLength(1);
      expect(orgBShips[0].name).toBe('Mustang Alpha');
    });

    it("should not allow retrieving another organization's ship by ID", async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Try to retrieve with Org B context
      const retrieved = await shipService.findById(ORG_B, ship.id);

      expect(retrieved).toBeNull();
    });

    it("should not allow updating another organization's ship", async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Try to update with Org B context
      const updated = await shipService.update(ORG_B, ship.id, {
        name: 'Hacked Ship',
      });

      expect(updated).toBeNull();

      // Verify original ship unchanged
      const original = await shipService.findById(ORG_A, ship.id);
      expect(original?.name).toBe('Aurora MR');
    });

    it("should not allow deleting another organization's ship", async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Try to delete with Org B context
      await expect(shipService.delete(ORG_B, ship.id)).rejects.toThrow();

      // Verify ship still exists for Org A
      const exists = await shipService.findById(ORG_A, ship.id);
      expect(exists).toBeDefined();
    });
  });

  describe('Cross-Tenant Sharing', () => {
    it('should share ship with another organization', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Share with Org B
      await shipService.shareWith(ORG_A, ship.id, [ORG_B]);

      // Verify shared
      const sharedShip = await shipService.findById(ORG_A, ship.id);
      expect(sharedShip?.sharedWithOrgs).toContain(ORG_B);
    });

    it('should retrieve shared ships from other organizations', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Share with Org B
      await shipService.shareWith(ORG_A, ship.id, [ORG_B]);

      // Org B should see it in shared list
      const sharedShips = await shipService.findAllIncludingShared(ORG_B);
      expect(sharedShips).toHaveLength(1);
      expect(sharedShips[0].id).toBe(ship.id);
      expect(sharedShips[0].organizationId).toBe(ORG_A);
    });

    it('should unshare ship from organization', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Share then unshare
      await shipService.shareWith(ORG_A, ship.id, [ORG_B]);
      await shipService.unshareWith(ORG_A, ship.id, [ORG_B]);

      // Verify not shared
      const unsharedShip = await shipService.findById(ORG_A, ship.id);
      expect(unsharedShip?.sharedWithOrgs).not.toContain(ORG_B);

      // Org B should not see it anymore
      const sharedShips = await shipService.findAllIncludingShared(ORG_B);
      expect(sharedShips).toHaveLength(0);
    });

    it('should not allow updating shared ships from receiving org', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      // Share with Org B
      await shipService.shareWith(ORG_A, ship.id, [ORG_B]);

      // Org B tries to update
      const updated = await shipService.update(ORG_B, ship.id, {
        name: 'Hacked Ship',
      });

      expect(updated).toBeNull();
    });
  });

  describe('Filtering and Search', () => {
    beforeEach(async () => {
      // Create test ships
      await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        role: 'Starter',
        status: ShipStatus.FLIGHT_READY,
      });

      await shipService.create(ORG_A, {
        name: 'Cutlass Black',
        manufacturer: 'Drake Interplanetary',
        size: ShipSize.MEDIUM,
        role: 'Combat',
        status: ShipStatus.FLIGHT_READY,
      });

      await shipService.create(ORG_A, {
        name: 'Carrack',
        manufacturer: 'Anvil Aerospace',
        size: ShipSize.LARGE,
        role: 'Exploration',
        status: ShipStatus.IN_PRODUCTION,
      });
    });

    it('should filter ships by manufacturer', async () => {
      const ships = await shipService.findByManufacturer(ORG_A, 'Drake Interplanetary');

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Cutlass Black');
    });

    it('should filter ships by size', async () => {
      const ships = await shipService.findBySize(ORG_A, ShipSize.SMALL);

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Aurora MR');
    });

    it('should filter ships by role', async () => {
      const ships = await shipService.findByRole(ORG_A, 'Combat');

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Cutlass Black');
    });

    it('should search ships by name', async () => {
      const ships = await shipService.search(ORG_A, 'cutlass');

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Cutlass Black');
    });

    it('should search ships by manufacturer', async () => {
      const ships = await shipService.search(ORG_A, 'roberts');

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Aurora MR');
    });

    it('should apply multiple filters', async () => {
      const ships = await shipService.findWithFilters(ORG_A, {
        size: ShipSize.MEDIUM,
        manufacturer: 'Drake Interplanetary',
      });

      expect(ships).toHaveLength(1);
      expect(ships[0].name).toBe('Cutlass Black');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
        price: 30,
      });

      await shipService.create(ORG_A, {
        name: 'Cutlass Black',
        manufacturer: 'Drake Interplanetary',
        size: ShipSize.MEDIUM,
        status: ShipStatus.FLIGHT_READY,
        price: 100,
      });

      await shipService.create(ORG_A, {
        name: 'Aurora ES',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.IN_PRODUCTION,
        price: 20,
      });
    });

    it('should calculate ship statistics', async () => {
      const stats = await shipService.getStatistics(ORG_A);

      expect(stats.total).toBe(3);
      expect(stats.byManufacturer['Roberts Space Industries']).toBe(2);
      expect(stats.byManufacturer['Drake Interplanetary']).toBe(1);
      expect(stats.bySize[ShipSize.SMALL]).toBe(2);
      expect(stats.bySize[ShipSize.MEDIUM]).toBe(1);
      expect(stats.byStatus[ShipStatus.FLIGHT_READY]).toBe(2);
      expect(stats.byStatus[ShipStatus.IN_PRODUCTION]).toBe(1);
      expect(stats.totalValue).toBe(150);
    });

    it('should only calculate statistics for organization', async () => {
      // Create ship for Org B
      await shipService.create(ORG_B, {
        name: 'Mustang Alpha',
        manufacturer: 'Consolidated Outland',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
        price: 30,
      });

      const stats = await shipService.getStatistics(ORG_A);

      expect(stats.total).toBe(3);
      expect(stats.totalValue).toBe(150);
    });
  });

  describe('Soft Delete', () => {
    it('should deactivate ship', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      await shipService.deactivate(ORG_A, ship.id);

      // Should not appear in filtered queries (active ships only)
      const ships = await shipService.findWithFilters(ORG_A, {});
      expect(ships).toHaveLength(0);
    });

    it('should reactivate ship', async () => {
      const ship = await shipService.create(ORG_A, {
        name: 'Aurora MR',
        manufacturer: 'Roberts Space Industries',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
      });

      await shipService.deactivate(ORG_A, ship.id);
      await shipService.reactivate(ORG_A, ship.id);

      // Should appear in queries again
      const ships = await shipService.findAll(ORG_A);
      expect(ships).toHaveLength(1);
    });
  });
});

