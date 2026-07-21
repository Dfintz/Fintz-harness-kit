import { FleetViewService } from '../../services/fleet/FleetViewService';
import { Ship, ShipStatus } from '../../models/Ship';
import { FleetViewSchema, FleetViewShip } from '../../types/fleetview';
import { AppDataSource } from '../../config/database';

// Mock dependencies
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    },
logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('FleetViewService', () => {
    let fleetViewService: FleetViewService;
    let mockRepository: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            }))
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        fleetViewService = new FleetViewService();
    });

    describe('exportToFleetView', () => {
        it('should export ships to FleetView format', async () => {
            const mockShips: Partial<Ship>[] = [
                {
                    id: 'ship-1',
                    name: 'Carrack',
                    manufacturer: 'Anvil Aerospace',
                    role: 'Exploration',
                    description: 'Multi-crew explorer',
                    pledgePrice: 600,
                    price: 600,
                    isActive: true,
                    metadata: { lti: true, warbond: false, tags: ['exploration'] }
                },
                {
                    id: 'ship-2',
                    name: 'Gladius',
                    manufacturer: 'Aegis Dynamics',
                    role: 'Fighter',
                    pledgePrice: 90,
                    price: 90,
                    isActive: true
                }
            ];

            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockShips)
            };
            mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

            const result = await fleetViewService.exportToFleetView({
                organizationId: 'org-123',
                includeStatistics: true,
                includeInactive: false
            });

            expect(result.version).toBe('1.0');
            expect(result.ships).toHaveLength(2);
            expect(result.ships[0].name).toBe('Carrack');
            expect(result.ships[0].manufacturer).toBe('Anvil Aerospace');
            expect(result.ships[0].lti).toBe(true);
            expect(result.statistics?.totalShips).toBe(2);
        });

        it('should export with user filter', async () => {
            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };
            mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

            await fleetViewService.exportToFleetView({
                userId: 'user-123'
            });

            expect(queryBuilder.where).toHaveBeenCalledWith(
                'ship.organizationId = :organizationId',
                { organizationId: 'user-user-123' }
            );
        });

        it('should include inactive ships when requested', async () => {
            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };
            mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

            await fleetViewService.exportToFleetView({
                organizationId: 'org-123',
                includeInactive: true
            });

            // Should not call andWhere for isActive filter
            expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
                'ship.isActive = :isActive',
                expect.anything()
            );
        });
    });

    describe('importFromFleetView', () => {
        it('should import ships from FleetView format', async () => {
            const schema: FleetViewSchema = {
                version: '1.0',
                updated: new Date().toISOString(),
                ships: [
                    {
                        name: 'Carrack',
                        manufacturer: 'Anvil Aerospace',
                        kind: 'Exploration',
                        owned: 1,
                        lti: true,
                        cost: 600
                    },
                    {
                        name: 'Gladius',
                        manufacturer: 'Aegis Dynamics',
                        kind: 'Fighter',
                        owned: 1
                    }
                ]
            };

            mockRepository.findOne.mockResolvedValue(null); // No duplicates
            mockRepository.save.mockImplementation((ship: Ship) => Promise.resolve(ship));

            const result = await fleetViewService.importFromFleetView(schema, {
                organizationId: 'org-123',
                userId: 'user-123',
                skipDuplicates: true
            });

            expect(result.success).toBe(true);
            expect(result.imported).toBe(2);
            expect(result.skipped).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should skip duplicate ships', async () => {
            const schema: FleetViewSchema = {
                version: '1.0',
                updated: new Date().toISOString(),
                ships: [
                    { name: 'Carrack', manufacturer: 'Anvil Aerospace', owned: 1 }
                ]
            };

            mockRepository.findOne.mockResolvedValue({ id: 'existing-ship' }); // Duplicate exists

            const result = await fleetViewService.importFromFleetView(schema, {
                organizationId: 'org-123',
                userId: 'user-123',
                skipDuplicates: true
            });

            expect(result.imported).toBe(0);
            expect(result.skipped).toBe(1);
            expect(result.ships[0].status).toBe('skipped');
        });

        it('should handle import errors gracefully', async () => {
            const schema: FleetViewSchema = {
                version: '1.0',
                updated: new Date().toISOString(),
                ships: [
                    { name: 'Carrack', manufacturer: 'Anvil Aerospace', owned: 1 }
                ]
            };

            mockRepository.findOne.mockResolvedValue(null);
            mockRepository.save.mockRejectedValue(new Error('Database error'));

            const result = await fleetViewService.importFromFleetView(schema, {
                organizationId: 'org-123',
                userId: 'user-123'
            });

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.ships[0].status).toBe('error');
        });
    });

    describe('validateSchema', () => {
        it('should validate valid schema', () => {
            const validSchema = {
                version: '1.0',
                ships: [
                    { name: 'Carrack', manufacturer: 'Anvil' }
                ]
            };

            const result = fleetViewService.validateSchema(validSchema);
            expect(result).toBe(true);
        });

        it('should reject null schema', () => {
            const result = fleetViewService.validateSchema(null);
            expect(result).toBe(false);
        });

        it('should reject schema without ships array', () => {
            const invalidSchema = { version: '1.0' };
            const result = fleetViewService.validateSchema(invalidSchema);
            expect(result).toBe(false);
        });

        it('should reject schema with ships missing name', () => {
            const invalidSchema = {
                version: '1.0',
                ships: [{ manufacturer: 'Anvil' }]
            };
            const result = fleetViewService.validateSchema(invalidSchema);
            expect(result).toBe(false);
        });

        it('should reject non-object schema', () => {
            const result = fleetViewService.validateSchema('not an object');
            expect(result).toBe(false);
        });
    });

    describe('round-trip import/export', () => {
        it('should preserve data through import then export', async () => {
            const originalShips: FleetViewShip[] = [
                {
                    name: 'Carrack',
                    manufacturer: 'Anvil Aerospace',
                    kind: 'Exploration',
                    owned: 1,
                    lti: true,
                    warbond: false,
                    cost: 600,
                    notes: 'My favorite ship',
                    tags: ['exploration', 'multicrew']
                }
            ];

            const importSchema: FleetViewSchema = {
                version: '1.0',
                updated: new Date().toISOString(),
                ships: originalShips
            };

            // Mock import
            let savedShip: Ship | null = null;
            mockRepository.findOne.mockResolvedValue(null);
            mockRepository.save.mockImplementation((ship: Ship) => {
                savedShip = ship;
                return Promise.resolve(ship);
            });

            await fleetViewService.importFromFleetView(importSchema, {
                organizationId: 'org-123',
                userId: 'user-123'
            });

            // Mock export with the saved ship
            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(savedShip ? [savedShip] : [])
            };
            mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

            const exportResult = await fleetViewService.exportToFleetView({
                organizationId: 'org-123'
            });

            expect(exportResult.ships[0].name).toBe('Carrack');
            expect(exportResult.ships[0].manufacturer).toBe('Anvil Aerospace');
            expect(exportResult.ships[0].lti).toBe(true);
            expect(exportResult.ships[0].cost).toBe(600);
        });
    });

    describe('statistics calculation', () => {
        it('should calculate correct statistics', async () => {
            const mockShips: Partial<Ship>[] = [
                { manufacturer: 'Anvil Aerospace', role: 'Exploration', pledgePrice: 600 },
                { manufacturer: 'Anvil Aerospace', role: 'Fighter', pledgePrice: 200 },
                { manufacturer: 'Aegis Dynamics', role: 'Fighter', price: 90 },
                { manufacturer: 'Origin', role: 'Touring' } // No price
            ];

            const queryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockShips)
            };
            mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

            const result = await fleetViewService.exportToFleetView({
                organizationId: 'org-123',
                includeStatistics: true
            });

            expect(result.statistics?.totalShips).toBe(4);
            expect(result.statistics?.totalValue).toBe(890); // 600 + 200 + 90
            expect(result.statistics?.manufacturers['Anvil Aerospace']).toBe(2);
            expect(result.statistics?.manufacturers['Aegis Dynamics']).toBe(1);
            expect(result.statistics?.roles['Fighter']).toBe(2);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
