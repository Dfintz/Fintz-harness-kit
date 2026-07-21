import { 
    LogisticsRouteOptimizationService,
    LogisticsWaypoint,
    RouteOptimizationOptions
} from '../../services/trade/logistics/LogisticsRouteOptimizationService';

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

describe('LogisticsRouteOptimizationService', () => {
    let service: LogisticsRouteOptimizationService;
    const testOrgId = 'org-123';

    beforeEach(() => {
        service = new LogisticsRouteOptimizationService();
    });

    describe('optimizeRoute', () => {
        it('should optimize a route with multiple waypoints', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Test Route',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 100 }],
                        priority: 3,
                        estimatedTimeAtStop: 15
                    },
                    {
                        location: 'Area 18',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 50 }],
                        priority: 2,
                        estimatedTimeAtStop: 20
                    },
                    {
                        location: 'Lorville',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 50 }],
                        priority: 1,
                        estimatedTimeAtStop: 20
                    }
                ]
            };

            const result = await service.optimizeRoute(options);

            expect(result.id).toBeDefined();
            expect(result.name).toBe('Test Route');
            expect(result.waypoints.length).toBe(3);
            expect(result.totalDistance).toBeGreaterThan(0);
            expect(result.efficiency).toBeDefined();
            expect(result.efficiency.overallScore).toBeGreaterThanOrEqual(0);
            expect(result.efficiency.overallScore).toBeLessThanOrEqual(100);
        });

        it('should handle single waypoint route', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Single Stop',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Item', quantity: 10 }],
                        priority: 5,
                        estimatedTimeAtStop: 10
                    }
                ]
            };

            const result = await service.optimizeRoute(options);

            expect(result.waypoints.length).toBe(1);
            expect(result.totalDistance).toBe(0);
            expect(result.efficiency.overallScore).toBe(100);
        });

        it('should throw error for empty waypoints', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Empty Route',
                waypoints: []
            };

            await expect(service.optimizeRoute(options)).rejects.toThrow('At least one waypoint is required');
        });

        it('should optimize by priority when specified', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Priority Route',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Low Priority', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    },
                    {
                        location: 'Area 18',
                        type: 'delivery',
                        items: [{ name: 'High Priority', quantity: 10 }],
                        priority: 5,
                        estimatedTimeAtStop: 10
                    },
                    {
                        location: 'Lorville',
                        type: 'delivery',
                        items: [{ name: 'Medium Priority', quantity: 10 }],
                        priority: 3,
                        estimatedTimeAtStop: 10
                    }
                ],
                prioritizeBy: 'priority'
            };

            const result = await service.optimizeRoute(options);

            // First waypoint should be highest priority
            expect(result.waypoints[0].priority).toBe(5);
        });

        it('should add refuel stops when needed', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Long Route',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 100 }],
                        priority: 3,
                        estimatedTimeAtStop: 15
                    },
                    {
                        location: 'New Babbage',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 100 }],
                        priority: 3,
                        estimatedTimeAtStop: 15
                    }
                ],
                shipFuelCapacity: 10000, // Low fuel capacity to force refuel stop
                includeRefuelStops: true
            };

            const result = await service.optimizeRoute(options);

            // Should have at least one refuel stop added
            const refuelStops = result.waypoints.filter(w => w.type === 'refuel');
            expect(refuelStops.length).toBeGreaterThanOrEqual(1);
        });

        it('should limit stops when maxStopsPerRoute is set', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Limited Route',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    },
                    {
                        location: 'Area 18',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    },
                    {
                        location: 'Lorville',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    },
                    {
                        location: 'New Babbage',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    }
                ],
                maxStopsPerRoute: 2
            };

            const result = await service.optimizeRoute(options);

            expect(result.waypoints.length).toBe(2);
        });
    });

    describe('getRoute', () => {
        it('should return route by ID', async () => {
            const options: RouteOptimizationOptions = {
                organizationId: testOrgId,
                name: 'Get Test Route',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 10 }],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    }
                ]
            };

            const created = await service.optimizeRoute(options);
            const result = await service.getRoute(created.id);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Get Test Route');
        });

        it('should return null for non-existent route', async () => {
            const result = await service.getRoute('non-existent-id');
            expect(result).toBeNull();
        });
    });

    describe('getOrganizationRoutes', () => {
        beforeEach(async () => {
            await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Route 1',
                waypoints: [{
                    location: 'Port Olisar',
                    type: 'pickup',
                    items: [],
                    priority: 1,
                    estimatedTimeAtStop: 10
                }]
            });
            await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Route 2',
                waypoints: [{
                    location: 'Area 18',
                    type: 'delivery',
                    items: [],
                    priority: 1,
                    estimatedTimeAtStop: 10
                }]
            });
            await service.optimizeRoute({
                organizationId: 'other-org',
                name: 'Other Route',
                waypoints: [{
                    location: 'Lorville',
                    type: 'pickup',
                    items: [],
                    priority: 1,
                    estimatedTimeAtStop: 10
                }]
            });
        });

        it('should return all routes for organization', async () => {
            const result = await service.getOrganizationRoutes(testOrgId);
            expect(result.length).toBe(2);
        });

        it('should not return routes from other organizations', async () => {
            const result = await service.getOrganizationRoutes(testOrgId);
            const otherOrgRoutes = result.filter(r => r.organizationId === 'other-org');
            expect(otherOrgRoutes.length).toBe(0);
        });
    });

    describe('deleteRoute', () => {
        it('should delete a route', async () => {
            const route = await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'To Delete',
                waypoints: [{
                    location: 'Port Olisar',
                    type: 'pickup',
                    items: [],
                    priority: 1,
                    estimatedTimeAtStop: 10
                }]
            });

            const deleted = await service.deleteRoute(route.id);
            expect(deleted).toBe(true);

            const found = await service.getRoute(route.id);
            expect(found).toBeNull();
        });

        it('should return false for non-existent route', async () => {
            const result = await service.deleteRoute('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('analyzeSupplyChain', () => {
        it('should return analysis with no routes', async () => {
            const analysis = await service.analyzeSupplyChain('empty-org');

            expect(analysis.totalRoutes).toBe(0);
            expect(analysis.averageEfficiency).toBe(0);
            expect(analysis.recommendations.length).toBeGreaterThan(0);
        });

        it('should return analysis with routes', async () => {
            await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Analysis Route 1',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 50 }],
                        priority: 3,
                        estimatedTimeAtStop: 15
                    },
                    {
                        location: 'Area 18',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 50 }],
                        priority: 3,
                        estimatedTimeAtStop: 15
                    }
                ]
            });

            await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Analysis Route 2',
                waypoints: [
                    {
                        location: 'Lorville',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 100 }],
                        priority: 2,
                        estimatedTimeAtStop: 20
                    },
                    {
                        location: 'New Babbage',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 100 }],
                        priority: 2,
                        estimatedTimeAtStop: 20
                    }
                ]
            });

            const analysis = await service.analyzeSupplyChain(testOrgId);

            expect(analysis.totalRoutes).toBe(2);
            expect(analysis.averageEfficiency).toBeGreaterThan(0);
            expect(analysis.bottlenecks).toBeDefined();
            expect(analysis.recommendations).toBeDefined();
        });
    });

    describe('route efficiency calculations', () => {
        it('should calculate efficiency scores', async () => {
            const result = await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Efficiency Test',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [{ name: 'Cargo', quantity: 100, weight: 10 }],
                        priority: 3,
                        estimatedTimeAtStop: 20
                    },
                    {
                        location: 'Area 18',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 50, weight: 5 }],
                        priority: 2,
                        estimatedTimeAtStop: 15
                    },
                    {
                        location: 'Lorville',
                        type: 'delivery',
                        items: [{ name: 'Cargo', quantity: 50, weight: 5 }],
                        priority: 2,
                        estimatedTimeAtStop: 15
                    }
                ]
            });

            expect(result.efficiency.distanceOptimization).toBeDefined();
            expect(result.efficiency.fuelEfficiency).toBeGreaterThanOrEqual(0);
            expect(result.efficiency.fuelEfficiency).toBeLessThanOrEqual(100);
            expect(result.efficiency.timeEfficiency).toBeGreaterThanOrEqual(0);
            expect(result.efficiency.timeEfficiency).toBeLessThanOrEqual(100);
            expect(result.efficiency.overallScore).toBeGreaterThanOrEqual(0);
            expect(result.efficiency.overallScore).toBeLessThanOrEqual(100);
        });

        it('should calculate total cargo weight', async () => {
            const result = await service.optimizeRoute({
                organizationId: testOrgId,
                name: 'Weight Test',
                waypoints: [
                    {
                        location: 'Port Olisar',
                        type: 'pickup',
                        items: [
                            { name: 'Cargo A', quantity: 10, weight: 5 },
                            { name: 'Cargo B', quantity: 20, weight: 2 }
                        ],
                        priority: 1,
                        estimatedTimeAtStop: 10
                    }
                ]
            });

            // 10 * 5 + 20 * 2 = 50 + 40 = 90
            expect(result.totalCargoWeight).toBe(90);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
