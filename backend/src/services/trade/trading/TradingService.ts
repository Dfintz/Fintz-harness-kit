import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../../data-source';
import { TradeTransactionStatus } from '../../../models/TradeTransaction';
import {
  RouteStatus,
  RouteVisibility,
  TradeStop,
  TradingRoute,
} from '../../../models/TradingRoute';
import { logger } from '../../../utils/logger';
import { PaginatedResponse } from '../../../utils/pagination';
import {
  emitRouteCreated,
  emitRouteDeleted,
  emitRouteStatusChanged,
  emitRouteUpdated,
} from '../../../websocket/controllers/tradingWebSocketController';
import { NotificationService } from '../../communication/notifications/NotificationService';

import { uifService } from './UIFService';

/**
 * Trading Service with UIF Integration and Multi-Tenancy Support
 *
 * UPDATED: Added multi-tenant support (organization-scoped routes)
 * - Routes can be scoped to organizations
 * - Route sharing between organizations
 * - Historical price charting data
 *
 * Handles trading routes, price analysis, and profit optimization
 */

export interface CreateTradingRouteDto {
  name: string;
  description: string;
  creatorId: string;
  organizationId: string; // Required for multi-tenancy
  visibility?: RouteVisibility; // Added for route sharing
  stops: TradeStop[];
  estimatedProfit?: number;
  estimatedDuration?: number;
  minCargoCapacity?: number;
  tags?: string[];
  notes?: string;
}

/**
 * Route share record
 */
export interface RouteShare {
  routeId: string;
  sharedWithOrganizationId: string;
  sharedByUserId: string;
  sharedAt: Date;
  permissions: 'view' | 'use' | 'edit';
}

/**
 * Historical price data point
 */
export interface PriceHistoryPoint {
  timestamp: Date;
  commodity: string;
  location: string;
  buyPrice: number;
  sellPrice: number;
}

/**
 * Trend direction for price/profit analysis.
 */
export type TradeTrend = 'up' | 'down' | 'stable';

/**
 * Price chart data for visualization
 */
export interface PriceChartData {
  commodity: string;
  history: Array<{
    date: string;
    buyPrice: number;
    sellPrice: number;
    profitMargin: number;
  }>;
  trend: TradeTrend;
  volatility: number;
}

export interface UpdateTradingRouteDto {
  name?: string;
  description?: string;
  stops?: TradeStop[];
  estimatedProfit?: number;
  estimatedDuration?: number;
  minCargoCapacity?: number;
  status?: RouteStatus;
  tags?: string[];
  notes?: string;
}

export interface TradeOpportunity {
  commodity: string;
  buyLocation: string;
  sellLocation: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitMargin: number;
  distance?: number;
  estimatedTime?: number;
}

export interface RouteOptimizationOptions {
  startLocation: string;
  cargoCapacity: number;
  maxStops?: number;
  minProfitMargin?: number;
  avoidLocations?: string[];
  preferredCommodities?: string[];
}

export class TradingService {
  private readonly routeRepository = AppDataSource.getRepository(TradingRoute);
  private readonly routeShares: Map<string, RouteShare[]> = new Map();
  // Reverse index: orgId → Set<routeId> for O(1) lookup in getSharedRouteIds
  private readonly sharedRoutesByOrg: Map<string, Set<string>> = new Map();
  private readonly priceHistory: Map<string, PriceHistoryPoint[]> = new Map();
  private readonly notificationService = new NotificationService();

  private async findRouteById(id: string, organizationId?: string): Promise<TradingRoute | null> {
    const queryBuilder = this.routeRepository.createQueryBuilder('route').where('route.id = :id', {
      id,
    });

    if (organizationId) {
      queryBuilder.andWhere('route.organizationId = :organizationId', { organizationId });
    }

    return queryBuilder.getOne();
  }

  /**
   * Create a new trading route with organization support
   */
  public async createRoute(dto: CreateTradingRouteDto): Promise<TradingRoute> {
    try {
      const route = this.routeRepository.create({
        id: uuidv4(),
        ...dto,
        organizationId: dto.organizationId,
        visibility: dto.visibility || RouteVisibility.ORGANIZATION,
        status: RouteStatus.ACTIVE,
        performance: {
          runCount: 0,
          avgProfit: 0,
          avgDuration: 0,
        },
      });

      // Calculate estimated profit from UIF data if not provided
      if (!route.estimatedProfit) {
        route.estimatedProfit = await this.calculateRouteProfit(route.stops);
      }

      const savedRoute = await this.routeRepository.save(route);
      logger.info(`Created trading route: ${savedRoute.id} - ${savedRoute.name}`, {
        organizationId: dto.organizationId,
        creatorId: dto.creatorId,
      });

      // Emit real-time WebSocket event to the organization
      if (dto.organizationId) {
        emitRouteCreated(
          dto.organizationId,
          { id: savedRoute.id, name: savedRoute.name, status: savedRoute.status },
          dto.creatorId
        );
      }

      // Persist in-app notification for the route creator
      await this.notificationService.create({
        userId: dto.creatorId,
        type: 'trade_operation_created',
        title: 'Trade Route Created',
        message: `Trading route "${savedRoute.name}" has been created`,
        data: { routeId: savedRoute.id, organizationId: dto.organizationId },
      });

      return savedRoute;
    } catch (error: unknown) {
      logger.error('Error creating trading route:', error);
      throw error;
    }
  }

  /**
   * Get all trading routes with multi-tenant filtering
   * organizationId is required to enforce tenant isolation
   */
  public async getRoutes(filters: {
    creatorId?: string;
    organizationId: string;
    status?: RouteStatus;
    visibility?: RouteVisibility;
    tags?: string[];
    includeShared?: boolean;
  }): Promise<TradingRoute[]> {
    try {
      if (!filters.organizationId) {
        throw new Error('organizationId is required for tenant isolation');
      }

      const queryBuilder = this.routeRepository.createQueryBuilder('route');

      // Multi-tenant filtering — always applied
      if (filters.includeShared) {
        // Include routes shared with this organization
        const sharedRouteIds = this.getSharedRouteIds(filters.organizationId);
        if (sharedRouteIds.length > 0) {
          queryBuilder.andWhere(
            '(route.organizationId = :orgId OR route.id IN (:...sharedIds) OR route.visibility = :public)',
            {
              orgId: filters.organizationId,
              sharedIds: sharedRouteIds,
              public: RouteVisibility.PUBLIC,
            }
          );
        } else {
          queryBuilder.andWhere('(route.organizationId = :orgId OR route.visibility = :public)', {
            orgId: filters.organizationId,
            public: RouteVisibility.PUBLIC,
          });
        }
      } else {
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

      // Safety limit — return hasMore flag so callers know results were clipped
      const MAX_ROUTES = 200;
      queryBuilder.take(MAX_ROUTES + 1);

      const results = await queryBuilder.getMany();
      const hasMore = results.length > MAX_ROUTES;
      const routes = hasMore ? results.slice(0, MAX_ROUTES) : results;

      // Attach hasMore as a non-enumerable property for backward compatibility
      Object.defineProperty(routes, 'hasMore', { value: hasMore, enumerable: false });
      return routes;
    } catch (error: unknown) {
      logger.error('Error getting trading routes:', error);
      throw error;
    }
  }

  /**
   * Get organization routes with pagination
   */
  public async getOrganizationRoutes(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      status?: RouteStatus;
      includeShared?: boolean;
    } = {}
  ): Promise<PaginatedResponse<TradingRoute>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.routeRepository.createQueryBuilder('route');

    if (options.includeShared) {
      const sharedRouteIds = this.getSharedRouteIds(organizationId);
      if (sharedRouteIds.length > 0) {
        queryBuilder.where(
          '(route.organizationId = :orgId OR route.id IN (:...sharedIds) OR route.visibility = :public)',
          { orgId: organizationId, sharedIds: sharedRouteIds, public: RouteVisibility.PUBLIC }
        );
      } else {
        queryBuilder.where('(route.organizationId = :orgId OR route.visibility = :public)', {
          orgId: organizationId,
          public: RouteVisibility.PUBLIC,
        });
      }
    } else {
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

  // ==================== ROUTE SHARING ====================

  /**
   * Share a route with another organization
   */
  public async shareRoute(
    routeId: string,
    targetOrganizationId: string,
    sharedByUserId: string,
    ownerOrganizationId: string,
    permissions: 'view' | 'use' | 'edit' = 'view'
  ): Promise<RouteShare> {
    // Verify caller's org owns the route (tenant isolation)
    const route = await this.findRouteById(routeId, ownerOrganizationId);
    if (!route) {
      throw new Error(`Trading route ${routeId} not found`);
    }

    const share: RouteShare = {
      routeId,
      sharedWithOrganizationId: targetOrganizationId,
      sharedByUserId,
      sharedAt: new Date(),
      permissions,
    };

    const shares = this.routeShares.get(routeId) || [];
    // Check if already shared
    const existingIndex = shares.findIndex(
      s => s.sharedWithOrganizationId === targetOrganizationId
    );
    if (existingIndex >= 0) {
      shares[existingIndex] = share;
    } else {
      shares.push(share);
    }
    this.routeShares.set(routeId, shares);

    // Maintain reverse index
    if (!this.sharedRoutesByOrg.has(targetOrganizationId)) {
      this.sharedRoutesByOrg.set(targetOrganizationId, new Set());
    }
    this.sharedRoutesByOrg.get(targetOrganizationId)!.add(routeId);

    logger.info(`Shared route ${routeId} with organization ${targetOrganizationId}`, {
      sharedBy: sharedByUserId,
      permissions,
    });

    return share;
  }

  /**
   * Revoke route sharing
   */
  public async revokeRouteShare(routeId: string, targetOrganizationId: string): Promise<boolean> {
    const shares = this.routeShares.get(routeId);
    if (!shares) {
      return false;
    }

    const newShares = shares.filter(s => s.sharedWithOrganizationId !== targetOrganizationId);

    if (newShares.length < shares.length) {
      this.routeShares.set(routeId, newShares);

      // Maintain reverse index
      const orgRoutes = this.sharedRoutesByOrg.get(targetOrganizationId);
      if (orgRoutes) {
        orgRoutes.delete(routeId);
        if (orgRoutes.size === 0) {
          this.sharedRoutesByOrg.delete(targetOrganizationId);
        }
      }

      logger.info(`Revoked route sharing for ${routeId} from organization ${targetOrganizationId}`);
      return true;
    }

    return false;
  }

  /**
   * Get organizations a route is shared with
   */
  public async getRouteShares(routeId: string): Promise<RouteShare[]> {
    return this.routeShares.get(routeId) || [];
  }

  /**
   * Get IDs of routes shared with an organization
   */
  private getSharedRouteIds(organizationId: string): string[] {
    // O(1) lookup via reverse index instead of scanning all routeShares
    const routeSet = this.sharedRoutesByOrg.get(organizationId);
    return routeSet ? [...routeSet] : [];
  }

  // ==================== HISTORICAL PRICE CHARTING ====================

  /**
   * Record price data for historical tracking
   */
  public async recordPriceData(
    commodity: string,
    location: string,
    buyPrice: number,
    sellPrice: number
  ): Promise<void> {
    const key = `${commodity}:${location}`;
    const history = this.priceHistory.get(key) || [];

    history.push({
      timestamp: new Date(),
      commodity,
      location,
      buyPrice,
      sellPrice,
    });

    // Keep last 90 days of data
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const filtered = history.filter(h => h.timestamp >= cutoff);

    this.priceHistory.set(key, filtered);
  }

  /**
   * Get price chart data for a commodity
   */
  public async getPriceChartData(
    commodity: string,
    location?: string,
    days: number = 30
  ): Promise<PriceChartData> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Find all history for this commodity
    const allHistory: PriceHistoryPoint[] = [];
    this.priceHistory.forEach((points, key) => {
      if (key.startsWith(`${commodity}:`)) {
        if (!location || key.endsWith(`:${location}`)) {
          allHistory.push(...points.filter(p => p.timestamp >= cutoff));
        }
      }
    });

    // Group by date and calculate averages
    const dailyData: Record<string, { buyPrices: number[]; sellPrices: number[] }> = {};
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

    // Calculate trend
    let trend: TradeTrend = 'stable';
    if (history.length >= 2) {
      const firstProfit = history[0].profitMargin;
      const lastProfit = history.at(-1)?.profitMargin ?? 0;
      const change = lastProfit - firstProfit;
      if (change > 5) {
        trend = 'up';
      } else if (change < -5) {
        trend = 'down';
      }
    }

    // Calculate volatility (standard deviation of profit margins)
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

  /**
   * Get price trends for multiple commodities
   */
  public async getMarketTrends(
    commodities: string[],
    days: number = 7
  ): Promise<
    Array<{
      commodity: string;
      currentPrice: number;
      priceChange: number;
      trend: TradeTrend;
    }>
  > {
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

  /**
   * Get route by ID with required tenant scoping
   */
  public async getRouteById(id: string, organizationId: string): Promise<TradingRoute | null> {
    try {
      return await this.findRouteById(id, organizationId);
    } catch (error: unknown) {
      logger.error(`Error getting route ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update trading route with tenant scoping
   */
  public async updateRoute(
    id: string,
    dto: UpdateTradingRouteDto,
    organizationId: string
  ): Promise<TradingRoute> {
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

      // Recalculate profit if stops changed
      if (dto.stops) {
        route.estimatedProfit = await this.calculateRouteProfit(dto.stops);
      }

      const updatedRoute = await this.routeRepository.save(route);
      logger.info(`Updated trading route: ${id}`);

      // Emit real-time WebSocket event
      if (updatedRoute.organizationId) {
        // If status changed, emit the more specific status_changed event
        if (dto.status && dto.status !== previousStatus) {
          emitRouteStatusChanged(
            updatedRoute.organizationId,
            updatedRoute.id,
            previousStatus,
            updatedRoute.status
          );
        } else {
          emitRouteUpdated(updatedRoute.organizationId, {
            id: updatedRoute.id,
            name: updatedRoute.name,
            status: updatedRoute.status,
          });
        }
      }

      return updatedRoute;
    } catch (error: unknown) {
      logger.error(`Error updating route ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete trading route with tenant scoping
   */
  public async deleteRoute(id: string, organizationId: string): Promise<void> {
    try {
      if (!organizationId) {
        throw new Error('organizationId is required for tenant isolation');
      }
      const route = await this.findRouteById(id, organizationId);

      const result = await this.routeRepository.delete({ id, organizationId });

      if (result.affected === 0) {
        throw new Error(`Trading route ${id} not found`);
      }

      logger.info(`Deleted trading route: ${id}`);

      // Emit real-time WebSocket event
      const orgId = route?.organizationId ?? organizationId;
      if (orgId) {
        emitRouteDeleted(orgId, id);
      }
    } catch (error: unknown) {
      logger.error(`Error deleting route ${id}:`, error);
      throw error;
    }
  }

  /**
   * Record a completed route run
   */
  public async recordRouteRun(
    id: string,
    profit: number,
    duration: number,
    organizationId: string,
    userId?: string,
    options?: {
      fleetId?: string;
      estimatedProfit?: number;
      successStatus?: TradeTransactionStatus;
    }
  ): Promise<TradingRoute> {
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

      // Update rolling averages
      const totalRuns = performance.runCount + 1;
      performance.avgProfit = (performance.avgProfit * performance.runCount + profit) / totalRuns;
      performance.avgDuration =
        (performance.avgDuration * performance.runCount + duration) / totalRuns;
      performance.runCount = totalRuns;
      performance.lastRun = new Date();

      route.performance = performance;

      const updatedRoute = await this.routeRepository.save(route);
      logger.info(`Recorded route run for ${id}: profit=${profit}, duration=${duration}min`);

      // Record per-user trade transaction for reputation tracking (Sprint 20-D)
      if (userId) {
        const { tradeReputationService } = await import('./TradeReputationService');
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
            logger.error(`Failed to record trade transaction for route ${id}:`, err);
          });
      }

      return updatedRoute;
    } catch (error: unknown) {
      logger.error(`Error recording route run for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find best trade opportunities using UIF
   */
  public async findTradeOpportunities(
    startLocation: string,
    minProfitMargin: number = 10,
    limit: number = 10
  ): Promise<TradeOpportunity[]> {
    try {
      logger.info(
        `Finding trade opportunities from ${startLocation} with min ${minProfitMargin}% margin`
      );

      // Get items available at start location
      const itemsAtLocation = await uifService.getItemsAtLocation(startLocation);
      const opportunities: TradeOpportunity[] = [];

      for (const item of itemsAtLocation) {
        const comparison = await uifService.comparePrices(item.name);

        if (
          comparison?.profitMargin &&
          comparison.profitMargin >= minProfitMargin &&
          comparison.bestBuyLocation &&
          comparison.bestSellLocation
        ) {
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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Sort by profit margin and limit results
      const sorted = [...opportunities].sort((a, b) => b.profitMargin - a.profitMargin);
      return sorted.slice(0, limit);
    } catch (error: unknown) {
      logger.error('Error finding trade opportunities:', error);
      return [];
    }
  }

  /**
   * Optimize a trading route based on cargo capacity and current market prices
   */
  /**
   * Check if an opportunity should be skipped based on route options
   */
  private shouldSkipOpportunity(opp: TradeOpportunity, options: RouteOptimizationOptions): boolean {
    if (
      options.avoidLocations?.includes(opp.buyLocation) ||
      options.avoidLocations?.includes(opp.sellLocation)
    ) {
      return true;
    }

    if (
      options.preferredCommodities &&
      options.preferredCommodities.length > 0 &&
      !options.preferredCommodities.includes(opp.commodity)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Add or merge a commodity into a stop's goods list
   */
  private addCommodityToStop(
    stops: TradeStop[],
    visitedLocations: Set<string>,
    location: string,
    commodity: string,
    type: 'buy' | 'sell',
    stopOrder: number
  ): number {
    if (visitedLocations.has(location)) {
      const existingStop = stops.find(s => s.location === location);
      const goodsList = type === 'buy' ? existingStop?.buyGoods : existingStop?.sellGoods;
      if (existingStop && !goodsList?.includes(commodity)) {
        if (type === 'buy') {
          existingStop.buyGoods = [...(existingStop.buyGoods || []), commodity];
        } else {
          existingStop.sellGoods = [...(existingStop.sellGoods || []), commodity];
        }
      }
      return stopOrder;
    }

    const newStop: TradeStop = {
      location,
      order: stopOrder,
      ...(type === 'buy' ? { buyGoods: [commodity] } : { sellGoods: [commodity] }),
    };
    stops.push(newStop);
    visitedLocations.add(location);
    return stopOrder + 1;
  }

  /**
   * Optimize a trading route based on cargo capacity and current market prices
   */
  public async optimizeRoute(options: RouteOptimizationOptions): Promise<TradeStop[]> {
    try {
      const opportunities = await this.findTradeOpportunities(
        options.startLocation,
        options.minProfitMargin || 10,
        options.maxStops || 5
      );

      if (opportunities.length === 0) {
        logger.warn(`No profitable opportunities found from ${options.startLocation}`);
        return [];
      }

      const stops: TradeStop[] = [];
      const visitedLocations = new Set<string>([options.startLocation]);

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

        stopOrder = this.addCommodityToStop(
          stops,
          visitedLocations,
          opp.buyLocation,
          opp.commodity,
          'buy',
          stopOrder
        );
        stopOrder = this.addCommodityToStop(
          stops,
          visitedLocations,
          opp.sellLocation,
          opp.commodity,
          'sell',
          stopOrder
        );

        if (stops.length >= (options.maxStops || 5)) {
          break;
        }
      }

      logger.info(`Optimized route with ${stops.length} stops`);
      return stops;
    } catch (error: unknown) {
      logger.error('Error optimizing route:', error);
      throw error;
    }
  }

  /**
   * Process goods at a stop and update the transactions map
   */
  private async processStopGoods(
    goods: string[] | undefined,
    location: string,
    type: 'buy' | 'sell',
    transactions: Map<string, { buy?: number; sell?: number }>
  ): Promise<void> {
    if (!goods) {
      return;
    }

    for (const good of goods) {
      const prices = await uifService.getItemPrices(good);
      const matchedPrice = prices.find(
        p => p.location.toLowerCase().includes(location.toLowerCase()) && p.type === type
      );

      if (matchedPrice?.price) {
        const existing = transactions.get(good) || {};
        existing[type] = matchedPrice.price;
        transactions.set(good, existing);
      }
    }
  }

  /**
   * Calculate estimated profit for a route
   */
  private async calculateRouteProfit(stops: TradeStop[]): Promise<number> {
    try {
      const transactions: Map<string, { buy?: number; sell?: number }> = new Map();

      for (const stop of stops) {
        await this.processStopGoods(stop.buyGoods, stop.location, 'buy', transactions);
        await this.processStopGoods(stop.sellGoods, stop.location, 'sell', transactions);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let totalProfit = 0;
      transactions.forEach(prices => {
        if (prices.buy && prices.sell) {
          totalProfit += prices.sell - prices.buy;
        }
      });

      return totalProfit;
    } catch (error: unknown) {
      logger.error('Error calculating route profit:', error);
      return 0;
    }
  }

  /**
   * Get route profitability analysis
   */
  public async analyzeRouteProfitability(
    id: string,
    organizationId?: string
  ): Promise<Record<string, unknown>> {
    try {
      const route = await this.findRouteById(id, organizationId);

      if (!route) {
        throw new Error(`Trading route ${id} not found`);
      }

      const currentProfit = await this.calculateRouteProfit(route.stops);
      const commodities: string[] = [];

      // Extract all commodities from route
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
        const comparison = await uifService.comparePrices(commodity);
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
    } catch (error: unknown) {
      logger.error(`Error analyzing route profitability for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update all route profits from current market data
   */
  public async refreshAllRouteProfits(): Promise<{ updated: number; failed: number }> {
    try {
      const routes = await this.routeRepository.find({
        where: { status: RouteStatus.ACTIVE },
      });

      let updated = 0;
      let failed = 0;

      for (const route of routes) {
        try {
          const newProfit = await this.calculateRouteProfit(route.stops);
          route.estimatedProfit = newProfit;
          await this.routeRepository.save(route);
          updated++;
        } catch (error: unknown) {
          logger.error(`Failed to update profit for route ${route.id}:`, error);
          failed++;
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info(`Route profit refresh complete: ${updated} updated, ${failed} failed`);
      return { updated, failed };
    } catch (error: unknown) {
      logger.error('Error refreshing route profits:', error);
      throw error;
    }
  }
}

export const tradingService = new TradingService();

