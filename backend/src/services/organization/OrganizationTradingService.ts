import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import { TradingRoute, RouteStatus } from '../../models/TradingRoute';
import { logger } from '../../utils/logger';

/**
 * Trading route statistics for an organization
 */
export interface TradingRouteStats {
    activeRoutes: number;
    totalRoutes: number;
    totalProfit: number;
    avgProfitPerRoute: number;
    topRoutes: Array<{
        id: string;
        name: string;
        estimatedProfit: number;
        status: RouteStatus;
        runCount: number;
        avgProfit: number;
    }>;
}

/**
 * Route recommendation based on fleet capacity
 */
export interface RouteRecommendation {
    routeId: string;
    routeName: string;
    estimatedProfit: number;
    estimatedDuration: number;
    minCargoCapacity: number;
    suitableShips: number;
    profitPerMinute: number;
    difficulty: string;
}

/**
 * Service for managing organization trading route statistics
 * Handles aggregation and analysis of trading routes for organizations
 * 
 * Multi-tenancy: All operations are scoped to organizationId
 */
export class OrganizationTradingService {
    private routeRepository: Repository<TradingRoute>;
    private fleetRepository: Repository<Fleet>;

    // Constants
    private static readonly DEFAULT_CARGO_CAPACITY = 100;
    private static readonly MAX_PROFIT_BY_ROUTE_RESULTS = 10;

    constructor() {
        this.routeRepository = AppDataSource.getRepository(TradingRoute);
        this.fleetRepository = AppDataSource.getRepository(Fleet);
    }

    /**
     * Get count of active trading routes for an organization
     * @param organizationId - Organization ID
     */
    async getActiveRouteCount(organizationId: string): Promise<number> {
        try {
            const count = await this.routeRepository.count({
                where: {
                    organizationId,
                    status: RouteStatus.ACTIVE
                }
            });

            logger.debug(`Active route count for organization ${organizationId}: ${count}`);
            return count;
        } catch (error: unknown) {
            logger.error(`Error getting active route count for organization ${organizationId}:`, error);
            return 0;
        }
    }

    /**
     * Get comprehensive trading route statistics for an organization
     * @param organizationId - Organization ID
     */
    async getRouteStats(organizationId: string): Promise<TradingRouteStats> {
        try {
            const routes = await this.routeRepository.find({
                where: { organizationId }
            });

            const activeRoutes = routes.filter(r => r.status === RouteStatus.ACTIVE);
            
            // Calculate total estimated profit
            const totalProfit = routes.reduce((sum, route) => sum + (route.estimatedProfit || 0), 0);

            // Calculate average profit per route
            const avgProfitPerRoute = routes.length > 0 ? totalProfit / routes.length : 0;

            // Get top 5 routes by profit
            const topRoutes = [...routes]
                .sort((a, b) => (b.estimatedProfit || 0) - (a.estimatedProfit || 0))
                .slice(0, 5)
                .map(route => ({
                    id: route.id,
                    name: route.name,
                    estimatedProfit: route.estimatedProfit || 0,
                    status: route.status,
                    runCount: route.performance?.runCount || 0,
                    avgProfit: route.performance?.avgProfit || 0
                }));

            const stats: TradingRouteStats = {
                activeRoutes: activeRoutes.length,
                totalRoutes: routes.length,
                totalProfit,
                avgProfitPerRoute: Math.round(avgProfitPerRoute),
                topRoutes
            };

            logger.info(`Generated trading route stats for organization ${organizationId}`, {
                activeRoutes: stats.activeRoutes,
                totalRoutes: stats.totalRoutes
            });

            return stats;
        } catch (error: unknown) {
            logger.error(`Error getting route stats for organization ${organizationId}:`, error);
            return {
                activeRoutes: 0,
                totalRoutes: 0,
                totalProfit: 0,
                avgProfitPerRoute: 0,
                topRoutes: []
            };
        }
    }

    /**
     * Get route recommendations based on fleet cargo capacity
     * @param organizationId - Organization ID
     * @param limit - Maximum number of recommendations (default: 5)
     */
    async getRouteRecommendations(organizationId: string, limit: number = 5): Promise<RouteRecommendation[]> {
        try {
            // Get organization's fleets to determine cargo capacity
            const fleets = await this.fleetRepository.find({
                where: { organizationId }
            });

            // Get max cargo capacity from fleet compositions
            let maxCargoCapacity = 0;
            const capacities = new Set<number>();

            for (const fleet of fleets) {
                if (fleet.composition?.totalCargoCapacity) {
                    const capacity = fleet.composition.totalCargoCapacity;
                    capacities.add(capacity);
                    if (capacity > maxCargoCapacity) {
                        maxCargoCapacity = capacity;
                    }
                }
            }

            // If no cargo capacity found, use a default value
            if (maxCargoCapacity === 0) {
                maxCargoCapacity = OrganizationTradingService.DEFAULT_CARGO_CAPACITY;
            }

            // Get active routes that match organization's capabilities
            const routes = await this.routeRepository.find({
                where: {
                    organizationId,
                    status: RouteStatus.ACTIVE
                }
            });

            // Filter and map routes to recommendations
            const recommendations = routes
                .filter(route => {
                    const requiredCapacity = route.minCargoCapacity || 0;
                    return requiredCapacity <= maxCargoCapacity;
                })
                .map(route => {
                    // Count how many fleets can handle this route
                    const suitableShips = Array.from(capacities).filter(
                        capacity => capacity >= (route.minCargoCapacity || 0)
                    ).length;

                    // Calculate profit per minute
                    const duration = route.estimatedDuration || 1;
                    const profit = route.estimatedProfit || 0;
                    const profitPerMinute = Math.round((profit / duration) * 100) / 100;

                    // Determine difficulty based on cargo requirement and duration
                    let difficulty = 'Easy';
                    const requiredCapacity = route.minCargoCapacity || 0;
                    if (requiredCapacity > 50 || duration > 45) {
                        difficulty = 'Hard';
                    } else if (requiredCapacity > 20 || duration > 25) {
                        difficulty = 'Medium';
                    }

                    return {
                        routeId: route.id,
                        routeName: route.name,
                        estimatedProfit: profit,
                        estimatedDuration: duration,
                        minCargoCapacity: requiredCapacity,
                        suitableShips,
                        profitPerMinute,
                        difficulty
                    };
                })
                .sort((a, b) => b.profitPerMinute - a.profitPerMinute)
                .slice(0, limit);

            logger.info(`Generated ${recommendations.length} route recommendations for organization ${organizationId}`, {
                maxCargoCapacity,
                totalRoutes: routes.length
            });

            return recommendations;
        } catch (error: unknown) {
            logger.error(`Error getting route recommendations for organization ${organizationId}:`, error);
            return [];
        }
    }

    /**
     * Get profit summary for organization's trading routes
     * @param organizationId - Organization ID
     */
    async getProfitSummary(organizationId: string): Promise<{
        totalEstimatedProfit: number;
        totalActualProfit: number;
        totalRuns: number;
        avgProfitPerRun: number;
        profitByRoute: Array<{
            routeId: string;
            routeName: string;
            estimatedProfit: number;
            actualProfit: number;
            runs: number;
            efficiency: number; // Actual vs Estimated percentage
        }>;
    }> {
        try {
            const routes = await this.routeRepository.find({
                where: { organizationId }
            });

            let totalEstimatedProfit = 0;
            let totalActualProfit = 0;
            let totalRuns = 0;

            const profitByRoute = routes.map(route => {
                const estimated = route.estimatedProfit || 0;
                const runs = route.performance?.runCount || 0;
                const avgProfit = route.performance?.avgProfit || 0;
                const actual = avgProfit * runs;

                totalEstimatedProfit += estimated;
                totalActualProfit += actual;
                totalRuns += runs;

                // Calculate efficiency (actual vs estimated)
                const efficiency = estimated > 0 ? Math.round((avgProfit / estimated) * 100) : 0;

                return {
                    routeId: route.id,
                    routeName: route.name,
                    estimatedProfit: estimated,
                    actualProfit: Math.round(actual),
                    runs,
                    efficiency
                };
            });

            const avgProfitPerRun = totalRuns > 0 ? Math.round(totalActualProfit / totalRuns) : 0;

            const summary = {
                totalEstimatedProfit: Math.round(totalEstimatedProfit),
                totalActualProfit: Math.round(totalActualProfit),
                totalRuns,
                avgProfitPerRun,
                profitByRoute: profitByRoute
                    .sort((a, b) => b.actualProfit - a.actualProfit)
                    .slice(0, OrganizationTradingService.MAX_PROFIT_BY_ROUTE_RESULTS)
            };

            logger.info(`Generated profit summary for organization ${organizationId}`, {
                totalActualProfit: summary.totalActualProfit,
                totalRuns: summary.totalRuns
            });

            return summary;
        } catch (error: unknown) {
            logger.error(`Error getting profit summary for organization ${organizationId}:`, error);
            return {
                totalEstimatedProfit: 0,
                totalActualProfit: 0,
                totalRuns: 0,
                avgProfitPerRun: 0,
                profitByRoute: []
            };
        }
    }
}


