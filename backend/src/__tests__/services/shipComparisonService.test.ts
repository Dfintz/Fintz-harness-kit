import { Ship, ShipSize, ShipStatus } from '../../models/Ship';

// Mock ships for testing
const mockShips: Partial<Ship>[] = [
    {
        id: 'ship-1',
        name: 'Aurora MR',
        manufacturer: 'RSI',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
        speed: 1200,
        afterburnerSpeed: 1280,
        quantumSpeed: 150000,
        cargo: 6,
        minCrew: 1,
        maxCrew: 1,
        shields: 300,
        armor: 100,
        price: 25000,
        pledgePrice: 25,
        weapons: [{ type: 'laser', size: 1, count: 2 }],
        role: 'Starter',
        isActive: true
    },
    {
        id: 'ship-2',
        name: 'Constellation Andromeda',
        manufacturer: 'RSI',
        size: ShipSize.LARGE,
        status: ShipStatus.FLIGHT_READY,
        speed: 950,
        afterburnerSpeed: 1080,
        quantumSpeed: 130000,
        cargo: 96,
        minCrew: 2,
        maxCrew: 5,
        shields: 1200,
        armor: 400,
        price: 3200000,
        pledgePrice: 225,
        weapons: [
            { type: 'gimbal', size: 4, count: 4 },
            { type: 'missile', size: 2, count: 28 }
        ],
        role: 'Multi-Role',
        roles: ['Combat', 'Exploration', 'Freight'],
        isActive: true
    },
    {
        id: 'ship-3',
        name: 'Prospector',
        manufacturer: 'MISC',
        size: ShipSize.SMALL,
        status: ShipStatus.FLIGHT_READY,
        speed: 1050,
        afterburnerSpeed: 1150,
        quantumSpeed: 140000,
        cargo: 32,
        minCrew: 1,
        maxCrew: 1,
        shields: 400,
        armor: 150,
        price: 2200000,
        pledgePrice: 155,
        role: 'Mining',
        isActive: true
    }
];

// Track ship IDs that were queried
let queriedShipIds: string[] = [];

// Mock the database connection
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(() => ({
            findOne: jest.fn(({ where }) => {
                const found = mockShips.find(s => s.id === where.id);
                return Promise.resolve(found || null);
            }),
            createQueryBuilder: jest.fn(() => {
                return {
                    where: jest.fn(function(this: any, _query: string, params?: { ids?: string[] }) {
                        if (params?.ids) {
                            queriedShipIds = params.ids;
                        }
                        return this;
                    }),
                    andWhere: jest.fn().mockReturnThis(),
                    orWhere: jest.fn().mockReturnThis(),
                    addOrderBy: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    take: jest.fn().mockReturnThis(),
                    getMany: jest.fn(() => {
                        // Return only the ships that were queried
                        if (queriedShipIds.length > 0) {
                            return Promise.resolve(
                                mockShips.filter(s => queriedShipIds.includes(s.id!) && s.isActive)
                            );
                        }
                        // For getSimilarShips, return ships excluding the queried one
                        return Promise.resolve(mockShips.filter(s => s.isActive && s.id !== 'ship-1'));
                    })
                };
            })
        }))
    }
}));

import { ShipComparisonService } from '../../services/ship';

describe('ShipComparisonService', () => {
    let comparisonService: ShipComparisonService;

    beforeEach(() => {
        queriedShipIds = []; // Reset between tests
        comparisonService = new ShipComparisonService();
    });

    describe('compareShips', () => {
        it('should compare two ships successfully', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            expect(result).toBeDefined();
            expect(result.ships).toHaveLength(2);
            expect(result.categories).toBeDefined();
            expect(result.summary).toBeDefined();
        });

        it('should calculate scores for each ship', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            for (const shipData of result.ships) {
                expect(shipData.scores).toBeDefined();
                expect(shipData.scores.combat).toBeGreaterThanOrEqual(0);
                expect(shipData.scores.combat).toBeLessThanOrEqual(100);
                expect(shipData.scores.cargo).toBeGreaterThanOrEqual(0);
                expect(shipData.scores.speed).toBeGreaterThanOrEqual(0);
                expect(shipData.scores.overall).toBeGreaterThanOrEqual(0);
            }
        });

        it('should calculate rankings', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            for (const shipData of result.ships) {
                expect(shipData.rankings).toBeDefined();
                expect(shipData.rankings.combat).toBeGreaterThanOrEqual(1);
                expect(shipData.rankings.combat).toBeLessThanOrEqual(2);
            }
        });

        it('should throw error for less than 2 ships', async () => {
            await expect(comparisonService.compareShips(['ship-1']))
                .rejects.toThrow('At least 2 ships are required for comparison');
        });

        it('should build comparison categories', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            expect(result.categories).toBeDefined();
            expect(result.categories.length).toBeGreaterThan(0);

            const performanceCategory = result.categories.find(c => c.name === 'Performance');
            expect(performanceCategory).toBeDefined();
            expect(performanceCategory?.metrics).toBeDefined();
        });

        it('should provide recommendations in summary', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            expect(result.summary).toBeDefined();
            expect(result.summary.recommendations).toBeDefined();
            expect(result.summary.totalShips).toBe(2);
        });

        it('should identify winners in metrics', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            const performanceCategory = result.categories.find(c => c.name === 'Performance');
            const speedMetric = performanceCategory?.metrics.find(m => m.name === 'Speed');

            expect(speedMetric).toBeDefined();
            expect(speedMetric?.values.some(v => v.isWinner)).toBe(true);
        });
    });

    describe('quickCompare', () => {
        it('should provide quick comparison between two ships', async () => {
            const result = await comparisonService.quickCompare('ship-1', 'ship-2');

            expect(result).toBeDefined();
            expect(result.ship1).toBeDefined();
            expect(result.ship2).toBeDefined();
            expect(result.winner).toBeDefined();
            expect(result.breakdown).toBeDefined();
            expect(result.breakdown.length).toBe(5); // combat, cargo, speed, crew, value
        });

        it('should identify category winners in breakdown', async () => {
            const result = await comparisonService.quickCompare('ship-1', 'ship-2');

            for (const category of result.breakdown) {
                expect(category.category).toBeDefined();
                expect(typeof category.ship1Score).toBe('number');
                expect(typeof category.ship2Score).toBe('number');
                expect(category.winner).toBeDefined();
            }
        });
    });

    describe('analyzeShipRoles', () => {
        it('should analyze ship roles and capabilities', async () => {
            const result = await comparisonService.analyzeShipRoles('ship-2');

            expect(result).toBeDefined();
            expect(result.shipId).toBe('ship-2');
            expect(result.shipName).toBe('Constellation Andromeda');
            expect(result.primaryRoles).toBeDefined();
            expect(result.capabilities).toBeDefined();
            expect(result.bestFor).toBeDefined();
            expect(result.limitations).toBeDefined();
        });

        it('should return capabilities with scores', async () => {
            const result = await comparisonService.analyzeShipRoles('ship-2');

            for (const capability of result.capabilities) {
                expect(capability.role).toBeDefined();
                expect(capability.score).toBeGreaterThanOrEqual(0);
                expect(capability.score).toBeLessThanOrEqual(100);
                expect(capability.description).toBeDefined();
            }
        });

        it('should throw error for non-existent ship', async () => {
            await expect(comparisonService.analyzeShipRoles('non-existent'))
                .rejects.toThrow('Ship not found');
        });
    });

    describe('analyzeFleetComposition', () => {
        it('should analyze fleet composition', async () => {
            const result = await comparisonService.analyzeFleetComposition(['ship-1', 'ship-2', 'ship-3']);

            expect(result).toBeDefined();
            expect(result.ships).toBeDefined();
            expect(result.roleDistribution).toBeDefined();
            expect(result.sizeDistribution).toBeDefined();
            expect(result.capabilities).toBeDefined();
            expect(result.gaps).toBeDefined();
            expect(result.recommendations).toBeDefined();
            expect(result.overallScore).toBeGreaterThanOrEqual(0);
        });

        it('should identify fleet capabilities', async () => {
            const result = await comparisonService.analyzeFleetComposition(['ship-1', 'ship-2', 'ship-3']);

            expect(result.capabilities).toBeDefined();
            expect(typeof result.capabilities.hasCombat).toBe('boolean');
            expect(typeof result.capabilities.hasCargo).toBe('boolean');
            expect(typeof result.capabilities.hasExploration).toBe('boolean');
            expect(typeof result.capabilities.hasMining).toBe('boolean');
        });

        it('should identify gaps in fleet', async () => {
            const result = await comparisonService.analyzeFleetComposition(['ship-1']);

            expect(result.gaps).toBeDefined();
            expect(Array.isArray(result.gaps)).toBe(true);
        });

        it('should provide recommendations', async () => {
            const result = await comparisonService.analyzeFleetComposition(['ship-1']);

            expect(result.recommendations).toBeDefined();
            expect(Array.isArray(result.recommendations)).toBe(true);
        });
    });

    describe('getSimilarShips', () => {
        it('should return similar ships', async () => {
            const result = await comparisonService.getSimilarShips('ship-1', 3);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            // Should not include the original ship
            expect(result.find(s => s.id === 'ship-1')).toBeUndefined();
        });

        it('should throw error for non-existent ship', async () => {
            await expect(comparisonService.getSimilarShips('non-existent'))
                .rejects.toThrow('Ship not found');
        });
    });

    describe('score calculations', () => {
        it('should calculate higher combat score for combat ships', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            const aurora = result.ships.find(s => s.ship.id === 'ship-1');
            const andromeda = result.ships.find(s => s.ship.id === 'ship-2');

            // Andromeda should have higher combat score due to more weapons
            expect(andromeda?.scores.combat).toBeGreaterThan(aurora?.scores.combat || 0);
        });

        it('should calculate higher cargo score for cargo ships', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            const aurora = result.ships.find(s => s.ship.id === 'ship-1');
            const andromeda = result.ships.find(s => s.ship.id === 'ship-2');

            // Andromeda should have higher cargo score (96 vs 6 SCU)
            expect(andromeda?.scores.cargo).toBeGreaterThan(aurora?.scores.cargo || 0);
        });

        it('should calculate higher speed score for faster ships', async () => {
            const result = await comparisonService.compareShips(['ship-1', 'ship-2']);

            const aurora = result.ships.find(s => s.ship.id === 'ship-1');
            const andromeda = result.ships.find(s => s.ship.id === 'ship-2');

            // Aurora should have higher speed score (1200 vs 950 m/s)
            expect(aurora?.scores.speed).toBeGreaterThan(andromeda?.scores.speed || 0);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
