import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { TradingRoute, RouteStatus } from '../../../models/TradingRoute';
import { Fleet } from '../../../models/Fleet';
import { OrganizationTradingService } from '../OrganizationTradingService';

// Mock AppDataSource
jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
    __esModule: true,
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    },
logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('OrganizationTradingService', () => {
    let tradingService: OrganizationTradingService;
    let mockRouteRepository: jest.Mocked<Repository<TradingRoute>>;
    let mockFleetRepository: jest.Mocked<Repository<Fleet>>;

    beforeEach(() => {
        // Create mock repositories
        mockRouteRepository = {
            count: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn()
        } as any;

        mockFleetRepository = {
            find: jest.fn()
        } as any;

        // Setup AppDataSource mock
        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            if (entity === TradingRoute) {
                return mockRouteRepository;
            }
            if (entity === Fleet) {
                return mockFleetRepository;
            }
            return {} as any;
        });

        tradingService = new OrganizationTradingService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getActiveRouteCount', () => {
        it('should return count of active trading routes', async () => {
            const orgId = 'org-123';
            mockRouteRepository.count.mockResolvedValue(5);

            const count = await tradingService.getActiveRouteCount(orgId);

            expect(count).toBe(5);
            expect(mockRouteRepository.count).toHaveBeenCalledWith({
                where: {
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE
                }
            });
        });

        it('should return 0 when no active routes exist', async () => {
            const orgId = 'org-456';
            mockRouteRepository.count.mockResolvedValue(0);

            const count = await tradingService.getActiveRouteCount(orgId);

            expect(count).toBe(0);
        });

        it('should return 0 on error', async () => {
            const orgId = 'org-789';
            mockRouteRepository.count.mockRejectedValue(new Error('Database error'));

            const count = await tradingService.getActiveRouteCount(orgId);

            expect(count).toBe(0);
        });
    });

    describe('getRouteStats', () => {
        it('should return comprehensive route statistics', async () => {
            const orgId = 'org-123';
            const mockRoutes = [
                {
                    id: 'route-1',
                    name: 'Route 1',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 10000,
                    performance: { runCount: 5, avgProfit: 9500, avgDuration: 30 }
                },
                {
                    id: 'route-2',
                    name: 'Route 2',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 15000,
                    performance: { runCount: 3, avgProfit: 14500, avgDuration: 45 }
                },
                {
                    id: 'route-3',
                    name: 'Route 3',
                    organizationId: orgId,
                    status: RouteStatus.INACTIVE,
                    estimatedProfit: 5000,
                    performance: { runCount: 1, avgProfit: 4800, avgDuration: 20 }
                }
            ];

            mockRouteRepository.find.mockResolvedValue(mockRoutes as any);

            const stats = await tradingService.getRouteStats(orgId);

            expect(stats.activeRoutes).toBe(2);
            expect(stats.totalRoutes).toBe(3);
            expect(stats.totalProfit).toBe(30000);
            expect(stats.avgProfitPerRoute).toBe(10000);
            expect(stats.topRoutes).toHaveLength(3);
            expect(stats.topRoutes[0].name).toBe('Route 2');
            expect(stats.topRoutes[0].estimatedProfit).toBe(15000);
        });

        it('should handle empty routes list', async () => {
            const orgId = 'org-456';
            mockRouteRepository.find.mockResolvedValue([]);

            const stats = await tradingService.getRouteStats(orgId);

            expect(stats.activeRoutes).toBe(0);
            expect(stats.totalRoutes).toBe(0);
            expect(stats.totalProfit).toBe(0);
            expect(stats.avgProfitPerRoute).toBe(0);
            expect(stats.topRoutes).toHaveLength(0);
        });

        it('should return default stats on error', async () => {
            const orgId = 'org-789';
            mockRouteRepository.find.mockRejectedValue(new Error('Database error'));

            const stats = await tradingService.getRouteStats(orgId);

            expect(stats.activeRoutes).toBe(0);
            expect(stats.totalRoutes).toBe(0);
        });
    });

    describe('getRouteRecommendations', () => {
        it('should return route recommendations based on fleet capacity', async () => {
            const orgId = 'org-123';
            const mockFleets = [
                {
                    id: 'fleet-1',
                    organizationId: orgId,
                    composition: {
                        totalCargoCapacity: 100,
                        totalShips: 2,
                        shipsByRole: {},
                        totalCrewCapacity: 10,
                        estimatedValue: 1000000
                    }
                }
            ];

            const mockRoutes = [
                {
                    id: 'route-1',
                    name: 'Small Route',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 5000,
                    estimatedDuration: 20,
                    minCargoCapacity: 30
                },
                {
                    id: 'route-2',
                    name: 'Medium Route',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 15000,
                    estimatedDuration: 40,
                    minCargoCapacity: 75
                },
                {
                    id: 'route-3',
                    name: 'Large Route',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 25000,
                    estimatedDuration: 60,
                    minCargoCapacity: 150 // Too large for available ships
                }
            ];

            mockFleetRepository.find.mockResolvedValue(mockFleets as any);
            mockRouteRepository.find.mockResolvedValue(mockRoutes as any);

            const recommendations = await tradingService.getRouteRecommendations(orgId, 5);

            expect(recommendations).toHaveLength(2); // Should exclude route-3
            expect(recommendations[0].routeName).toBe('Medium Route');
            expect(recommendations[0].profitPerMinute).toBeGreaterThan(0);
            expect(recommendations[0].suitableShips).toBeGreaterThan(0);
        });

        it('should use default cargo capacity when no fleets available', async () => {
            const orgId = 'org-456';
            mockFleetRepository.find.mockResolvedValue([]);

            const mockRoutes = [
                {
                    id: 'route-1',
                    name: 'Route 1',
                    organizationId: orgId,
                    status: RouteStatus.ACTIVE,
                    estimatedProfit: 10000,
                    estimatedDuration: 30,
                    minCargoCapacity: 50
                }
            ];

            mockRouteRepository.find.mockResolvedValue(mockRoutes as any);

            const recommendations = await tradingService.getRouteRecommendations(orgId, 5);

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].routeName).toBe('Route 1');
        });

        it('should return empty array on error', async () => {
            const orgId = 'org-789';
            mockFleetRepository.find.mockRejectedValue(new Error('Database error'));

            const recommendations = await tradingService.getRouteRecommendations(orgId, 5);

            expect(recommendations).toHaveLength(0);
        });
    });

    describe('getProfitSummary', () => {
        it('should return profit summary for organization routes', async () => {
            const orgId = 'org-123';
            const mockRoutes = [
                {
                    id: 'route-1',
                    name: 'Route 1',
                    organizationId: orgId,
                    estimatedProfit: 10000,
                    performance: { runCount: 5, avgProfit: 9500, avgDuration: 30 }
                },
                {
                    id: 'route-2',
                    name: 'Route 2',
                    organizationId: orgId,
                    estimatedProfit: 15000,
                    performance: { runCount: 3, avgProfit: 14500, avgDuration: 45 }
                }
            ];

            mockRouteRepository.find.mockResolvedValue(mockRoutes as any);

            const summary = await tradingService.getProfitSummary(orgId);

            expect(summary.totalEstimatedProfit).toBe(25000);
            expect(summary.totalActualProfit).toBe(9500 * 5 + 14500 * 3); // 91000
            expect(summary.totalRuns).toBe(8);
            expect(summary.avgProfitPerRun).toBeGreaterThan(0);
            expect(summary.profitByRoute).toHaveLength(2);
            expect(summary.profitByRoute[0].efficiency).toBeGreaterThan(0);
        });

        it('should handle routes with no performance data', async () => {
            const orgId = 'org-456';
            const mockRoutes = [
                {
                    id: 'route-1',
                    name: 'New Route',
                    organizationId: orgId,
                    estimatedProfit: 10000,
                    performance: undefined
                }
            ];

            mockRouteRepository.find.mockResolvedValue(mockRoutes as any);

            const summary = await tradingService.getProfitSummary(orgId);

            expect(summary.totalEstimatedProfit).toBe(10000);
            expect(summary.totalActualProfit).toBe(0);
            expect(summary.totalRuns).toBe(0);
        });

        it('should return default summary on error', async () => {
            const orgId = 'org-789';
            mockRouteRepository.find.mockRejectedValue(new Error('Database error'));

            const summary = await tradingService.getProfitSummary(orgId);

            expect(summary.totalEstimatedProfit).toBe(0);
            expect(summary.totalActualProfit).toBe(0);
            expect(summary.totalRuns).toBe(0);
            expect(summary.avgProfitPerRun).toBe(0);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

