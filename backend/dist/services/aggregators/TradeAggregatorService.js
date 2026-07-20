"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeAggregatorService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const logger_1 = require("../../utils/logger");
const communication_1 = require("../communication");
const DiscordService_1 = require("../discord/DiscordService");
const LogisticsAlertService_1 = require("../trade/logistics/LogisticsAlertService");
const LogisticsRouteOptimizationService_1 = require("../trade/logistics/LogisticsRouteOptimizationService");
const SupplierManagementService_1 = require("../trade/logistics/SupplierManagementService");
const TradeServiceFacade_1 = require("../trade/TradeServiceFacade");
const TradingService_1 = require("../trade/trading/TradingService");
const SagaOrchestrator_1 = require("./SagaOrchestrator");
const DEFAULT_BASE_BUY_PRICE = Number(process.env.TRADE_DEFAULT_BUY_PRICE) || 100;
const DEFAULT_BASE_SELL_PRICE = Number(process.env.TRADE_DEFAULT_SELL_PRICE) || 500;
const DEFAULT_PRICE_VARIATION = Number(process.env.TRADE_DEFAULT_PRICE_VARIATION) || 1000;
class TradeAggregatorService {
    tradeFacade;
    tradingService;
    alertService;
    supplierService;
    routeOptimizer;
    notificationService;
    discordService;
    constructor() {
        this.tradeFacade = new TradeServiceFacade_1.TradeServiceFacade();
        this.tradingService = new TradingService_1.TradingService();
        this.alertService = new LogisticsAlertService_1.LogisticsAlertService();
        this.supplierService = new SupplierManagementService_1.SupplierManagementService();
        this.routeOptimizer = new LogisticsRouteOptimizationService_1.LogisticsRouteOptimizationService();
        this.notificationService = new communication_1.NotificationService(undefined, undefined);
        this.discordService = (0, DiscordService_1.getDiscordService)();
    }
    async createTradeOperation(params) {
        const saga = new SagaOrchestrator_1.SagaOrchestrator({
            name: 'CreateTradeOperation',
            maxRetries: 2,
            retryDelayMs: 500,
        });
        const context = { ...params, results: {} };
        saga.addStep({
            name: 'createRoute',
            execute: async (ctx) => {
                const route = await this.tradingService.createRoute({
                    creatorId: ctx.operationData.coordinatorId,
                    organizationId: ctx.organizationId,
                    name: ctx.operationData.name,
                    description: ctx.operationData.description || '',
                    stops: ctx.operationData.stops,
                    estimatedProfit: ctx.operationData.estimatedProfit,
                });
                ctx.results.route = route;
                return route;
            },
            compensate: async (ctx, route) => {
                if (route && typeof route === 'object' && 'id' in route) {
                    try {
                        await this.tradingService.deleteRoute(route.id, ctx.organizationId);
                        logger_1.logger.info('Compensated: Deleted route', { routeId: route.id });
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to delete route during compensation', { error });
                    }
                }
            },
        });
        saga.addStep({
            name: 'optimizeRoute',
            execute: async (ctx) => {
                if (!ctx.routeOptions) {
                    return null;
                }
                const route = ctx.results.route;
                try {
                    const waypoints = route.stops.map(stop => ({
                        location: stop.location,
                        type: 'waypoint',
                        items: [],
                        priority: stop.order,
                        estimatedTimeAtStop: 30,
                    }));
                    const optimizedRoute = await this.routeOptimizer.optimizeRoute({
                        organizationId: ctx.organizationId,
                        name: route.name,
                        waypoints,
                        prioritizeBy: ctx.routeOptions.optimizeForFuel ? 'fuel' : 'distance',
                    });
                    ctx.results.optimizedRoute = optimizedRoute;
                    return optimizedRoute;
                }
                catch (error) {
                    logger_1.logger.warn('Route optimization failed, continuing without optimization', { error });
                    return null;
                }
            },
            compensate: async () => {
            },
        });
        saga.addStep({
            name: 'createAlerts',
            execute: async (ctx) => {
                if (!ctx.alertsConfig?.priceThresholds || ctx.alertsConfig.priceThresholds.length === 0) {
                    return { alertCount: 0, alertIds: [] };
                }
                const route = ctx.results.route;
                const createdAlerts = [];
                for (const threshold of ctx.alertsConfig.priceThresholds) {
                    logger_1.logger.info('Price threshold configured', {
                        routeId: route.id,
                        commodity: threshold.commodityName,
                        minPrice: threshold.minPrice,
                        maxPrice: threshold.maxPrice,
                    });
                    createdAlerts.push(`threshold-${threshold.commodityName}-${(0, uuid_1.v4)()}`);
                }
                ctx.results.alerts = createdAlerts;
                return { alertCount: createdAlerts.length, alertIds: createdAlerts };
            },
            compensate: async (_ctx, result) => {
                if (result && typeof result === 'object' && 'alertIds' in result) {
                    const { alertIds } = result;
                    logger_1.logger.info('Compensated: Removed alert configurations', { count: alertIds.length });
                }
            },
        });
        saga.addStep({
            name: 'linkSuppliers',
            execute: async (ctx) => {
                if (!ctx.supplierIds || ctx.supplierIds.length === 0) {
                    return { linkedCount: 0, supplierIds: [] };
                }
                const route = ctx.results.route;
                const allOrgSuppliers = await this.supplierService.getSuppliers(ctx.organizationId);
                const orgSupplierIds = new Set(allOrgSuppliers.map(s => s.id));
                const linkedSuppliers = ctx.supplierIds.filter(id => orgSupplierIds.has(id));
                for (const supplierId of linkedSuppliers) {
                    logger_1.logger.info('Linked supplier to route', { supplierId, routeId: route.id });
                }
                ctx.results.linkedSuppliers = linkedSuppliers;
                return { linkedCount: linkedSuppliers.length, supplierIds: linkedSuppliers };
            },
            compensate: async (_ctx, result) => {
                if (result && typeof result === 'object' && 'supplierIds' in result) {
                    const { supplierIds } = result;
                    logger_1.logger.info('Compensated: Unlinked suppliers', { count: supplierIds.length });
                }
            },
        });
        saga.addStep({
            name: 'sendNotifications',
            execute: async (ctx) => {
                const notifications = [];
                const route = ctx.results.route;
                if (ctx.notifyParticipants) {
                    try {
                        await this.notificationService.create({
                            userId: ctx.operationData.coordinatorId,
                            type: 'trade_operation_created',
                            title: 'Trade Operation Created',
                            message: `Trade operation "${ctx.operationData.name}" has been created`,
                            data: {
                                routeId: route.id,
                                stops: route.stops,
                            },
                        });
                        notifications.push({ type: 'coordinator' });
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to send coordinator notification', { error });
                    }
                }
                if (ctx.postToDiscord && ctx.discordChannelId) {
                    try {
                        const stopsList = route.stops.map(s => s.location).join(' → ');
                        await this.discordService.sendMessage(ctx.discordChannelId, `📦 New Trade Operation: **${ctx.operationData.name}**\n` +
                            `Route: ${stopsList}\n` +
                            `Est. Profit: ${ctx.operationData.estimatedProfit || 'TBD'} aUEC`);
                        notifications.push({ type: 'discord' });
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to post to Discord', { error });
                    }
                }
                return { notificationsSent: notifications.length };
            },
            compensate: async () => {
            },
        });
        const result = await saga.execute(context);
        if (result.success) {
            logger_1.logger.info('Trade operation created successfully', {
                routeId: context.results.route?.id,
                organizationId: params.organizationId,
            });
        }
        else {
            logger_1.logger.error('Failed to create trade operation', {
                error: result.error?.message,
                completedSteps: result.completed,
                compensatedSteps: result.compensated,
            });
        }
        return result;
    }
    async executeTradeRun(params) {
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                const routes = await this.tradingService.getRoutes({
                    organizationId: params.organizationId,
                });
                const route = routes.find(r => r.id === params.routeId);
                if (!route) {
                    throw new Error('Trade route not found');
                }
                const estimatedProfit = route.estimatedProfit || 0;
                let actualProfit = 0;
                if (params.actualBuyPrice && params.actualSellPrice && params.quantityTraded) {
                    actualProfit = (params.actualSellPrice - params.actualBuyPrice) * params.quantityTraded;
                }
                let performanceRating = 'average';
                if (actualProfit > 0 && estimatedProfit > 0) {
                    const ratio = actualProfit / estimatedProfit;
                    if (ratio >= 1.2) {
                        performanceRating = 'excellent';
                    }
                    else if (ratio >= 1.0) {
                        performanceRating = 'good';
                    }
                    else if (ratio >= 0.8) {
                        performanceRating = 'average';
                    }
                    else {
                        performanceRating = 'poor';
                    }
                }
                try {
                    await this.tradingService.updateRoute(route.id, {
                        status: 'active',
                        lastUsedAt: new Date(),
                    }, route.organizationId);
                }
                catch (error) {
                    logger_1.logger.warn('Failed to update route execution data', { error });
                }
                const recommendations = [];
                if (performanceRating === 'poor') {
                    recommendations.push('Consider renegotiating prices or finding alternative routes');
                }
                if (actualProfit < estimatedProfit * 0.5) {
                    recommendations.push('Significant deviation from estimated profit - review market conditions');
                }
                if (!params.shipId) {
                    recommendations.push('Consider tracking ship usage for better fleet analytics');
                }
                logger_1.logger.info('Trade run executed', {
                    routeId: params.routeId,
                    actualProfit,
                    performanceRating,
                });
                return {
                    route,
                    execution: {
                        executedAt: new Date(),
                        actualProfit,
                        performanceRating,
                    },
                    recommendations,
                };
            }
            catch (error) {
                logger_1.logger.error('Failed to execute trade run', { error });
                throw error;
            }
        });
    }
    async analyzeSupplyChain(params) {
        try {
            const commodityAnalysis = [];
            const riskFactors = [];
            const recommendations = [];
            let totalEstimatedProfit = 0;
            for (let i = 0; i < params.commodities.length; i++) {
                const commodity = params.commodities[i];
                const baseMultiplier = (i + 1) * 0.3;
                const analysis = {
                    name: commodity,
                    bestBuyLocation: params.startLocation,
                    bestBuyPrice: Math.floor(DEFAULT_BASE_BUY_PRICE + DEFAULT_PRICE_VARIATION * baseMultiplier * 0.1),
                    bestSellLocation: params.endLocation || params.startLocation,
                    bestSellPrice: Math.floor(DEFAULT_BASE_SELL_PRICE + DEFAULT_PRICE_VARIATION * baseMultiplier * 0.5),
                    potentialProfit: 0,
                };
                analysis.potentialProfit = analysis.bestSellPrice - analysis.bestBuyPrice;
                totalEstimatedProfit += analysis.potentialProfit;
                commodityAnalysis.push(analysis);
            }
            let optimizedRoute = null;
            try {
                const waypoints = [
                    {
                        location: params.startLocation,
                        type: 'pickup',
                        items: [],
                        priority: 1,
                        estimatedTimeAtStop: 30,
                    },
                ];
                const sellLocations = new Set(commodityAnalysis.map(c => c.bestSellLocation));
                let priority = 2;
                for (const location of sellLocations) {
                    waypoints.push({
                        location,
                        type: 'delivery',
                        items: [],
                        priority,
                        estimatedTimeAtStop: 30,
                    });
                    priority++;
                }
                optimizedRoute = await this.routeOptimizer.optimizeRoute({
                    organizationId: params.organizationId,
                    name: 'Supply Chain Analysis Route',
                    waypoints,
                    prioritizeBy: 'distance',
                });
            }
            catch (error) {
                logger_1.logger.warn('Route optimization failed for supply chain analysis', { error });
            }
            if (params.commodities.length > 5) {
                riskFactors.push('High commodity diversity increases complexity');
            }
            if (totalEstimatedProfit < 5000) {
                riskFactors.push('Low estimated profit margin');
            }
            if (commodityAnalysis.some(c => c.potentialProfit < 0)) {
                recommendations.push('Some commodities show negative profit - consider removing from operation');
            }
            if (params.budget && totalEstimatedProfit > params.budget * 0.5) {
                recommendations.push('Potential ROI exceeds 50% - high opportunity');
            }
            if (params.includeSuppliers) {
                recommendations.push('Consider establishing preferred supplier relationships for regular runs');
            }
            if (params.includeSuppliers) {
                try {
                    const suppliers = await this.supplierService.getSuppliers(params.organizationId, {});
                    if (suppliers.length === 0) {
                        recommendations.push('No suppliers registered - consider adding trusted suppliers');
                    }
                    else {
                        recommendations.push(`${suppliers.length} suppliers available for this supply chain`);
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to get supplier data for analysis', { error });
                }
            }
            logger_1.logger.info('Supply chain analysis completed', {
                organizationId: params.organizationId,
                commodityCount: params.commodities.length,
                totalEstimatedProfit,
            });
            return {
                commodities: commodityAnalysis,
                optimizedRoute,
                totalEstimatedProfit,
                riskFactors,
                recommendations,
            };
        }
        catch (error) {
            logger_1.logger.error('Supply chain analysis failed', { error });
            throw error;
        }
    }
    async bulkUpdateRouteStatus(organizationId, routeIds, newStatus, updatedById, reason) {
        const successful = [];
        const failed = [];
        let notificationCount = 0;
        return data_source_1.AppDataSource.transaction(async () => {
            const allRoutes = await this.tradingService.getRoutes({ organizationId });
            const routeMap = new Map(allRoutes.map(r => [r.id, r]));
            for (const routeId of routeIds) {
                try {
                    await this.tradingService.updateRoute(routeId, {
                        status: newStatus,
                    }, organizationId);
                    successful.push(routeId);
                    try {
                        const route = routeMap.get(routeId);
                        if (route) {
                            await this.notificationService.create({
                                userId: route.creatorId,
                                type: 'route_status_changed',
                                title: 'Route Status Updated',
                                message: `Route "${route.name}" status changed to ${newStatus}${reason ? `: ${reason}` : ''}`,
                                data: { routeId, newStatus, updatedById },
                            });
                            notificationCount++;
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to send route status notification', { routeId, error });
                    }
                }
                catch (error) {
                    failed.push({
                        id: routeId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            logger_1.logger.info('Bulk route status update completed', {
                organizationId,
                successful: successful.length,
                failed: failed.length,
                newStatus,
            });
            return { successful, failed, notifications: notificationCount };
        });
    }
    async getTradeOperationOverview(organizationId) {
        try {
            const routes = await this.tradingService.getRoutes({ organizationId });
            const activeRoutes = routes.filter(r => r.status === 'active').length;
            const alerts = await this.alertService.getAlerts({});
            const activeAlerts = alerts.filter(a => a.status === 'active').length;
            const suppliers = await this.supplierService.getSuppliers(organizationId, {});
            const recentActivity = routes.slice(0, 5).map(r => ({
                routeId: r.id,
                routeName: r.name,
                status: r.status,
                lastUpdated: r.updatedAt || r.createdAt,
            }));
            const topPerformingRoutes = routes
                .filter(r => r.estimatedProfit && r.estimatedProfit > 0)
                .sort((a, b) => (b.estimatedProfit || 0) - (a.estimatedProfit || 0))
                .slice(0, 5)
                .map(r => ({
                id: r.id,
                name: r.name,
                estimatedProfit: r.estimatedProfit,
                route: r.stops.map(s => s.location).join(' → '),
            }));
            return {
                activeRoutes,
                totalRoutes: routes.length,
                activeAlerts,
                supplierCount: suppliers.length,
                recentActivity,
                topPerformingRoutes,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get trade operation overview', { error });
            throw error;
        }
    }
}
exports.TradeAggregatorService = TradeAggregatorService;
//# sourceMappingURL=TradeAggregatorService.js.map