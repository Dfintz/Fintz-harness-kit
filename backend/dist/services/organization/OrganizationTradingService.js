"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationTradingService = void 0;
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const TradingRoute_1 = require("../../models/TradingRoute");
const logger_1 = require("../../utils/logger");
class OrganizationTradingService {
    routeRepository;
    fleetRepository;
    static DEFAULT_CARGO_CAPACITY = 100;
    static MAX_PROFIT_BY_ROUTE_RESULTS = 10;
    constructor() {
        this.routeRepository = data_source_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        this.fleetRepository = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
    }
    async getActiveRouteCount(organizationId) {
        try {
            const count = await this.routeRepository.count({
                where: {
                    organizationId,
                    status: TradingRoute_1.RouteStatus.ACTIVE
                }
            });
            logger_1.logger.debug(`Active route count for organization ${organizationId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_1.logger.error(`Error getting active route count for organization ${organizationId}:`, error);
            return 0;
        }
    }
    async getRouteStats(organizationId) {
        try {
            const routes = await this.routeRepository.find({
                where: { organizationId }
            });
            const activeRoutes = routes.filter(r => r.status === TradingRoute_1.RouteStatus.ACTIVE);
            const totalProfit = routes.reduce((sum, route) => sum + (route.estimatedProfit || 0), 0);
            const avgProfitPerRoute = routes.length > 0 ? totalProfit / routes.length : 0;
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
            const stats = {
                activeRoutes: activeRoutes.length,
                totalRoutes: routes.length,
                totalProfit,
                avgProfitPerRoute: Math.round(avgProfitPerRoute),
                topRoutes
            };
            logger_1.logger.info(`Generated trading route stats for organization ${organizationId}`, {
                activeRoutes: stats.activeRoutes,
                totalRoutes: stats.totalRoutes
            });
            return stats;
        }
        catch (error) {
            logger_1.logger.error(`Error getting route stats for organization ${organizationId}:`, error);
            return {
                activeRoutes: 0,
                totalRoutes: 0,
                totalProfit: 0,
                avgProfitPerRoute: 0,
                topRoutes: []
            };
        }
    }
    async getRouteRecommendations(organizationId, limit = 5) {
        try {
            const fleets = await this.fleetRepository.find({
                where: { organizationId }
            });
            let maxCargoCapacity = 0;
            const capacities = new Set();
            for (const fleet of fleets) {
                if (fleet.composition?.totalCargoCapacity) {
                    const capacity = fleet.composition.totalCargoCapacity;
                    capacities.add(capacity);
                    if (capacity > maxCargoCapacity) {
                        maxCargoCapacity = capacity;
                    }
                }
            }
            if (maxCargoCapacity === 0) {
                maxCargoCapacity = OrganizationTradingService.DEFAULT_CARGO_CAPACITY;
            }
            const routes = await this.routeRepository.find({
                where: {
                    organizationId,
                    status: TradingRoute_1.RouteStatus.ACTIVE
                }
            });
            const recommendations = routes
                .filter(route => {
                const requiredCapacity = route.minCargoCapacity || 0;
                return requiredCapacity <= maxCargoCapacity;
            })
                .map(route => {
                const suitableShips = Array.from(capacities).filter(capacity => capacity >= (route.minCargoCapacity || 0)).length;
                const duration = route.estimatedDuration || 1;
                const profit = route.estimatedProfit || 0;
                const profitPerMinute = Math.round((profit / duration) * 100) / 100;
                let difficulty = 'Easy';
                const requiredCapacity = route.minCargoCapacity || 0;
                if (requiredCapacity > 50 || duration > 45) {
                    difficulty = 'Hard';
                }
                else if (requiredCapacity > 20 || duration > 25) {
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
            logger_1.logger.info(`Generated ${recommendations.length} route recommendations for organization ${organizationId}`, {
                maxCargoCapacity,
                totalRoutes: routes.length
            });
            return recommendations;
        }
        catch (error) {
            logger_1.logger.error(`Error getting route recommendations for organization ${organizationId}:`, error);
            return [];
        }
    }
    async getProfitSummary(organizationId) {
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
            logger_1.logger.info(`Generated profit summary for organization ${organizationId}`, {
                totalActualProfit: summary.totalActualProfit,
                totalRuns: summary.totalRuns
            });
            return summary;
        }
        catch (error) {
            logger_1.logger.error(`Error getting profit summary for organization ${organizationId}:`, error);
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
exports.OrganizationTradingService = OrganizationTradingService;
//# sourceMappingURL=OrganizationTradingService.js.map