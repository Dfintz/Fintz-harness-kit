"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingRouteService = exports.TradingRouteService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../../config/database");
const TradingRoute_1 = require("../../models/TradingRoute");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const tradingWebSocketController_1 = require("../../websocket/controllers/tradingWebSocketController");
const UEXPriceFeed_1 = require("./trading/UEXPriceFeed");
class TradingRouteService {
    uexPriceFeed;
    constructor(uexPriceFeed) {
        this.uexPriceFeed = uexPriceFeed;
    }
    async findById(routeId, organizationId) {
        const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        const qb = routeRepo.createQueryBuilder('route').where('route.id = :routeId', { routeId });
        if (organizationId) {
            qb.andWhere('route.organizationId = :organizationId', { organizationId });
        }
        return qb.getOne();
    }
    async listOrgRoutes(orgId, params) {
        const { limit, offset, sort, filters, search } = params;
        const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        const qb = routeRepo
            .createQueryBuilder('route')
            .where('route.organizationId = :orgId', { orgId });
        if (filters.status) {
            qb.andWhere('route.status = :status', { status: filters.status });
        }
        if (search) {
            qb.andWhere('(route.name ILIKE :search OR route.description ILIKE :search)', {
                search: `%${search}%`,
            });
        }
        if (sort) {
            qb.orderBy(`route.${sort.field}`, sort.order);
        }
        else {
            qb.orderBy('route.createdAt', 'DESC');
        }
        const total = await qb.getCount();
        const routes = await qb.skip(offset).take(limit).getMany();
        return { routes, total };
    }
    async createRoute(orgId, userId, data) {
        const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        const existing = await routeRepo
            .createQueryBuilder('route')
            .where('route.organizationId = :orgId', { orgId })
            .andWhere('route.name = :name', { name: data.name })
            .getOne();
        if (existing) {
            throw new apiErrors_1.ConflictError('A trading route with this name already exists');
        }
        const normalizedStops = Array.isArray(data.stops) ? data.stops : [];
        let estimatedProfit = data.estimatedProfit;
        if (!estimatedProfit && normalizedStops.length > 0) {
            try {
                estimatedProfit = await this.uexPriceFeed.calculateRouteProfit(normalizedStops);
            }
            catch (err) {
                logger_1.logger.warn('[TradingRouteService.createRoute] UEX profit calculation failed:', err);
            }
        }
        const normalizedTags = Array.isArray(data.tags)
            ? data.tags.filter((tag) => typeof tag === 'string')
            : [];
        const route = routeRepo.create({
            id: `route_${Date.now()}_${node_crypto_1.default.randomUUID().substring(0, 9)}`,
            creatorId: userId,
            organizationId: orgId,
            name: data.name,
            description: data.description ?? '',
            stops: normalizedStops,
            estimatedProfit,
            estimatedDuration: data.estimatedDuration,
            minCargoCapacity: data.minCargoCapacity,
            status: TradingRoute_1.RouteStatus.ACTIVE,
            tags: normalizedTags,
            notes: data.notes,
            performance: { runCount: 0, avgProfit: 0, avgDuration: 0 },
        });
        await routeRepo.save(route);
        (0, tradingWebSocketController_1.emitRouteCreated)(orgId, route);
        return route;
    }
    async updateRoute(routeId, orgId, updates) {
        const route = await this.findById(routeId);
        if (!route || route.organizationId !== orgId) {
            throw new apiErrors_1.NotFoundError('Trading route not found');
        }
        const oldStatus = route.status;
        const statusChanged = updates.status !== undefined && updates.status !== oldStatus;
        this.applyRouteUpdates(route, updates);
        const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        await routeRepo.save(route);
        (0, tradingWebSocketController_1.emitRouteUpdated)(route.organizationId ?? '', route);
        if (statusChanged) {
            (0, tradingWebSocketController_1.emitRouteStatusChanged)(route.organizationId ?? '', routeId, oldStatus, route.status);
        }
        return { route, statusChanged, oldStatus };
    }
    async deleteRoute(routeId, orgId) {
        const route = await this.findById(routeId);
        if (!route || route.organizationId !== orgId) {
            throw new apiErrors_1.NotFoundError('Trading route not found');
        }
        const resolvedOrgId = route.organizationId ?? '';
        const routeRepo = database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        await routeRepo.remove(route);
        (0, tradingWebSocketController_1.emitRouteDeleted)(resolvedOrgId, routeId);
    }
    calculateRouteRating(route) {
        let rating = 0;
        const profitScore = Math.min((route.estimatedProfit ?? 0) / 20000, 5);
        rating += profitScore;
        if (route.performance) {
            const performanceScore = Math.min(route.performance.runCount / 10, 3);
            rating += performanceScore;
        }
        if (route.estimatedDuration) {
            const durationScore = Math.max(2 - route.estimatedDuration / 120, 0);
            rating += durationScore;
        }
        return Math.min(Math.round(rating * 10) / 10, 10);
    }
    applyRouteUpdates(route, updates) {
        if (updates.name !== undefined) {
            route.name = updates.name;
        }
        if (updates.description !== undefined) {
            route.description = updates.description;
        }
        if (updates.stops !== undefined) {
            route.stops = updates.stops;
        }
        if (updates.estimatedProfit !== undefined) {
            route.estimatedProfit = updates.estimatedProfit;
        }
        if (updates.estimatedDuration !== undefined) {
            route.estimatedDuration = updates.estimatedDuration;
        }
        if (updates.minCargoCapacity !== undefined) {
            route.minCargoCapacity = updates.minCargoCapacity;
        }
        if (updates.status !== undefined) {
            route.status = updates.status;
        }
        if (updates.tags !== undefined) {
            route.tags = updates.tags;
        }
        if (updates.notes !== undefined) {
            route.notes = updates.notes;
        }
    }
}
exports.TradingRouteService = TradingRouteService;
exports.tradingRouteService = new TradingRouteService(new UEXPriceFeed_1.UEXPriceFeed());
//# sourceMappingURL=TradingRouteService.js.map