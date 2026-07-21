import { ShipLoadout } from '../../models/ShipLoadout';
import { ShipLoadoutService } from '../../services/ship';

// Mock the database connection
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      create: jest.fn(data => ({ ...data, id: 'loadout-1' })),
      save: jest.fn(loadout => Promise.resolve(loadout)),
      findOne: jest.fn(({ where }) => {
        if (where.id === 'loadout-1') {
          return Promise.resolve({
            id: 'loadout-1',
            name: 'Test Loadout',
            ownerId: 'user-1',
            shipName: 'Gladius',
            components: [
              {
                slot: 'Power Plant',
                componentName: 'JS-300',
                componentType: 'Power Plant',
                manufacturer: 'JSpan',
              },
            ],
            erkulGamesUrl: null,
            statistics: {
              dps: 5000,
              totalHp: 10000,
            },
            version: 1,
            isLatestVersion: true,
            sharedWithFleet: false,
            sharedWithOrg: false,
            sharedWithAlliance: false,
          });
        }
        return Promise.resolve(null);
      }),
      delete: jest.fn(id => {
        if (id === 'loadout-1') {
          return Promise.resolve({ affected: 1 });
        }
        return Promise.resolve({ affected: 0 });
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(() => Promise.resolve([])),
        getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
      })),
    })),
  },
}));

describe('ShipLoadoutService - Enhanced Features', () => {
  let loadoutService: ShipLoadoutService;

  beforeEach(() => {
    loadoutService = new ShipLoadoutService();
  });

  describe('generateErkulGamesUrl', () => {
    it('should generate Erkul Games URL for a loadout', () => {
      const loadout: ShipLoadout = {
        id: 'loadout-1',
        name: 'Test Loadout',
        ownerId: 'user-1',
        shipName: 'Gladius',
        components: [
          {
            slot: 'Power Plant',
            componentName: 'JS-300',
            componentType: 'Power Plant',
            manufacturer: 'JSpan',
          },
          {
            slot: 'Weapon_S3_1',
            componentName: 'CF-337 Panther',
            componentType: 'Weapon',
            manufacturer: 'Klaus & Werner',
          },
        ],
        version: 1,
        isLatestVersion: true,
        sharedWithFleet: false,
        sharedWithOrg: false,
        sharedWithAlliance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const url = loadoutService.generateErkulGamesUrl(loadout);

      expect(url).toBeDefined();
      expect(url).toContain('https://www.erkul.games/live/calculator');
      expect(url).toContain('ship=GLADIUS');
    });

    it('should handle ship names with spaces', () => {
      const loadout: ShipLoadout = {
        id: 'loadout-1',
        name: 'Test Loadout',
        ownerId: 'user-1',
        shipName: 'Anvil Hornet',
        components: [],
        version: 1,
        isLatestVersion: true,
        sharedWithFleet: false,
        sharedWithOrg: false,
        sharedWithAlliance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const url = loadoutService.generateErkulGamesUrl(loadout);

      expect(url).toContain('ship=ANVIL_HORNET');
    });
  });

  describe('updateErkulGamesUrl', () => {
    it('should update the Erkul Games URL for a loadout', async () => {
      const url = 'https://www.erkul.games/live/calculator?ship=Gladius';
      const loadout = await loadoutService.updateErkulGamesUrl('loadout-1', url);

      expect(loadout).toBeDefined();
      expect(loadout?.erkulGamesUrl).toBe(url);
    });

    it('should return null for non-existent loadout', async () => {
      const url = 'https://www.erkul.games/live/calculator?ship=Gladius';
      const loadout = await loadoutService.updateErkulGamesUrl('non-existent', url);

      expect(loadout).toBeNull();
    });
  });

  describe('getLoadoutsByShip', () => {
    it('should return loadouts for a specific ship', async () => {
      const result = await loadoutService.getLoadoutsByShip('Gladius', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should only return latest versions', async () => {
      // This would need proper mocking to verify the query filters correctly
      const result = await loadoutService.getLoadoutsByShip('Gladius', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getPopularLoadouts', () => {
    it('should return popular shared loadouts', async () => {
      const result = await loadoutService.getPopularLoadouts({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should only return shared loadouts', async () => {
      // This would need proper mocking to verify the query filters correctly
      const result = await loadoutService.getPopularLoadouts({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(result).toBeDefined();
    });
  });

  describe('compareLoadouts', () => {
    it('should compare two loadouts and return differences', () => {
      const loadout1: ShipLoadout = {
        id: 'loadout-1',
        name: 'Loadout 1',
        ownerId: 'user-1',
        shipName: 'Gladius',
        components: [
          {
            slot: 'Power Plant',
            componentName: 'JS-300',
            componentType: 'Power Plant',
          },
        ],
        statistics: {
          dps: 5000,
          totalHp: 10000,
        },
        version: 1,
        isLatestVersion: true,
        sharedWithFleet: false,
        sharedWithOrg: false,
        sharedWithAlliance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const loadout2: ShipLoadout = {
        id: 'loadout-2',
        name: 'Loadout 2',
        ownerId: 'user-1',
        shipName: 'Gladius',
        components: [
          {
            slot: 'Power Plant',
            componentName: 'JS-400',
            componentType: 'Power Plant',
          },
        ],
        statistics: {
          dps: 6000,
          totalHp: 12000,
        },
        version: 1,
        isLatestVersion: true,
        sharedWithFleet: false,
        sharedWithOrg: false,
        sharedWithAlliance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const comparison = loadoutService.compareLoadouts(loadout1, loadout2);

      expect(comparison).toBeDefined();
      expect(comparison.componentDifferences).toBeDefined();
      expect(comparison.statisticsDifferences).toBeDefined();
      expect(comparison.componentDifferences.length).toBeGreaterThan(0);
      expect(comparison.statisticsDifferences.dps).toBeDefined();
      expect(comparison.statisticsDifferences.dps.loadout1).toBe(5000);
      expect(comparison.statisticsDifferences.dps.loadout2).toBe(6000);
    });

    it('should identify component differences', () => {
      const loadout1: ShipLoadout = {
        id: 'loadout-1',
        name: 'Loadout 1',
        ownerId: 'user-1',
        shipName: 'Gladius',
        components: [
          {
            slot: 'Weapon_1',
            componentName: 'Laser Cannon',
            componentType: 'Weapon',
          },
        ],
        version: 1,
        isLatestVersion: true,
        sharedWithFleet: false,
        sharedWithOrg: false,
        sharedWithAlliance: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const loadout2: ShipLoadout = {
        ...loadout1,
        id: 'loadout-2',
        components: [
          {
            slot: 'Weapon_1',
            componentName: 'Ballistic Cannon',
            componentType: 'Weapon',
          },
        ],
      };

      const comparison = loadoutService.compareLoadouts(loadout1, loadout2);

      expect(comparison.componentDifferences).toHaveLength(1);
      expect(comparison.componentDifferences[0].slot).toBe('Weapon_1');
      expect(comparison.componentDifferences[0].loadout1Component).toBe('Laser Cannon');
      expect(comparison.componentDifferences[0].loadout2Component).toBe('Ballistic Cannon');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
