import { ShipLoadout } from '../../models/ShipLoadout';
import { ShipLoadoutService } from '../../services/ship';

// Mock the database connection
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(() => ({
            create: jest.fn((data) => ({
                ...data,
                id: data.id || 'loadout-1',
                version: data.version || 1,
                isLatestVersion: data.isLatestVersion !== undefined ? data.isLatestVersion : true
            })),
            save: jest.fn((loadout) => Promise.resolve(loadout)),
            findOne: jest.fn(({ where }) => {
                if (where.id === 'loadout-1') {
                    return Promise.resolve({
                        id: 'loadout-1',
                        name: 'Test Loadout',
                        ownerId: 'user-1',
                        shipName: 'Carrack',
                        components: [
                            { slot: 'weapon1', componentName: 'M7A', componentType: 'weapon' }
                        ],
                        version: 1,
                        isLatestVersion: true
                    });
                }
                return Promise.resolve(null);
            }),
            delete: jest.fn((id) => {
                if (id === 'loadout-1') {
                    return Promise.resolve({ affected: 1 });
                }
                return Promise.resolve({ affected: 0 });
            }),
            find: jest.fn(() => Promise.resolve([])),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn(() => Promise.resolve([]))
            }))
        }))
    }
}));

describe('ShipLoadoutService', () => {
    let loadoutService: ShipLoadoutService;

    beforeEach(() => {
        loadoutService = new ShipLoadoutService();
    });

    describe('createLoadout', () => {
        it('should create a new loadout', async () => {
            const loadoutData = {
                name: 'Test Loadout',
                ownerId: 'user-1',
                shipName: 'Carrack',
                components: [
                    { slot: 'weapon1', componentName: 'M7A', componentType: 'weapon' }
                ]
            };

            const loadout = await loadoutService.createLoadout(loadoutData);

            expect(loadout).toBeDefined();
            expect(loadout.name).toBe('Test Loadout');
            expect(loadout.version).toBe(1);
            expect(loadout.isLatestVersion).toBe(true);
        });
    });

    describe('getLoadoutById', () => {
        it('should return a loadout by ID', async () => {
            const loadout = await loadoutService.getLoadoutById('loadout-1');

            expect(loadout).toBeDefined();
            expect(loadout?.id).toBe('loadout-1');
        });

        it('should return null for non-existent loadout', async () => {
            const loadout = await loadoutService.getLoadoutById('non-existent');

            expect(loadout).toBeNull();
        });
    });

    describe('updateLoadout', () => {
        it('should update a loadout', async () => {
            const updates = { name: 'Updated Loadout' };
            const loadout = await loadoutService.updateLoadout('loadout-1', updates);

            expect(loadout).toBeDefined();
            expect(loadout?.name).toBe('Updated Loadout');
        });
    });

    describe('deleteLoadout', () => {
        it('should delete a loadout', async () => {
            const success = await loadoutService.deleteLoadout('loadout-1');

            expect(success).toBe(true);
        });

        it('should return false for non-existent loadout', async () => {
            const success = await loadoutService.deleteLoadout('non-existent');

            expect(success).toBe(false);
        });
    });

    describe('compareLoadouts', () => {
        it('should compare two loadouts', () => {
            const loadout1: ShipLoadout = {
                id: '1',
                name: 'Loadout 1',
                ownerId: 'user-1',
                shipName: 'Carrack',
                components: [
                    { slot: 'weapon1', componentName: 'M7A', componentType: 'weapon' }
                ],
                statistics: { dps: 1000 },
                version: 1,
                isLatestVersion: true,
                sharedWithFleet: false,
                sharedWithOrg: false,
                sharedWithAlliance: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const loadout2: ShipLoadout = {
                id: '2',
                name: 'Loadout 2',
                ownerId: 'user-1',
                shipName: 'Carrack',
                components: [
                    { slot: 'weapon1', componentName: 'M8A', componentType: 'weapon' }
                ],
                statistics: { dps: 1200 },
                version: 1,
                isLatestVersion: true,
                sharedWithFleet: false,
                sharedWithOrg: false,
                sharedWithAlliance: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const comparison = loadoutService.compareLoadouts(loadout1, loadout2);

            expect(comparison.componentDifferences).toHaveLength(1);
            expect(comparison.componentDifferences[0].slot).toBe('weapon1');
            expect(comparison.statisticsDifferences.dps).toBeDefined();
        });
    });

    describe('shareWithUsers', () => {
        it('should share loadout with users', async () => {
            const loadout = await loadoutService.shareWithUsers('loadout-1', ['user-2', 'user-3']);

            expect(loadout).toBeDefined();
            expect(loadout?.sharedWithUsers).toContain('user-2');
            expect(loadout?.sharedWithUsers).toContain('user-3');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
