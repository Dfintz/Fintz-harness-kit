/**
 * Trading Controller V2
 * Handles trading route and market analysis endpoints with standardized responses
 * Updated for API v2 with enhanced query parameter support
 */

import crypto from 'node:crypto';

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks, selectFieldsFromArray } from '../../middleware/queryParser';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketRecipientType,
  TicketStatus,
} from '../../models/Ticket';
import { TradeTransaction } from '../../models/TradeTransaction';
import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { TradeAggregatorService } from '../../services/aggregators/TradeAggregatorService';
import { TicketService } from '../../services/communication/tickets/TicketService';
import { UEXPriceFeed } from '../../services/trade/trading/UEXPriceFeed';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import {
  emitRouteCreated,
  emitRouteDeleted,
  emitRouteStatusChanged,
  emitRouteUpdated,
} from '../../websocket/controllers/tradingWebSocketController';

export class TradingControllerV2 {
  private readonly uexPriceFeed = new UEXPriceFeed();
  private readonly ticketService = TicketService.getInstance();

  private async findTradingRouteById(
    routeId: string,
    organizationId?: string
  ): Promise<TradingRoute | null> {
    const routeRepo = AppDataSource.getRepository(TradingRoute);
    const queryBuilder = routeRepo
      .createQueryBuilder('route')
      .where('route.id = :routeId', { routeId });

    if (organizationId) {
      queryBuilder.andWhere('route.organizationId = :organizationId', { organizationId });
    }

    return queryBuilder.getOne();
  }

  private async findOrganizationMembership(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMembership | null> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    return membershipRepo
      .createQueryBuilder('membership')
      .where('membership.organizationId = :organizationId', { organizationId })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getOne();
  }

  private async findTradeTransactionByOrg(
    transactionId: string,
    organizationId: string
  ): Promise<TradeTransaction | null> {
    const transactionRepo = AppDataSource.getRepository(TradeTransaction);
    return transactionRepo
      .createQueryBuilder('transaction')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.organizationId = :organizationId', { organizationId })
      .getOne();
  }

  private async canManageTradeDisputes(authReq: AuthRequest, orgId: string): Promise<boolean> {
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

    const orgRole = getRoleName(membership?.role);
    return ['owner', 'founder', 'admin', 'senior_officer', 'officer'].includes(orgRole);
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/routes
   * List all trading routes for an organization
   */
  async listOrgRoutes(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      // Verify user belongs to the requested organization
      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const { limit, offset, sort, filters, search, fields } = req.queryParams || {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        search: null,
        fields: null,
      };

      const routeRepo = AppDataSource.getRepository(TradingRoute);
      const queryBuilder = routeRepo
        .createQueryBuilder('route')
        .where('route.organizationId = :orgId', { orgId });

      // Add status filter
      if (filters.status) {
        queryBuilder.andWhere('route.status = :status', { status: filters.status });
      }

      // Add search filter
      if (search) {
        queryBuilder.andWhere('(route.name ILIKE :search OR route.description ILIKE :search)', {
          search: `%${search}%`,
        });
      }

      // Apply sorting
      if (sort) {
        queryBuilder.orderBy(`route.${sort.field}`, sort.order);
      } else {
        queryBuilder.orderBy('route.createdAt', 'DESC');
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get paginated results
      const routes = await queryBuilder.skip(offset).take(limit).getMany();

      // Apply field selection
      const filteredRoutes = selectFieldsFromArray(routes, fields);

      // Build HATEOAS links
      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/trading/routes`,
        offset,
        limit,
        total
      );

      res.paginated(
        filteredRoutes,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      logger.error('[TradingControllerV2.listOrgRoutes] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading routes', 500);
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/trading/routes
   * Create a new trading route
   */
  async createRoute(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;
      const routeData = req.body as {
        name: string;
        description?: string;
        stops?: unknown;
        estimatedProfit?: number;
        estimatedDuration?: number;
        minCargoCapacity?: number;
        tags?: unknown;
        notes?: string;
      };

      // Verify user belongs to the requested organization
      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const routeRepo = AppDataSource.getRepository(TradingRoute);

      // Check for duplicate route names within organization
      const existing = await routeRepo
        .createQueryBuilder('route')
        .where('route.organizationId = :orgId', { orgId })
        .andWhere('route.name = :name', { name: routeData.name })
        .getOne();

      if (existing) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_CONFLICT,
          'A trading route with this name already exists',
          409
        );
      }

      // Create new route
      const userId = (req as AuthRequest).user?.id ?? '';

      // Auto-calculate profit from UEX data if not provided
      let estimatedProfit = routeData.estimatedProfit;
      const normalizedStops = Array.isArray(routeData.stops) ? routeData.stops : [];
      if (!estimatedProfit && normalizedStops.length > 0) {
        estimatedProfit = await this.uexPriceFeed.calculateRouteProfit(normalizedStops);
      }

      const normalizedTags = Array.isArray(routeData.tags)
        ? routeData.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];

      const newRoute = routeRepo.create({
        id: `route_${Date.now()}_${crypto.randomUUID().substring(0, 9)}`,
        creatorId: userId,
        organizationId: orgId,
        name: routeData.name,
        description: routeData.description || '',
        stops: normalizedStops,
        estimatedProfit,
        estimatedDuration: routeData.estimatedDuration,
        minCargoCapacity: routeData.minCargoCapacity,
        status: RouteStatus.ACTIVE,
        tags: normalizedTags,
        notes: routeData.notes,
        performance: {
          runCount: 0,
          avgProfit: 0,
          avgDuration: 0,
        },
      });

      await routeRepo.save(newRoute);

      // Emit WebSocket event
      emitRouteCreated(orgId, newRoute as unknown as Parameters<typeof emitRouteCreated>[1]);

      res.success(newRoute);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.createRoute] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to create trading route', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/uex-routes
   * Get suggested trade routes from UEX Corp price data
   */
  async getUexRoutes(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const rawLimit = Number(req.query.limit);
      const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 25, 100);
      const rawMargin = Number(req.query.minMargin);
      const minMargin =
        req.query.minMargin !== undefined && Number.isFinite(rawMargin) ? rawMargin : 5;

      const filters = {
        commodity: req.query.commodity as string | undefined,
        starSystemStart: req.query.starSystemStart as string | undefined,
        starSystemEnd: req.query.starSystemEnd as string | undefined,
        terminalStart: req.query.terminalStart as string | undefined,
        terminalEnd: req.query.terminalEnd as string | undefined,
        investment: req.query.investment ? Number(req.query.investment) : undefined,
        scu: req.query.scu ? Number(req.query.scu) : undefined,
      };

      const routes = await this.uexPriceFeed.getTopTradeRoutes(limit, minMargin, filters);

      res.success({
        routes,
        total: routes.length,
        source: 'UEX Corp',
        disclaimer:
          'Data is community-reported and may not reflect live server prices. Prices are per SCU and limited to reports from the last 3 days.',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.getUexRoutes] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX trade routes', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/uex-terminals
   * Get UEX terminal list for dropdown population
   */
  async getUexTerminals(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const terminals = await this.uexPriceFeed.getTerminalsList();
      res.success(terminals);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.getUexTerminals] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX terminals', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/uex-commodities
   * Get UEX commodity list for dropdown population
   */
  async getUexCommodities(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const commodities = await this.uexPriceFeed.getCommoditiesList();
      res.success(commodities);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.getUexCommodities] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch UEX commodities', 500);
    }
  }

  /**
   * GET /api/v2/trading/routes/:id
   * Get a specific trading route by ID
   */
  async getRouteById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      const route = await this.findTradingRouteById(id);

      if (!route) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      // Verify ownership — user must belong to the org that owns the route
      if (!userOrgId || route.organizationId !== userOrgId) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      res.success(route);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.getRouteById] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading route', 500);
    }
  }

  /**
   * PUT /api/v2/trading/routes/:id
   * Update a trading route
   */
  async updateRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      const route = await this.findTradingRouteById(id);

      if (!route) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      // Verify ownership
      if (!userOrgId || route.organizationId !== userOrgId) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      // Track if status changed
      const oldStatus = route.status;
      const statusChanged = updates.status !== undefined && updates.status !== oldStatus;
      const routeRepo = AppDataSource.getRepository(TradingRoute);

      this.applyRouteUpdates(route, updates);

      await routeRepo.save(route);

      // Emit WebSocket events
      emitRouteUpdated(
        route.organizationId || '',
        route as unknown as Parameters<typeof emitRouteUpdated>[1]
      );
      if (statusChanged) {
        emitRouteStatusChanged(route.organizationId || '', id, oldStatus, route.status);
      }

      res.success(route);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.updateRoute] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to update trading route', 500);
    }
  }

  private applyRouteUpdates(route: TradingRoute, updates: Partial<TradingRoute>): void {
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

  /**
   * DELETE /api/v2/trading/routes/:id
   * Delete a trading route
   */
  async deleteRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      const route = await this.findTradingRouteById(id);

      if (!route) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      // Verify ownership
      if (!userOrgId || route.organizationId !== userOrgId) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      const orgId = route.organizationId || '';
      const routeRepo = AppDataSource.getRepository(TradingRoute);
      await routeRepo.remove(route);

      // Emit WebSocket event
      emitRouteDeleted(orgId, id);

      res.success({ message: 'Trading route deleted successfully' });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.deleteRoute] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to delete trading route', 500);
    }
  }

  /**
   * GET /api/v2/trading/opportunities
   * Get trading opportunities based on market data
   */
  async getOpportunities(req: Request, res: Response): Promise<void> {
    try {
      const minProfit = Number.parseInt(req.query.minProfit as string, 10) || 0;
      const maxDistance = Number.parseInt(req.query.maxDistance as string, 10) || 1000;
      const cargoCapacity = Number.parseInt(req.query.cargoCapacity as string, 10) || 0;
      const limit = Number.parseInt(req.query.limit as string, 10) || 20;

      const routeRepo = AppDataSource.getRepository(TradingRoute);
      const queryBuilder = routeRepo
        .createQueryBuilder('route')
        .where('route.status = :status', { status: RouteStatus.ACTIVE });

      // Filter by minimum profit
      if (minProfit > 0) {
        queryBuilder.andWhere('route.estimatedProfit >= :minProfit', { minProfit });
      }

      // Filter by cargo capacity
      if (cargoCapacity) {
        queryBuilder.andWhere(
          '(route.minCargoCapacity IS NULL OR route.minCargoCapacity <= :cargoCapacity)',
          {
            cargoCapacity,
          }
        );
      }

      // Get opportunities sorted by profit
      const opportunities = await queryBuilder
        .orderBy('route.estimatedProfit', 'DESC')
        .take(limit)
        .getMany();

      // Calculate profit per hour for each opportunity
      const enrichedOpportunities = opportunities.map(route => {
        const profitPerHour =
          route.estimatedDuration && route.estimatedProfit
            ? route.estimatedProfit / (route.estimatedDuration / 60)
            : 0;

        return {
          ...route,
          profitPerHour: Math.round(profitPerHour),
          rating: this.calculateRouteRating(route),
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
    } catch (error) {
      logger.error('[TradingControllerV2.getOpportunities] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading opportunities', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/analytics
   * Get trading analytics for an organization
   */
  async getOrgAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;

      // Verify user belongs to the requested organization
      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const routeRepo = AppDataSource.getRepository(TradingRoute);
      const routes = await routeRepo.find({
        where: { organizationId: orgId },
      });

      // Calculate analytics
      const analytics = {
        routes: {
          total: routes.length,
          active: routes.filter(r => r.status === RouteStatus.ACTIVE).length,
          inactive: routes.filter(r => r.status === RouteStatus.INACTIVE).length,
          deprecated: routes.filter(r => r.status === RouteStatus.DEPRECATED).length,
        },
        performance: {
          totalRuns: routes.reduce((sum, r) => sum + (r.performance?.runCount || 0), 0),
          totalProfit: routes.reduce(
            (sum, r) => sum + (r.performance?.avgProfit || 0) * (r.performance?.runCount || 0),
            0
          ),
          avgProfitPerRoute:
            routes.length > 0
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
    } catch (error) {
      logger.error('[TradingControllerV2.getOrgAnalytics] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch trading analytics', 500);
    }
  }

  /**
   * GET /api/v2/trading/market-analysis
   * Get market analysis data
   */
  async getMarketAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const _commodity = req.query.commodity as string;
      const _location = req.query.location as string;

      const routeRepo = AppDataSource.getRepository(TradingRoute);
      const routes = await routeRepo.find({
        where: { status: RouteStatus.ACTIVE },
      });

      // Analyze routes for market trends
      const commodities = new Set<string>();
      const locations = new Set<string>();

      routes.forEach(route => {
        route.stops.forEach(stop => {
          locations.add(stop.location);
          stop.buyGoods?.forEach(good => commodities.add(good));
          stop.sellGoods?.forEach(good => commodities.add(good));
        });
      });

      // Build market analysis
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
    } catch (error) {
      logger.error('[TradingControllerV2.getMarketAnalysis] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch market analysis', 500);
    }
  }

  /**
   * Helper: Calculate route rating based on various factors
   */
  // ==================== MARKET ANALYSIS ====================

  /**
   * GET /api/v2/trading/commodities/:commodity/prices
   * Get price chart data for a commodity
   */
  async getCommodityPrices(req: Request, res: Response): Promise<void> {
    try {
      const { commodity } = req.params;
      const location = req.query.location as string | undefined;
      const days = Number.parseInt(req.query.days as string, 10) || 30;

      // Import the trading service
      const tradingService = (await import('../../services/trade/trading/TradingService'))
        .tradingService;

      const chartData = await tradingService.getPriceChartData(commodity, location, days);

      res.success(chartData);
    } catch (error) {
      logger.error('[TradingControllerV2.getCommodityPrices] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch commodity price data', 500);
    }
  }

  /**
   * GET /api/v2/trading/market/trends
   * Get market trends for multiple commodities
   */
  async getMarketTrends(req: Request, res: Response): Promise<void> {
    try {
      const commoditiesParam = req.query.commodities;
      const daysParam = req.query.days;

      if (!commoditiesParam || typeof commoditiesParam !== 'string') {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'commodities query parameter is required',
          400
        );
      }

      const days = daysParam && typeof daysParam === 'string' ? Number.parseInt(daysParam) : 7;
      const commodities = commoditiesParam.split(',').map(c => c.trim());

      const tradingService = (await import('../../services/trade/trading/TradingService'))
        .tradingService;
      const trends = await tradingService.getMarketTrends(commodities, days);

      res.success({
        commodities: trends,
        period: `${days} days`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[TradingControllerV2.getMarketTrends] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch market trends', 500);
    }
  }

  /**
   * POST /api/v2/trading/prices
   * Record price data for a commodity
   */
  async recordPrice(req: Request, res: Response): Promise<void> {
    try {
      const { commodity, location, buyPrice, sellPrice } = req.body;

      if (!commodity || !location || buyPrice === undefined || sellPrice === undefined) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'commodity, location, buyPrice, and sellPrice are required',
          400
        );
      }

      const tradingService = (await import('../../services/trade/trading/TradingService'))
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
    } catch (error) {
      logger.error('[TradingControllerV2.recordPrice] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to record price data', 500);
    }
  }

  /**
   * GET /api/v2/trading/routes/:id/profitability
   * Get profitability analysis for a route
   */
  async getRouteProfitability(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const organizationId = (req as AuthRequest).user?.currentOrganizationId;

      if (!organizationId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const route = await this.findTradingRouteById(id, organizationId);

      if (!route) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      const tradingService = (await import('../../services/trade/trading/TradingService'))
        .tradingService;
      const analysis = await tradingService.analyzeRouteProfitability(id, organizationId);

      res.success(analysis);
    } catch (error) {
      logger.error('[TradingControllerV2.getRouteProfitability] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to analyze route profitability', 500);
    }
  }

  /**
   * POST /api/v2/trading/routes/:id/runs
   * Record a completed route run
   */
  async recordRouteRun(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { profit, duration } = req.body;
      const organizationId = (req as AuthRequest).user?.currentOrganizationId;

      if (profit === undefined || duration === undefined) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'profit and duration are required', 400);
      }

      if (!organizationId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const route = await this.findTradingRouteById(id, organizationId);

      if (!route) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trading route not found', 404);
      }

      const tradingService = (await import('../../services/trade/trading/TradingService'))
        .tradingService;
      const previousStatus = route.status;
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      const updatedRoute = await tradingService.recordRouteRun(
        id,
        profit,
        duration,
        organizationId,
        userId
      );

      emitRouteStatusChanged(
        organizationId,
        route.id,
        previousStatus,
        updatedRoute.status,
        (req as Request & { user?: { id?: string } }).user?.id
      );

      res.success(updatedRoute);
    } catch (error) {
      logger.error('[TradingControllerV2.recordRouteRun] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to record route run', 500);
    }
  }

  /**
   * POST /api/v2/trading/routes/refresh
   * Refresh all route profits from current market data
   */
  async refreshRouteProfits(req: Request, res: Response): Promise<void> {
    try {
      const tradingService = (await import('../../services/trade/trading/TradingService'))
        .tradingService;
      const result = await tradingService.refreshAllRouteProfits();

      res.success({
        updated: result.updated,
        failed: result.failed,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[TradingControllerV2.refreshRouteProfits] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to refresh route profits', 500);
    }
  }

  // ==================== PRICE ALERTS ====================

  /**
   * GET /api/v2/trading/price-alerts
   * List all price alerts for the authenticated user
   */
  async listPriceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      const { PriceAlertService } = await import('../../services/trade/trading/PriceAlertService');
      const alerts = await PriceAlertService.getInstance().getUserAlerts(userId);

      res.success(alerts);
    } catch (error) {
      logger.error('[TradingControllerV2.listPriceAlerts] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to list price alerts', 500);
    }
  }

  /**
   * POST /api/v2/trading/price-alerts
   * Create a new price alert for the authenticated user
   */
  async createPriceAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      const { commodity, condition, threshold, location, enabled } = req.body;

      const { PriceAlertService } = await import('../../services/trade/trading/PriceAlertService');
      const alert = await PriceAlertService.getInstance().createAlert({
        userId,
        commodity,
        condition,
        threshold,
        location: location || undefined,
        enabled: enabled ?? true,
      });

      res.status(201).json({ success: true, data: alert });
    } catch (error) {
      logger.error('[TradingControllerV2.createPriceAlert] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to create price alert', 500);
    }
  }

  /**
   * PATCH /api/v2/trading/price-alerts/:id
   * Update a price alert
   */
  async updatePriceAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      const { id } = req.params;

      const { PriceAlertService } = await import('../../services/trade/trading/PriceAlertService');
      const service = PriceAlertService.getInstance();

      // Verify alert belongs to user
      const existing = await service.getAlert(id);
      if (!existing || existing?.userId !== userId) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
      }

      const updated = await service.updateAlert(id, req.body);
      if (!updated) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
      }

      res.success(updated);
    } catch (error) {
      logger.error('[TradingControllerV2.updatePriceAlert] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to update price alert', 500);
    }
  }

  /**
   * DELETE /api/v2/trading/price-alerts/:id
   * Delete a price alert
   */
  async deletePriceAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      const { id } = req.params;

      const { PriceAlertService } = await import('../../services/trade/trading/PriceAlertService');
      const service = PriceAlertService.getInstance();

      // Verify alert belongs to user
      const existing = await service.getAlert(id);
      if (!existing || existing?.userId !== userId) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
      }

      const deleted = await service.deleteAlert(id);
      if (!deleted) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Price alert not found', 404);
      }

      res.success({ message: 'Price alert deleted successfully' });
    } catch (error) {
      logger.error('[TradingControllerV2.deletePriceAlert] Error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to delete price alert', 500);
    }
  }

  // ==================== HELPERS ====================

  /**
   * Helper: Calculate route rating based on various factors
   */
  private calculateRouteRating(route: TradingRoute): number {
    let rating = 0;

    // Profit factor (0-5 stars)
    const profitScore = Math.min((route.estimatedProfit || 0) / 20000, 5);
    rating += profitScore;

    // Performance factor (0-3 stars)
    if (route.performance) {
      const performanceScore = Math.min(route.performance.runCount / 10, 3);
      rating += performanceScore;
    }

    // Duration factor (0-2 stars) - shorter is better
    if (route.estimatedDuration) {
      const durationScore = Math.max(2 - route.estimatedDuration / 120, 0);
      rating += durationScore;
    }

    return Math.min(Math.round(rating * 10) / 10, 10);
  }

  // ==================== AGGREGATOR ENDPOINTS ====================

  /**
   * POST /api/v2/trading/routes/:id/execute-run
   * Execute a trade run along an existing route
   */
  async executeTradeRun(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      const organizationId = (req as AuthRequest).user?.currentOrganizationId;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      if (!organizationId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      // Resolve organizationId from route
      const route = await this.findTradingRouteById(id, organizationId);
      if (!route) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Trading route not found', 404);
      }

      const { shipId, actualBuyPrice, actualSellPrice, quantityTraded, notes } = req.body;

      const aggregator = new TradeAggregatorService();
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
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to execute trade run: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/trading/operations
   * Create a complete trade operation with route, alerts, and suppliers (saga)
   */
  async createTradeOperation(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }
      // Verify user belongs to the requested organization
      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const {
        operationData,
        routeOptions,
        alertsConfig,
        supplierIds,
        notifyParticipants,
        postToDiscord,
        discordChannelId,
      } = req.body;

      const aggregator = new TradeAggregatorService();
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
        throw new ApiError(
          ApiErrorCode.INTERNAL_ERROR,
          getErrorMessage(result.error, 'Failed to create trade operation'),
          500
        );
      }

      res.status(201).success(result.data);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to create trade operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/trading/price-feed/status
   * Returns the current price-feed provider health status
   */
  async getPriceFeedStatus(_req: Request, res: Response): Promise<void> {
    try {
      const { UEXPriceFeed } = await import('../../services/trade/trading/UEXPriceFeed');
      const feed = new UEXPriceFeed();
      const status = feed.getStatus();
      const hasUexCredential = Boolean(
        process.env.UEX_API_KEY?.trim() ||
        process.env.UEX_API_TOKEN?.trim() ||
        process.env.UEX_API_BEARER_TOKEN?.trim()
      );

      const basePayload = {
        provider: status.name,
        healthy: status.healthy,
        apiUrl: process.env.UEX_API_URL ?? 'https://api.uexcorp.uk/2.0',
        apiKeyConfigured: hasUexCredential,
      };

      res.success(status.details ? { ...basePayload, ...status.details } : basePayload);
    } catch (error) {
      logger.error('[TradingControllerV2.getPriceFeedStatus] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get price feed status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  // ── Trade Reputation Endpoints (Sprint 20-D) ────────────────────

  /**
   * GET /api/v2/trading/reputation/:userId
   * Get a user's trade reputation profile
   */
  async getTradeReputation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { tradeReputationService } =
        await import('../../services/trade/trading/TradeReputationService');
      const reputation = await tradeReputationService.getUserReputation(userId);
      res.success(reputation.getSummary());
    } catch (error) {
      logger.error('[TradingControllerV2.getTradeReputation] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get trade reputation: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/trading/reputation/leaderboard
   * Get the trade reputation leaderboard
   */
  async getTradeReputationLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const { tradeReputationService } =
        await import('../../services/trade/trading/TradeReputationService');
      const leaderboard = await tradeReputationService.getLeaderboard(limit);
      res.success(leaderboard);
    } catch (error) {
      logger.error('[TradingControllerV2.getTradeReputationLeaderboard] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get trade reputation leaderboard: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/transactions
   * Get trade transactions for a user in an organization
   */
  async getTradeTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userOrgId = (req as AuthRequest).user?.currentOrganizationId;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }
      // Verify user belongs to the requested organization
      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const { tradeReputationService } =
        await import('../../services/trade/trading/TradeReputationService');
      const transactions = await tradeReputationService.getUserTransactions(userId, orgId, limit);
      res.success(transactions);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.getTradeTransactions] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get trade transactions: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/trading/disputes
   * Open a trade dispute ticket linked to a transaction
   */
  async createTradeDispute(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const authReq = req as AuthRequest;
      const userOrgId = authReq.user?.currentOrganizationId;
      const userId = authReq.user?.id;
      const userName = authReq.user?.username;

      if (!userId || !userName) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const { transactionId, reason, requestedResolution, evidenceLinks, amountInDispute } =
        req.body as {
          transactionId: string;
          reason: string;
          requestedResolution?: string;
          evidenceLinks?: string[];
          amountInDispute?: number;
        };

      const transaction = await this.findTradeTransactionByOrg(transactionId, orgId);

      if (!transaction) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trade transaction not found', 404);
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
        ? evidenceLinks.filter(
            (link): link is string => typeof link === 'string' && link.trim().length > 0
          )
        : [];
      if (normalizedEvidenceLinks.length > 0) {
        summaryLines.push(`Evidence: ${normalizedEvidenceLinks.join(', ')}`);
      }

      const ticket = await this.ticketService.createTicket(orgId, {
        subject: `Trade dispute ${transaction.id.slice(0, 8).toUpperCase()}`,
        description: summaryLines.join('\n'),
        category: TicketCategory.SUPPORT,
        priority: TicketPriority.HIGH,
        creatorId: userId,
        creatorName: userName,
        recipientType: TicketRecipientType.ORG_OFFICERS,
        tags: ['trade-dispute', `trade-transaction:${transaction.id}`, 'trade-arbitration-pending'],
      });

      res.status(201).success({
        disputeId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        transactionId: transaction.id,
        status: ticket.status,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.createTradeDispute] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to create trade dispute', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/disputes
   * List trade dispute tickets for an organization
   */
  async listTradeDisputes(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const authReq = req as AuthRequest;
      const userOrgId = authReq.user?.currentOrganizationId;

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const canManageDisputes = await this.canManageTradeDisputes(authReq, orgId);
      if (!canManageDisputes) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized to view trade disputes', 403);
      }

      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const disputeStatus = req.query.status as string | undefined;
      const transactionId = req.query.transactionId as string | undefined;

      const ticketRepo = AppDataSource.getRepository(Ticket);
      const queryBuilder = ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.organizationId = :orgId', { orgId })
        .andWhere('ticket.category = :category', { category: TicketCategory.SUPPORT })
        .andWhere('ticket.tags LIKE :disputeTag', { disputeTag: '%trade-dispute%' });

      if (transactionId) {
        queryBuilder.andWhere('ticket.tags LIKE :transactionTag', {
          transactionTag: `%trade-transaction:${transactionId}%`,
        });
      }

      if (disputeStatus === 'open') {
        queryBuilder.andWhere('ticket.status IN (:...openStatuses)', {
          openStatuses: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.AWAITING_RESPONSE,
          ],
        });
      } else if (disputeStatus === 'closed') {
        queryBuilder.andWhere('ticket.status IN (:...closedStatuses)', {
          closedStatuses: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
        });
      }

      const total = await queryBuilder.getCount();
      const disputes = await queryBuilder
        .orderBy('ticket.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany();

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/trading/disputes`,
        offset,
        limit,
        total
      );

      res.paginated(
        disputes,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.listTradeDisputes] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to list trade disputes', 500);
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/trading/disputes/:disputeId/resolve
   * Resolve and close an existing trade dispute ticket
   */
  async resolveTradeDispute(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, disputeId } = req.params;
      const authReq = req as AuthRequest;
      const userOrgId = authReq.user?.currentOrganizationId;
      const userId = authReq.user?.id;
      const userName = authReq.user?.username;

      if (!userId || !userName) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      if (!userOrgId || userOrgId !== orgId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized for this organization', 403);
      }

      const canManageDisputes = await this.canManageTradeDisputes(authReq, orgId);
      if (!canManageDisputes) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Not authorized to resolve trade disputes', 403);
      }

      const { resolution, closeTicket = true } = req.body as {
        resolution: string;
        closeTicket?: boolean;
      };

      const dispute = await this.ticketService.getTicketById(disputeId);
      if (dispute?.organizationId !== orgId) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Trade dispute not found', 404);
      }

      if (!(dispute.tags ?? []).includes('trade-dispute')) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Ticket is not a trade dispute', 400);
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
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[TradingControllerV2.resolveTradeDispute] Error:', error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to resolve trade dispute', 500);
    }
  }
}
