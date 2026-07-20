"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingService = exports.TradingService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../../data-source");
const TradingRoute_1 = require("../../../models/TradingRoute");
const logger_1 = require("../../../utils/logger");
const tradingWebSocketController_1 = require("../../../websocket/controllers/tradingWebSocketController");
const NotificationService_1 = require("../../communication/notifications/NotificationService");
const UIFService_1 = require("./UIFService");
class TradingService {
    routeRepository = data_source_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
    routeShares = new Map();
    sharedRoutesByOrg = new Map();
    priceHistory = new Map();
    notificationService = new NotificationService_1.NotificationService();
    async findRouteById(id, organizationId) {
        const queryBuilder = this.routeRepository.createQueryBuilder('route').where('route.id = :id', {
            id,
        });
        if (organizationId) {
            queryBuilder.andWhere('route.organizationId = :organizationId', { organizationId });
        }
        return queryBuilder.getOne();
    }
    async createRoute(dto) {
        try {
            const route = this.routeRepository.create({
                id: (0, uuid_1.v4)(),
                ...dto,
                organizationId: dto.organizationId,
                visibility: dto.visibility || TradingRoute_1.RouteVisibility.ORGANIZATION,
                status: TradingRoute_1.RouteStatus.ACTIVE,
                performance: {
                    runCount: 0,
                    avgProfit: 0,
                    avgDuration: 0,
                },
            });
            if (!route.estimatedProfit) {
                route.estimatedProfit = await this.calculateRouteProfit(route.stops);
            }
            const savedRoute = await this.routeRepository.save(route);
            logger_1.logger.info(`Created trading route: ${savedRoute.id} - ${savedRoute.name}`, {
                organizationId: dto.organizationId,
                creatorId: dto.creatorId,
            });
            if (dto.organizationId) {
                (0, tradingWebSocketController_1.emitRouteCreated)(dto.organizationId, { id: savedRoute.id, name: savedRoute.name, status: savedRoute.status }, dto.creatorId);
            }
            await this.notificationService.create({
                userId: dto.creatorId,
                type: 'trade_operation_created',
                title: 'Trade Route Created',
                message: `Trading route "${savedRoute.name}" has been created`,
                data: { routeId: savedRoute.id, organizationId: dto.organizationId },
            });
            return savedRoute;
        }
        catch (error) {
            logger_1.logger.error('Error creating trading route:', error);
            throw error;
        }
    }
    async getRoutes(filters) {
        try {
            if (!filters.organizationId) {
                throw new Error('organizationId is required for tenant isolation');
            }
            const queryBuilder = this.routeRepository.createQueryBuilder('route');
            if (filters.includeShared) {
                const sharedRouteIds = this.getSharedRouteIds(filters.organizationId);
                if (sharedRouteIds.length > 0) {
                    queryBuilder.andWhere('(route.organizationId = :orgId OR route.id IN (:...sharedIds) OR route.visibility = :public)', {
                        orgId: filters.organizationId,
                        sharedIds: sharedRouteIds,
                        public: TradingRoute_1.RouteVisibility.PUBLIC,
                    });
                }
                else {
                    queryBuilder.andWhere('(route.organizationId = :orgId OR route.visibility = :public)', {
                        orgId: filters.organizationId,
                        public: TradingRoute_1.RouteVisibility.PUBLIC,
                    });
                }
            }
            else {
                queryBuilder.andWhere('route.organizationId = :orgId', {
                    orgId: filters.organizationId,
                });
            }
            if (filters?.creatorId) {
                queryBuilder.andWhere('route.creatorId = :creatorId', { creatorId: filters.creatorId });
            }
            if (filters?.status) {
                queryBuilder.andWhere('route.status = :status', { status: filters.status });
            }
            if (filters?.visibility) {
                queryBuilder.andWhere('route.visibility = :visibility', { visibility: filters.visibility });
            }
            if (filters?.tags && filters.tags.length > 0) {
                queryBuilder.andWhere('route.tags && :tags', { tags: filters.tags });
            }
            queryBuilder.orderBy('route.createdAt', 'DESC');
            const MAX_ROUTES = 200;
            queryBuilder.take(MAX_ROUTES + 1);
            const results = await queryBuilder.getMany();
            const hasMore = results.length > MAX_ROUTES;
            const routes = hasMore ? results.slice(0, MAX_ROUTES) : results;
            Object.defineProperty(routes, 'hasMore', { value: hasMore, enumerable: false });
            return routes;
        }
        catch (error) {
            logger_1.logger.error('Error getting trading routes:', error);
            throw error;
        }
    }
    async getOrganizationRoutes(organizationId, options = {}) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        const queryBuilder = this.routeRepository.createQueryBuilder('route');
        if (options.includeShared) {
            const sharedRouteIds = this.getSharedRouteIds(organizationId);
            if (sharedRouteIds.length > 0) {
                queryBuilder.where('(route.organizationId = :orgId OR route.id IN (:...sharedIds) OR route.visibility = :public)', { orgId: organizationId, sharedIds: sharedRouteIds, public: TradingRoute_1.RouteVisibility.PUBLIC });
            }
            else {
                queryBuilder.where('(route.organizationId = :orgId OR route.visibility = :public)', {
                    orgId: organizationId,
                    public: TradingRoute_1.RouteVisibility.PUBLIC,
                });
            }
        }
        else {
            queryBuilder.where('route.organizationId = :orgId', { orgId: organizationId });
        }
        if (options.status) {
            queryBuilder.andWhere('route.status = :status', { status: options.status });
        }
        queryBuilder.orderBy('route.createdAt', 'DESC').skip(skip).take(limit);
        const [data, total] = await queryBuilder.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async shareRoute(routeId, targetOrganizationId, sharedByUserId, ownerOrganizationId, permissions = 'view') {
        const route = await this.findRouteById(routeId, ownerOrganizationId);
        if (!route) {
            throw new Error(`Trading route ${routeId} not found`);
        }
        const share = {
            routeId,
            sharedWithOrganizationId: targetOrganizationId,
            sharedByUserId,
            sharedAt: new Date(),
            permissions,
        };
        const shares = this.routeShares.get(routeId) || [];
        const existingIndex = shares.findIndex(s => s.sharedWithOrganizationId === targetOrganizationId);
        if (existingIndex >= 0) {
            shares[existingIndex] = share;
        }
        else {
            shares.push(share);
        }
        this.routeShares.set(routeId, shares);
        if (!this.sharedRoutesByOrg.has(targetOrganizationId)) {
            this.sharedRoutesByOrg.set(targetOrganizationId, new Set());
        }
        this.sharedRoutesByOrg.get(targetOrganizationId).add(routeId);
        logger_1.logger.info(`Shared route ${routeId} with organization ${targetOrganizationId}`, {
            sharedBy: sharedByUserId,
            permissions,
        });
        return share;
    }
    async revokeRouteShare(routeId, targetOrganizationId) {
        const shares = this.routeShares.get(routeId);
        if (!shares) {
            return false;
        }
        const newShares = shares.filter(s => s.sharedWithOrganizationId !== targetOrganizationId);
        if (newShares.length < shares.length) {
            this.routeShares.set(routeId, newShares);
            const orgRoutes = this.sharedRoutesByOrg.get(targetOrganizationId);
            if (orgRoutes) {
                orgRoutes.delete(routeId);
                if (orgRoutes.size === 0) {
                    this.sharedRoutesByOrg.delete(targetOrganizationId);
                }
            }
            logger_1.logger.info(`Revoked route sharing for ${routeId} from organization ${targetOrganizationId}`);
            return true;
        }
        return false;
    }
    async getRouteShares(routeId) {
        return this.routeShares.get(routeId) || [];
    }
    getSharedRouteIds(organizationId) {
        const routeSet = this.sharedRoutesByOrg.get(organizationId);
        return routeSet ? [...routeSet] : [];
    }
    async recordPriceData(commodity, location, buyPrice, sellPrice) {
        const key = `${commodity}:${location}`;
        const history = this.priceHistory.get(key) || [];
        history.push({
            timestamp: new Date(),
            commodity,
            location,
            buyPrice,
            sellPrice,
        });
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const filtered = history.filter(h => h.timestamp >= cutoff);
        this.priceHistory.set(key, filtered);
    }
    async getPriceChartData(commodity, location, days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const allHistory = [];
        this.priceHistory.forEach((points, key) => {
            if (key.startsWith(`${commodity}:`)) {
                if (!location || key.endsWith(`:${location}`)) {
                    allHistory.push(...points.filter(p => p.timestamp >= cutoff));
                }
            }
        });
        const dailyData = {};
        for (const point of allHistory) {
            const dateKey = point.timestamp.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { buyPrices: [], sellPrices: [] };
            }
            dailyData[dateKey].buyPrices.push(point.buyPrice);
            dailyData[dateKey].sellPrices.push(point.sellPrice);
        }
        const history = Object.entries(dailyData)
            .map(([date, data]) => {
            const avgBuy = data.buyPrices.reduce((a, b) => a + b, 0) / data.buyPrices.length;
            const avgSell = data.sellPrices.reduce((a, b) => a + b, 0) / data.sellPrices.length;
            return {
                date,
                buyPrice: Math.round(avgBuy * 100) / 100,
                sellPrice: Math.round(avgSell * 100) / 100,
                profitMargin: avgBuy > 0 ? Math.round(((avgSell - avgBuy) / avgBuy) * 10000) / 100 : 0,
            };
        })
            .sort((a, b) => a.date.localeCompare(b.date));
        let trend = 'stable';
        if (history.length >= 2) {
            const firstProfit = history[0].profitMargin;
            const lastProfit = history.at(-1)?.profitMargin ?? 0;
            const change = lastProfit - firstProfit;
            if (change > 5) {
                trend = 'up';
            }
            else if (change < -5) {
                trend = 'down';
            }
        }
        let volatility = 0;
        if (history.length > 1) {
            const margins = history.map(h => h.profitMargin);
            const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
            const variance = margins.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / margins.length;
            volatility = Math.round(Math.sqrt(variance) * 100) / 100;
        }
        return {
            commodity,
            history,
            trend,
            volatility,
        };
    }
    async getMarketTrends(commodities, days = 7) {
        const trends = [];
        for (const commodity of commodities) {
            const chartData = await this.getPriceChartData(commodity, undefined, days);
            let currentPrice = 0;
            let priceChange = 0;
            if (chartData.history.length > 0) {
                const last = chartData.history.at(-1);
                currentPrice = last?.sellPrice ?? 0;
                if (chartData.history.length > 1 && last) {
                    const first = chartData.history[0];
                    priceChange =
                        Math.round(((last.sellPrice - first.sellPrice) / first.sellPrice) * 10000) / 100;
                }
            }
            trends.push({
                commodity,
                currentPrice,
                priceChange,
                trend: chartData.trend,
            });
        }
        return trends;
    }
    async getRouteById(id, organizationId) {
        try {
            return await this.findRouteById(id, organizationId);
        }
        catch (error) {
            logger_1.logger.error(`Error getting route ${id}:`, error);
            throw error;
        }
    }
    async updateRoute(id, dto, organizationId) {
        try {
            if (!organizationId) {
                throw new Error('organizationId is required for tenant isolation');
            }
            const route = await this.findRouteById(id, organizationId);
            if (!route) {
                throw new Error(`Trading route ${id} not found`);
            }
            const previousStatus = route.status;
            Object.assign(route, dto);
            if (dto.stops) {
                route.estimatedProfit = await this.calculateRouteProfit(dto.stops);
            }
            const updatedRoute = await this.routeRepository.save(route);
            logger_1.logger.info(`Updated trading route: ${id}`);
            if (updatedRoute.organizationId) {
                if (dto.status && dto.status !== previousStatus) {
                    (0, tradingWebSocketController_1.emitRouteStatusChanged)(updatedRoute.organizationId, updatedRoute.id, previousStatus, updatedRoute.status);
                }
                else {
                    (0, tradingWebSocketController_1.emitRouteUpdated)(updatedRoute.organizationId, {
                        id: updatedRoute.id,
                        name: updatedRoute.name,
                        status: updatedRoute.status,
                    });
                }
            }
            return updatedRoute;
        }
        catch (error) {
            logger_1.logger.error(`Error updating route ${id}:`, error);
            throw error;
        }
    }
    async deleteRoute(id, organizationId) {
        try {
            if (!organizationId) {
                throw new Error('organizationId is required for tenant isolation');
            }
            const route = await this.findRouteById(id, organizationId);
            const result = await this.routeRepository.delete({ id, organizationId });
            if (result.affected === 0) {
                throw new Error(`Trading route ${id} not found`);
            }
            logger_1.logger.info(`Deleted trading route: ${id}`);
            const orgId = route?.organizationId ?? organizationId;
            if (orgId) {
                (0, tradingWebSocketController_1.emitRouteDeleted)(orgId, id);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error deleting route ${id}:`, error);
            throw error;
        }
    }
    async recordRouteRun(id, profit, duration, organizationId, userId, options) {
        try {
            if (!organizationId) {
                throw new Error('organizationId is required for tenant isolation');
            }
            const route = await this.findRouteById(id, organizationId);
            if (!route) {
                throw new Error(`Trading route ${id} not found`);
            }
            const performance = route.performance || {
                runCount: 0,
                avgProfit: 0,
                avgDuration: 0,
            };
            const totalRuns = performance.runCount + 1;
            performance.avgProfit = (performance.avgProfit * performance.runCount + profit) / totalRuns;
            performance.avgDuration =
                (performance.avgDuration * performance.runCount + duration) / totalRuns;
            performance.runCount = totalRuns;
            performance.lastRun = new Date();
            route.performance = performance;
            const updatedRoute = await this.routeRepository.save(route);
            logger_1.logger.info(`Recorded route run for ${id}: profit=${profit}, duration=${duration}min`);
            if (userId) {
                const { tradeReputationService } = await Promise.resolve().then(() => __importStar(require('./TradeReputationService')));
                tradeReputationService
                    .recordTransaction({
                    routeId: id,
                    userId,
                    organizationId,
                    fleetId: options?.fleetId,
                    estimatedProfit: options?.estimatedProfit ?? route.estimatedProfit ?? 0,
                    actualProfit: profit,
                    durationMinutes: duration,
                    successStatus: options?.successStatus,
                })
                    .catch(err => {
                    logger_1.logger.error(`Failed to record trade transaction for route ${id}:`, err);
                });
            }
            return updatedRoute;
        }
        catch (error) {
            logger_1.logger.error(`Error recording route run for ${id}:`, error);
            throw error;
        }
    }
    async findTradeOpportunities(startLocation, minProfitMargin = 10, limit = 10) {
        try {
            logger_1.logger.info(`Finding trade opportunities from ${startLocation} with min ${minProfitMargin}% margin`);
            const itemsAtLocation = await UIFService_1.uifService.getItemsAtLocation(startLocation);
            const opportunities = [];
            for (const item of itemsAtLocation) {
                const comparison = await UIFService_1.uifService.comparePrices(item.name);
                if (comparison?.profitMargin &&
                    comparison.profitMargin >= minProfitMargin &&
                    comparison.bestBuyLocation &&
                    comparison.bestSellLocation) {
                    opportunities.push({
                        commodity: item.name,
                        buyLocation: comparison.bestBuyLocation.location,
                        sellLocation: comparison.bestSellLocation.location,
                        buyPrice: comparison.bestBuyLocation.price || 0,
                        sellPrice: comparison.bestSellLocation.price || 0,
                        profit: comparison.potentialProfit || 0,
                        profitMargin: comparison.profitMargin,
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const sorted = [...opportunities].sort((a, b) => b.profitMargin - a.profitMargin);
            return sorted.slice(0, limit);
        }
        catch (error) {
            logger_1.logger.error('Error finding trade opportunities:', error);
            return [];
        }
    }
    shouldSkipOpportunity(opp, options) {
        if (options.avoidLocations?.includes(opp.buyLocation) ||
            options.avoidLocations?.includes(opp.sellLocation)) {
            return true;
        }
        if (options.preferredCommodities &&
            options.preferredCommodities.length > 0 &&
            !options.preferredCommodities.includes(opp.commodity)) {
            return true;
        }
        return false;
    }
    addCommodityToStop(stops, visitedLocations, location, commodity, type, stopOrder) {
        if (visitedLocations.has(location)) {
            const existingStop = stops.find(s => s.location === location);
            const goodsList = type === 'buy' ? existingStop?.buyGoods : existingStop?.sellGoods;
            if (existingStop && !goodsList?.includes(commodity)) {
                if (type === 'buy') {
                    existingStop.buyGoods = [...(existingStop.buyGoods || []), commodity];
                }
                else {
                    existingStop.sellGoods = [...(existingStop.sellGoods || []), commodity];
                }
            }
            return stopOrder;
        }
        const newStop = {
            location,
            order: stopOrder,
            ...(type === 'buy' ? { buyGoods: [commodity] } : { sellGoods: [commodity] }),
        };
        stops.push(newStop);
        visitedLocations.add(location);
        return stopOrder + 1;
    }
    async optimizeRoute(options) {
        try {
            const opportunities = await this.findTradeOpportunities(options.startLocation, options.minProfitMargin || 10, options.maxStops || 5);
            if (opportunities.length === 0) {
                logger_1.logger.warn(`No profitable opportunities found from ${options.startLocation}`);
                return [];
            }
            const stops = [];
            const visitedLocations = new Set([options.startLocation]);
            stops.push({
                location: options.startLocation,
                buyGoods: [],
                sellGoods: [],
                order: 0,
            });
            let stopOrder = 1;
            for (const opp of opportunities) {
                if (this.shouldSkipOpportunity(opp, options)) {
                    continue;
                }
                stopOrder = this.addCommodityToStop(stops, visitedLocations, opp.buyLocation, opp.commodity, 'buy', stopOrder);
                stopOrder = this.addCommodityToStop(stops, visitedLocations, opp.sellLocation, opp.commodity, 'sell', stopOrder);
                if (stops.length >= (options.maxStops || 5)) {
                    break;
                }
            }
            logger_1.logger.info(`Optimized route with ${stops.length} stops`);
            return stops;
        }
        catch (error) {
            logger_1.logger.error('Error optimizing route:', error);
            throw error;
        }
    }
    async processStopGoods(goods, location, type, transactions) {
        if (!goods) {
            return;
        }
        for (const good of goods) {
            const prices = await UIFService_1.uifService.getItemPrices(good);
            const matchedPrice = prices.find(p => p.location.toLowerCase().includes(location.toLowerCase()) && p.type === type);
            if (matchedPrice?.price) {
                const existing = transactions.get(good) || {};
                existing[type] = matchedPrice.price;
                transactions.set(good, existing);
            }
        }
    }
    async calculateRouteProfit(stops) {
        try {
            const transactions = new Map();
            for (const stop of stops) {
                await this.processStopGoods(stop.buyGoods, stop.location, 'buy', transactions);
                await this.processStopGoods(stop.sellGoods, stop.location, 'sell', transactions);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            let totalProfit = 0;
            transactions.forEach(prices => {
                if (prices.buy && prices.sell) {
                    totalProfit += prices.sell - prices.buy;
                }
            });
            return totalProfit;
        }
        catch (error) {
            logger_1.logger.error('Error calculating route profit:', error);
            return 0;
        }
    }
    async analyzeRouteProfitability(id, organizationId) {
        try {
            const route = await this.findRouteById(id, organizationId);
            if (!route) {
                throw new Error(`Trading route ${id} not found`);
            }
            const currentProfit = await this.calculateRouteProfit(route.stops);
            const commodities = [];
            route.stops.forEach(stop => {
                if (stop.buyGoods) {
                    commodities.push(...stop.buyGoods);
                }
                if (stop.sellGoods) {
                    commodities.push(...stop.sellGoods);
                }
            });
            const uniqueCommodities = [...new Set(commodities)];
            const commodityAnalysis = [];
            for (const commodity of uniqueCommodities) {
                const comparison = await UIFService_1.uifService.comparePrices(commodity);
                if (comparison) {
                    commodityAnalysis.push({
                        commodity,
                        currentProfit: comparison.potentialProfit,
                        profitMargin: comparison.profitMargin,
                        bestBuyLocation: comparison.bestBuyLocation?.location,
                        bestSellLocation: comparison.bestSellLocation?.location,
                    });
                }
            }
            return {
                routeId: id,
                routeName: route.name,
                currentEstimatedProfit: currentProfit,
                originalEstimatedProfit: route.estimatedProfit,
                profitChange: currentProfit - (route.estimatedProfit || 0),
                profitChangePercent: route.estimatedProfit
                    ? ((currentProfit - route.estimatedProfit) / route.estimatedProfit) * 100
                    : 0,
                performance: route.performance,
                commodityAnalysis,
                lastUpdated: new Date(),
            };
        }
        catch (error) {
            logger_1.logger.error(`Error analyzing route profitability for ${id}:`, error);
            throw error;
        }
    }
    async refreshAllRouteProfits() {
        try {
            const routes = await this.routeRepository.find({
                where: { status: TradingRoute_1.RouteStatus.ACTIVE },
            });
            let updated = 0;
            let failed = 0;
            for (const route of routes) {
                try {
                    const newProfit = await this.calculateRouteProfit(route.stops);
                    route.estimatedProfit = newProfit;
                    await this.routeRepository.save(route);
                    updated++;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to update profit for route ${route.id}:`, error);
                    failed++;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            logger_1.logger.info(`Route profit refresh complete: ${updated} updated, ${failed} failed`);
            return { updated, failed };
        }
        catch (error) {
            logger_1.logger.error('Error refreshing route profits:', error);
            throw error;
        }
    }
}
exports.TradingService = TradingService;
exports.tradingService = new TradingService();
//# sourceMappingURL=TradingService.js.map