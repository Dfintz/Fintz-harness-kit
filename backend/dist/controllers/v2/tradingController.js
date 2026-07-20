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
exports.TradingControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Ticket_1 = require("../../models/Ticket");
const TradeTransaction_1 = require("../../models/TradeTransaction");
const TradingRoute_1 = require("../../models/TradingRoute");
const TradeAggregatorService_1 = require("../../services/aggregators/TradeAggregatorService");
const TicketService_1 = require("../../services/communication/tickets/TicketService");
const UEXPriceFeed_1 = require("../../services/trade/trading/UEXPriceFeed");
const TradingRouteService_1 = require("../../services/trade/TradingRouteService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const tradingWebSocketController_1 = require("../../websocket/controllers/tradingWebSocketController");
class TradingControllerV2 {
    uexPriceFeed = new UEXPriceFeed_1.UEXPriceFeed();
    ticketService = TicketService_1.TicketService.getInstance();
    async findTradingRouteById(routeId, organizationId) {
        return TradingRouteService_1.tradingRouteService.findById(routeId, organizationId);
    }
    async findOrganizationMembership(userId, organizationId) {
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        return membershipRepo
            .createQueryBuilder('membership')
            .where('membership.organizationId = :organizationId', { organizationId })
            .andWhere('membership.userId = :userId', { userId })
            .andWhere('membership.isActive = :isActive', { isActive: true })
            .getOne();
    }
    async findTradeTransactionByOrg(transactionId, organizationId) {
        const transactionRepo = database_1.AppDataSource.getRepository(TradeTransaction_1.TradeTransaction);
        return transactionRepo
            .createQueryBuilder('transaction')
            .where('transaction.id = :transactionId', { transactionId })
            .andWhere('transaction.organizationId = :organizationId', { organizationId })
            .getOne();
    }
    async canManageTradeDisputes(authReq, orgId) {
        const user = authReq.user;
        if (!user?.id) {
            return false;
        }
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'org_admin') {
            return true;
        }
        if (user.currentOrganizationId !== orgId) {
            return false;
        }
        const membership = await this.findOrganizationMembership(user.id, orgId);
        const orgRole = (0, roleUtils_1.getRoleName)(membership?.role);
        return ['owner', 'founder', 'admin', 'senior_officer', 'officer'].includes(orgRole);
    }
    async listOrgRoutes(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const { limit, offset, sort, filters, search, fields } = req.queryParams || {
                limit: 20,
                offset: 0,
                sort: null,
                filters: {},
                search: null,
                fields: null,
            };
            const { routes, total } = await TradingRouteService_1.tradingRouteService.listOrgRoutes(orgId, {
                limit,
                offset,
                sort,
                filters,
                search,
                fields,
            });
            const filteredRoutes = (0, queryParser_1.selectFieldsFromArray)(routes, fields);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/trading/routes`, offset, limit, total);
            res.paginated(filteredRoutes, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.listOrgRoutes] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading routes', 500);
        }
    }
    async createRoute(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            const routeData = req.body;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const userId = req.user?.id ?? '';
            const newRoute = await TradingRouteService_1.tradingRouteService.createRoute(orgId, userId, routeData);
            res.success(newRoute);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.createRoute] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to create trading route', 500);
        }
    }
    async getUexRoutes(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const rawLimit = Number(req.query.limit);
            const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 25, 100);
            const rawMargin = Number(req.query.minMargin);
            const minMargin = req.query.minMargin !== undefined && Number.isFinite(rawMargin) ? rawMargin : 5;
            const filters = {
                commodity: req.query.commodity,
                starSystemStart: req.query.starSystemStart,
                starSystemEnd: req.query.starSystemEnd,
                terminalStart: req.query.terminalStart,
                terminalEnd: req.query.terminalEnd,
                investment: req.query.investment ? Number(req.query.investment) : undefined,
                scu: req.query.scu ? Number(req.query.scu) : undefined,
            };
            const routes = await this.uexPriceFeed.getTopTradeRoutes(limit, minMargin, filters);
            res.success({
                routes,
                total: routes.length,
                source: 'UEX Corp',
                disclaimer: 'Data is community-reported and may not reflect live server prices. Prices are per SCU and limited to reports from the last 3 days.',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.getUexRoutes] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX trade routes', 500);
        }
    }
    async getUexTerminals(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const terminals = await this.uexPriceFeed.getTerminalsList();
            res.success(terminals);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.getUexTerminals] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX terminals', 500);
        }
    }
    async getUexCommodities(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const commodities = await this.uexPriceFeed.getCommoditiesList();
            res.success(commodities);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.getUexCommodities] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX commodities', 500);
        }
    }
    async getRouteById(req, res) {
        try {
            const { id } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const route = await TradingRouteService_1.tradingRouteService.findById(id, userOrgId);
            if (!route) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
            }
            res.success(route);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.getRouteById] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading route', 500);
        }
    }
    async updateRoute(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const { route } = await TradingRouteService_1.tradingRouteService.updateRoute(id, userOrgId, updates);
            res.success(route);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.updateRoute] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to update trading route', 500);
        }
    }
    async deleteRoute(req, res) {
        try {
            const { id } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            await TradingRouteService_1.tradingRouteService.deleteRoute(id, userOrgId);
            res.success({ message: 'Trading route deleted successfully' });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.deleteRoute] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to delete trading route', 500);
        }
    }
    async getOpportunities(req, res) {
        try {
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Organization context required to view trading opportunities', 403);
            }
            const minProfit = Number.parseInt(req.query.minProfit, 10) || 0;
            const maxDistance = Number.parseInt(req.query.maxDistance, 10) || 1000;
            const cargoCapacity = Number.parseInt(req.query.cargoCapacity, 10) || 0;
            const limit = Number.parseInt(req.query.limit, 10) || 20;
            const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
            const queryBuilder = routeRepo
                .createQueryBuilder('route')
                .where('route.status = :status', { status: TradingRoute_1.RouteStatus.ACTIVE })
                .andWhere('route.organizationId = :userOrgId', { userOrgId });
            if (minProfit > 0) {
                queryBuilder.andWhere('route.estimatedProfit >= :minProfit', { minProfit });
            }
            if (cargoCapacity) {
                queryBuilder.andWhere('(route.minCargoCapacity IS NULL OR route.minCargoCapacity <= :cargoCapacity)', {
                    cargoCapacity,
                });
            }
            const opportunities = await queryBuilder
                .orderBy('route.estimatedProfit', 'DESC')
                .take(limit)
                .getMany();
            const enrichedOpportunities = opportunities.map(route => {
                const profitPerHour = route.estimatedDuration && route.estimatedProfit
                    ? route.estimatedProfit / (route.estimatedDuration / 60)
                    : 0;
                return {
                    ...route,
                    profitPerHour: Math.round(profitPerHour),
                    rating: TradingRouteService_1.tradingRouteService.calculateRouteRating(route),
                };
            });
            res.success({
                opportunities: enrichedOpportunities,
                count: enrichedOpportunities.length,
                filters: {
                    minProfit,
                    maxDistance,
                    cargoCapacity,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getOpportunities] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading opportunities', 500);
        }
    }
    async getOrgAnalytics(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
            const routes = await routeRepo.find({
                where: { organizationId: orgId },
            });
            const analytics = {
                routes: {
                    total: routes.length,
                    active: routes.filter(r => r.status === TradingRoute_1.RouteStatus.ACTIVE).length,
                    inactive: routes.filter(r => r.status === TradingRoute_1.RouteStatus.INACTIVE).length,
                    deprecated: routes.filter(r => r.status === TradingRoute_1.RouteStatus.DEPRECATED).length,
                },
                performance: {
                    totalRuns: routes.reduce((sum, r) => sum + (r.performance?.runCount || 0), 0),
                    totalProfit: routes.reduce((sum, r) => sum + (r.performance?.avgProfit || 0) * (r.performance?.runCount || 0), 0),
                    avgProfitPerRoute: routes.length > 0
                        ? routes.reduce((sum, r) => sum + (r.performance?.avgProfit || 0), 0) / routes.length
                        : 0,
                },
                topRoutes: routes
                    .filter(r => r.performance && r.performance.runCount > 0)
                    .sort((a, b) => (b.performance?.avgProfit || 0) - (a.performance?.avgProfit || 0))
                    .slice(0, 5)
                    .map(r => ({
                    id: r.id,
                    name: r.name,
                    avgProfit: r.performance?.avgProfit || 0,
                    runCount: r.performance?.runCount || 0,
                })),
            };
            res.success(analytics);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getOrgAnalytics] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading analytics', 500);
        }
    }
    async getMarketAnalysis(req, res) {
        try {
            const userOrgId = req.user?.currentOrganizationId;
            if (!userOrgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Organization context required to view market analysis', 403);
            }
            const _commodity = req.query.commodity;
            const _location = req.query.location;
            const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
            const routes = await routeRepo.find({
                where: { status: TradingRoute_1.RouteStatus.ACTIVE, organizationId: userOrgId },
            });
            const commodities = new Set();
            const locations = new Set();
            routes.forEach(route => {
                route.stops.forEach(stop => {
                    locations.add(stop.location);
                    stop.buyGoods?.forEach(good => commodities.add(good));
                    stop.sellGoods?.forEach(good => commodities.add(good));
                });
            });
            const analysis = {
                summary: {
                    totalRoutes: routes.length,
                    uniqueCommodities: commodities.size,
                    uniqueLocations: locations.size,
                },
                popularCommodities: Array.from(commodities).slice(0, 10),
                popularLocations: Array.from(locations).slice(0, 10),
                trends: {
                    highProfitRoutes: routes.filter(r => (r.estimatedProfit || 0) > 50000).length,
                    quickRoutes: routes.filter(r => (r.estimatedDuration || 0) < 60).length,
                },
            };
            res.success(analysis);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getMarketAnalysis] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch market analysis', 500);
        }
    }
    async getCommodityPrices(req, res) {
        try {
            const { commodity } = req.params;
            const location = req.query.location;
            const days = Number.parseInt(req.query.days, 10) || 30;
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            const chartData = await tradingService.getPriceChartData(commodity, location, days);
            res.success(chartData);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getCommodityPrices] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch commodity price data', 500);
        }
    }
    async getMarketTrends(req, res) {
        try {
            const commoditiesParam = req.query.commodities;
            const daysParam = req.query.days;
            if (!commoditiesParam || typeof commoditiesParam !== 'string') {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'commodities query parameter is required', 400);
            }
            const days = daysParam && typeof daysParam === 'string' ? Number.parseInt(daysParam) : 7;
            const commodities = commoditiesParam.split(',').map(c => c.trim());
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            const trends = await tradingService.getMarketTrends(commodities, days);
            res.success({
                commodities: trends,
                period: `${days} days`,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getMarketTrends] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch market trends', 500);
        }
    }
    async recordPrice(req, res) {
        try {
            const { commodity, location, buyPrice, sellPrice } = req.body;
            if (!commodity || !location || buyPrice === undefined || sellPrice === undefined) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'commodity, location, buyPrice, and sellPrice are required', 400);
            }
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            await tradingService.recordPriceData(commodity, location, buyPrice, sellPrice);
            res.status(201);
            res.success({
                message: 'Price data recorded successfully',
                commodity,
                location,
                buyPrice,
                sellPrice,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.recordPrice] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to record price data', 500);
        }
    }
    async getRouteProfitability(req, res) {
        try {
            const { id } = req.params;
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const route = await this.findTradingRouteById(id, organizationId);
            if (!route) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
            }
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            const analysis = await tradingService.analyzeRouteProfitability(id, organizationId);
            res.success(analysis);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getRouteProfitability] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to analyze route profitability', 500);
        }
    }
    async recordRouteRun(req, res) {
        try {
            const { id } = req.params;
            const { profit, duration } = req.body;
            const organizationId = req.user?.currentOrganizationId;
            if (profit === undefined || duration === undefined) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'profit and duration are required', 400);
            }
            if (!organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const route = await this.findTradingRouteById(id, organizationId);
            if (!route) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
            }
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            const previousStatus = route.status;
            const userId = req.user?.id;
            const updatedRoute = await tradingService.recordRouteRun(id, profit, duration, organizationId, userId);
            (0, tradingWebSocketController_1.emitRouteStatusChanged)(organizationId, route.id, previousStatus, updatedRoute.status, req.user?.id);
            res.success(updatedRoute);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.recordRouteRun] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to record route run', 500);
        }
    }
    async refreshRouteProfits(req, res) {
        try {
            const tradingService = (await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradingService'))))
                .tradingService;
            const result = await tradingService.refreshAllRouteProfits();
            res.success({
                updated: result.updated,
                failed: result.failed,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.refreshRouteProfits] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to refresh route profits', 500);
        }
    }
    async listPriceAlerts(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const { PriceAlertService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/PriceAlertService')));
            const alerts = await PriceAlertService.getInstance().getUserAlerts(userId);
            res.success(alerts);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.listPriceAlerts] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to list price alerts', 500);
        }
    }
    async createPriceAlert(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const { commodity, condition, threshold, location, enabled } = req.body;
            const { PriceAlertService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/PriceAlertService')));
            const alert = await PriceAlertService.getInstance().createAlert({
                userId,
                commodity,
                condition,
                threshold,
                location: location || undefined,
                enabled: enabled ?? true,
            });
            res.status(201).json({ success: true, data: alert });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.createPriceAlert] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to create price alert', 500);
        }
    }
    async updatePriceAlert(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const { id } = req.params;
            const { PriceAlertService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/PriceAlertService')));
            const service = PriceAlertService.getInstance();
            const existing = await service.getAlert(id);
            if (!existing || existing?.userId !== userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
            }
            const updated = await service.updateAlert(id, req.body);
            if (!updated) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
            }
            res.success(updated);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.updatePriceAlert] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to update price alert', 500);
        }
    }
    async deletePriceAlert(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const { id } = req.params;
            const { PriceAlertService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/PriceAlertService')));
            const service = PriceAlertService.getInstance();
            const existing = await service.getAlert(id);
            if (!existing || existing?.userId !== userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
            }
            const deleted = await service.deleteAlert(id);
            if (!deleted) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
            }
            res.success({ message: 'Price alert deleted successfully' });
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.deletePriceAlert] Error:', error);
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to delete price alert', 500);
        }
    }
    async executeTradeRun(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const organizationId = req.user?.currentOrganizationId;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const route = await this.findTradingRouteById(id, organizationId);
            if (!route) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Trading route not found', 404);
            }
            const { shipId, actualBuyPrice, actualSellPrice, quantityTraded, notes } = req.body;
            const aggregator = new TradeAggregatorService_1.TradeAggregatorService();
            const result = await aggregator.executeTradeRun({
                organizationId,
                routeId: id,
                executedById: userId,
                shipId,
                actualBuyPrice,
                actualSellPrice,
                quantityTraded,
                notes,
            });
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to execute trade run: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async createTradeOperation(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const { operationData, routeOptions, alertsConfig, supplierIds, notifyParticipants, postToDiscord, discordChannelId, } = req.body;
            const aggregator = new TradeAggregatorService_1.TradeAggregatorService();
            const result = await aggregator.createTradeOperation({
                organizationId: orgId,
                operationData: {
                    ...operationData,
                    coordinatorId: operationData.coordinatorId ?? userId,
                },
                routeOptions,
                alertsConfig,
                supplierIds,
                notifyParticipants,
                postToDiscord,
                discordChannelId,
            });
            if (!result.success) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(result.error, 'Failed to create trade operation'), 500);
            }
            res.status(201).success(result.data);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to create trade operation: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getPriceFeedStatus(_req, res) {
        try {
            const { UEXPriceFeed } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/UEXPriceFeed')));
            const feed = new UEXPriceFeed();
            const status = feed.getStatus();
            const hasUexCredential = Boolean(process.env.UEX_API_KEY?.trim() ||
                process.env.UEX_API_TOKEN?.trim() ||
                process.env.UEX_API_BEARER_TOKEN?.trim());
            const basePayload = {
                provider: status.name,
                healthy: status.healthy,
                apiUrl: process.env.UEX_API_URL ?? 'https://api.uexcorp.uk/2.0',
                apiKeyConfigured: hasUexCredential,
            };
            res.success(status.details ? { ...basePayload, ...status.details } : basePayload);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getPriceFeedStatus] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get price feed status: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getTradeReputation(req, res) {
        try {
            const { userId } = req.params;
            const { tradeReputationService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradeReputationService')));
            const reputation = await tradeReputationService.getUserReputation(userId);
            res.success(reputation.getSummary());
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getTradeReputation] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get trade reputation: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getTradeReputationLeaderboard(req, res) {
        try {
            const limit = Math.min(Number(req.query.limit) || 20, 100);
            const { tradeReputationService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradeReputationService')));
            const leaderboard = await tradeReputationService.getLeaderboard(limit);
            res.success(leaderboard);
        }
        catch (error) {
            logger_1.logger.error('[TradingControllerV2.getTradeReputationLeaderboard] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get trade reputation leaderboard: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getTradeTransactions(req, res) {
        try {
            const { orgId } = req.params;
            const userOrgId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const limit = Math.min(Number(req.query.limit) || 50, 200);
            const { tradeReputationService } = await Promise.resolve().then(() => __importStar(require('../../services/trade/trading/TradeReputationService')));
            const transactions = await tradeReputationService.getUserTransactions(userId, orgId, limit);
            res.success(transactions);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.getTradeTransactions] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get trade transactions: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async createTradeDispute(req, res) {
        try {
            const { orgId } = req.params;
            const authReq = req;
            const userOrgId = authReq.user?.currentOrganizationId;
            const userId = authReq.user?.id;
            const userName = authReq.user?.username;
            if (!userId || !userName) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const { transactionId, reason, requestedResolution, evidenceLinks, amountInDispute } = req.body;
            const transaction = await this.findTradeTransactionByOrg(transactionId, orgId);
            if (!transaction) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Trade transaction not found', 404);
            }
            const summaryLines = [
                `Trade dispute opened for transaction: ${transaction.id}`,
                `User: ${userId}`,
                `Reason: ${reason}`,
            ];
            if (requestedResolution) {
                summaryLines.push(`Requested resolution: ${requestedResolution}`);
            }
            if (typeof amountInDispute === 'number') {
                summaryLines.push(`Amount in dispute: ${amountInDispute}`);
            }
            const normalizedEvidenceLinks = Array.isArray(evidenceLinks)
                ? evidenceLinks.filter((link) => typeof link === 'string' && link.trim().length > 0)
                : [];
            if (normalizedEvidenceLinks.length > 0) {
                summaryLines.push(`Evidence: ${normalizedEvidenceLinks.join(', ')}`);
            }
            const ticket = await this.ticketService.createTicket(orgId, {
                subject: `Trade dispute ${transaction.id.slice(0, 8).toUpperCase()}`,
                description: summaryLines.join('\n'),
                category: Ticket_1.TicketCategory.SUPPORT,
                priority: Ticket_1.TicketPriority.HIGH,
                creatorId: userId,
                creatorName: userName,
                recipientType: Ticket_1.TicketRecipientType.ORG_OFFICERS,
                tags: ['trade-dispute', `trade-transaction:${transaction.id}`, 'trade-arbitration-pending'],
            });
            res.status(201).success({
                disputeId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                transactionId: transaction.id,
                status: ticket.status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.createTradeDispute] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to create trade dispute', 500);
        }
    }
    async listTradeDisputes(req, res) {
        try {
            const { orgId } = req.params;
            const authReq = req;
            const userOrgId = authReq.user?.currentOrganizationId;
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const canManageDisputes = await this.canManageTradeDisputes(authReq, orgId);
            if (!canManageDisputes) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized to view trade disputes', 403);
            }
            const limit = Math.min(Number(req.query.limit) || 20, 100);
            const offset = Math.max(Number(req.query.offset) || 0, 0);
            const disputeStatus = req.query.status;
            const transactionId = req.query.transactionId;
            const ticketRepo = database_1.AppDataSource.getRepository(Ticket_1.Ticket);
            const queryBuilder = ticketRepo
                .createQueryBuilder('ticket')
                .where('ticket.organizationId = :orgId', { orgId })
                .andWhere('ticket.category = :category', { category: Ticket_1.TicketCategory.SUPPORT })
                .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' });
            if (transactionId) {
                queryBuilder.andWhere('ticket.tags LIKE :transactionTag', {
                    transactionTag: `%trade-transaction:${transactionId}%`,
                });
            }
            if (disputeStatus === 'open') {
                queryBuilder.andWhere('ticket.status IN (:...openStatuses)', {
                    openStatuses: [
                        Ticket_1.TicketStatus.OPEN,
                        Ticket_1.TicketStatus.IN_PROGRESS,
                        Ticket_1.TicketStatus.AWAITING_RESPONSE,
                    ],
                });
            }
            else if (disputeStatus === 'closed') {
                queryBuilder.andWhere('ticket.status IN (:...closedStatuses)', {
                    closedStatuses: [Ticket_1.TicketStatus.RESOLVED, Ticket_1.TicketStatus.CLOSED],
                });
            }
            const total = await queryBuilder.getCount();
            const disputes = await queryBuilder
                .orderBy('ticket.createdAt', 'DESC')
                .skip(offset)
                .take(limit)
                .getMany();
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/trading/disputes`, offset, limit, total);
            res.paginated(disputes, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.listTradeDisputes] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to list trade disputes', 500);
        }
    }
    async resolveTradeDispute(req, res) {
        try {
            const { orgId, disputeId } = req.params;
            const authReq = req;
            const userOrgId = authReq.user?.currentOrganizationId;
            const userId = authReq.user?.id;
            const userName = authReq.user?.username;
            if (!userId || !userName) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!userOrgId || userOrgId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
            }
            const canManageDisputes = await this.canManageTradeDisputes(authReq, orgId);
            if (!canManageDisputes) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Not authorized to resolve trade disputes', 403);
            }
            const { resolution, closeTicket = true } = req.body;
            const dispute = await this.ticketService.getTicketById(disputeId);
            if (dispute?.organizationId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Trade dispute not found', 404);
            }
            if (!(dispute.tags ?? []).includes('trade-dispute')) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Ticket is not a trade dispute', 400);
            }
            const resolutionMessage = `Arbitration result by ${userName}: ${resolution}`;
            await this.ticketService.addMessage(disputeId, {
                authorId: userId,
                authorName: userName,
                content: resolutionMessage,
                isInternal: true,
            });
            const resolved = await this.ticketService.resolveTicket(disputeId, {
                resolution,
                resolvedBy: userId,
            });
            let finalTicket = resolved;
            if (closeTicket) {
                finalTicket = await this.ticketService.closeTicket(disputeId);
            }
            res.success(finalTicket);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[TradingControllerV2.resolveTradeDispute] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to resolve trade dispute', 500);
        }
    }
}
exports.TradingControllerV2 = TradingControllerV2;
//# sourceMappingURL=tradingController.js.map