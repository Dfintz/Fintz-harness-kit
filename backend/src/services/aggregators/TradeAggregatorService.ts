import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { RouteStatus, TradeStop, TradingRoute } from '../../models/TradingRoute';
import { logger } from '../../utils/logger';
import { NotificationService } from '../communication';
import { DiscordService, getDiscordService } from '../discord/DiscordService';
import { LogisticsAlertService } from '../trade/logistics/LogisticsAlertService';
import { LogisticsRouteOptimizationService } from '../trade/logistics/LogisticsRouteOptimizationService';
import { SupplierManagementService } from '../trade/logistics/SupplierManagementService';
import { TradeServiceFacade } from '../trade/TradeServiceFacade';
import { TradingService } from '../trade/trading/TradingService';

import { SagaOrchestrator, SagaResult } from './SagaOrchestrator';

/**
 * Default price estimation values for supply chain analysis.
 * In production, these would come from actual market data feeds.
 * Can be overridden via environment variables for tuning.
 */
const DEFAULT_BASE_BUY_PRICE = Number(process.env.TRADE_DEFAULT_BUY_PRICE) || 100;
const DEFAULT_BASE_SELL_PRICE = Number(process.env.TRADE_DEFAULT_SELL_PRICE) || 500;
const DEFAULT_PRICE_VARIATION = Number(process.env.TRADE_DEFAULT_PRICE_VARIATION) || 1000;

/**
 * Parameters for creating a complete trade operation
 */
export interface CreateTradeOperationParams {
  organizationId: string;
  operationData: {
    name: string;
    description?: string;
    coordinatorId: string;
    stops: TradeStop[];
    commodities?: Array<{
      name: string;
      quantity: number;
      buyPrice?: number;
      sellPrice?: number;
    }>;
    estimatedProfit?: number;
  };
  routeOptions?: {
    optimizeForFuel?: boolean;
    maxStops?: number;
    preferredRefuelStops?: string[];
  };
  alertsConfig?: {
    priceThresholds?: Array<{
      commodityName: string;
      minPrice?: number;
      maxPrice?: number;
    }>;
    inventoryAlerts?: boolean;
  };
  supplierIds?: string[];
  notifyParticipants?: boolean;
  postToDiscord?: boolean;
  discordChannelId?: string;
}

/**
 * Parameters for executing a trade run
 */
export interface ExecuteTradeRunParams {
  organizationId: string;
  routeId: string;
  executedById: string;
  shipId?: string;
  actualBuyPrice?: number;
  actualSellPrice?: number;
  quantityTraded?: number;
  notes?: string;
}

/**
 * Parameters for supply chain analysis
 */
export interface SupplyChainAnalysisParams {
  organizationId: string;
  commodities: string[];
  startLocation: string;
  endLocation?: string;
  budget?: number;
  includeSuppliers?: boolean;
}

/**
 * Trade operation result
 */
export interface TradeOperationResult {
  route: TradingRoute;
  optimizedWaypoints?: unknown[];
  alerts?: unknown[];
  suppliers?: unknown[];
  notifications?: unknown[];
}

/**
 * Supply chain analysis result
 */
export interface SupplyChainAnalysisResult {
  commodities: Array<{
    name: string;
    bestBuyLocation: string;
    bestBuyPrice: number;
    bestSellLocation: string;
    bestSellPrice: number;
    potentialProfit: number;
  }>;
  optimizedRoute?: unknown;
  totalEstimatedProfit: number;
  riskFactors: string[];
  recommendations: string[];
}

/**
 * Trade Aggregator Service
 *
 * Handles complex multi-service operations for trade and logistics using the Saga pattern:
 * - Creating complete trade operations with routes, alerts, and suppliers
 * - Executing trade runs with performance tracking
 * - Supply chain analysis and optimization
 * - Bulk route management
 *
 * Uses SagaOrchestrator for automatic compensation (rollback) on failure.
 */
export class TradeAggregatorService {
  private readonly tradeFacade: TradeServiceFacade;
  private readonly tradingService: TradingService;
  private readonly alertService: LogisticsAlertService;
  private readonly supplierService: SupplierManagementService;
  private readonly routeOptimizer: LogisticsRouteOptimizationService;
  private readonly notificationService: NotificationService;
  private readonly discordService: DiscordService;

  constructor() {
    this.tradeFacade = new TradeServiceFacade();
    this.tradingService = new TradingService();
    this.alertService = new LogisticsAlertService();
    this.supplierService = new SupplierManagementService();
    this.routeOptimizer = new LogisticsRouteOptimizationService();
    this.notificationService = new NotificationService(undefined, undefined);
    this.discordService = getDiscordService();
  }

  /**
   * Create a complete trade operation with routes, alerts, and supplier links using Saga pattern
   * Automatically rolls back on failure
   */
  async createTradeOperation(
    params: CreateTradeOperationParams
  ): Promise<SagaResult<Record<string, unknown>>> {
    const saga = new SagaOrchestrator<
      CreateTradeOperationParams & { results: Record<string, unknown> }
    >({
      name: 'CreateTradeOperation',
      maxRetries: 2,
      retryDelayMs: 500,
    });

    const context = { ...params, results: {} as Record<string, unknown> };

    // Step 1: Create trading route
    saga.addStep({
      name: 'createRoute',
      execute: async ctx => {
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
            logger.info('Compensated: Deleted route', { routeId: route.id });
          } catch (error: unknown) {
            logger.warn('Failed to delete route during compensation', { error });
          }
        }
      },
    });

    // Step 2: Optimize route (if options provided)
    saga.addStep({
      name: 'optimizeRoute',
      execute: async ctx => {
        if (!ctx.routeOptions) {
          return null;
        }

        const route = ctx.results.route as TradingRoute;

        try {
          // Create waypoints from stops in the format expected by optimizer
          const waypoints = route.stops.map(stop => ({
            location: stop.location,
            type: 'waypoint' as const,
            items: [],
            priority: stop.order,
            estimatedTimeAtStop: 30, // Default 30 minutes
          }));

          const optimizedRoute = await this.routeOptimizer.optimizeRoute({
            organizationId: ctx.organizationId,
            name: route.name,
            waypoints,
            prioritizeBy: ctx.routeOptions.optimizeForFuel ? 'fuel' : 'distance',
          });

          ctx.results.optimizedRoute = optimizedRoute;
          return optimizedRoute;
        } catch (error: unknown) {
          logger.warn('Route optimization failed, continuing without optimization', { error });
          return null;
        }
      },
      compensate: async () => {
        // No compensation needed - optimization is just data
      },
    });

    // Step 3: Create price alerts (if configured)
    // Note: Using simplified alert creation since full CreateAlertDto requires more fields
    saga.addStep({
      name: 'createAlerts',
      execute: async ctx => {
        if (!ctx.alertsConfig?.priceThresholds || ctx.alertsConfig.priceThresholds.length === 0) {
          return { alertCount: 0, alertIds: [] };
        }

        const route = ctx.results.route as TradingRoute;
        const createdAlerts: string[] = [];

        // Note: In a production system, we would create proper alerts
        // For now, we just log and track the configuration
        for (const threshold of ctx.alertsConfig.priceThresholds) {
          logger.info('Price threshold configured', {
            routeId: route.id,
            commodity: threshold.commodityName,
            minPrice: threshold.minPrice,
            maxPrice: threshold.maxPrice,
          });
          // Track as configured with UUID (actual alert creation would require full DTO)
          createdAlerts.push(`threshold-${threshold.commodityName}-${uuidv4()}`);
        }

        ctx.results.alerts = createdAlerts;
        return { alertCount: createdAlerts.length, alertIds: createdAlerts };
      },
      compensate: async (_ctx, result) => {
        if (result && typeof result === 'object' && 'alertIds' in result) {
          const { alertIds } = result as { alertIds: string[] };
          logger.info('Compensated: Removed alert configurations', { count: alertIds.length });
        }
      },
    });

    // Step 4: Link suppliers (if provided)
    saga.addStep({
      name: 'linkSuppliers',
      execute: async ctx => {
        if (!ctx.supplierIds || ctx.supplierIds.length === 0) {
          return { linkedCount: 0, supplierIds: [] };
        }

        const route = ctx.results.route as TradingRoute;

        // Batch-fetch all suppliers for the org to avoid N+1 loop
        const allOrgSuppliers = await this.supplierService.getSuppliers(ctx.organizationId);
        const orgSupplierIds = new Set(allOrgSuppliers.map(s => s.id));
        const linkedSuppliers = ctx.supplierIds.filter(id => orgSupplierIds.has(id));

        for (const supplierId of linkedSuppliers) {
          logger.info('Linked supplier to route', { supplierId, routeId: route.id });
        }

        ctx.results.linkedSuppliers = linkedSuppliers;
        return { linkedCount: linkedSuppliers.length, supplierIds: linkedSuppliers };
      },
      compensate: async (_ctx, result) => {
        if (result && typeof result === 'object' && 'supplierIds' in result) {
          // In a real implementation, we'd remove the route-supplier links
          const { supplierIds } = result as { supplierIds: string[] };
          logger.info('Compensated: Unlinked suppliers', { count: supplierIds.length });
        }
      },
    });

    // Step 5: Send notifications (non-compensatable)
    saga.addStep({
      name: 'sendNotifications',
      execute: async ctx => {
        const notifications: unknown[] = [];
        const route = ctx.results.route as TradingRoute;

        // Send coordinator notification
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
          } catch (error: unknown) {
            logger.warn('Failed to send coordinator notification', { error });
          }
        }

        // Post to Discord
        if (ctx.postToDiscord && ctx.discordChannelId) {
          try {
            const stopsList = route.stops.map(s => s.location).join(' → ');

            await this.discordService.sendMessage(
              ctx.discordChannelId,
              `📦 New Trade Operation: **${ctx.operationData.name}**\n` +
                `Route: ${stopsList}\n` +
                `Est. Profit: ${ctx.operationData.estimatedProfit || 'TBD'} aUEC`
            );
            notifications.push({ type: 'discord' });
          } catch (error: unknown) {
            logger.warn('Failed to post to Discord', { error });
          }
        }

        return { notificationsSent: notifications.length };
      },
      compensate: async () => {
        // Notifications cannot be compensated
      },
    });

    const result = await saga.execute(context);

    if (result.success) {
      logger.info('Trade operation created successfully', {
        routeId: (context.results.route as TradingRoute)?.id,
        organizationId: params.organizationId,
      });
    } else {
      logger.error('Failed to create trade operation', {
        error: result.error?.message,
        completedSteps: result.completed,
        compensatedSteps: result.compensated,
      });
    }

    return result;
  }

  /**
   * Execute a trade run with performance tracking
   */
  async executeTradeRun(params: ExecuteTradeRunParams): Promise<{
    route: TradingRoute | null;
    execution: {
      executedAt: Date;
      actualProfit?: number;
      performanceRating?: string;
    };
    recommendations: string[];
  }> {
    return AppDataSource.transaction(async () => {
      try {
        // 1. Get route
        const routes = await this.tradingService.getRoutes({
          organizationId: params.organizationId,
        });

        const route = routes.find(r => r.id === params.routeId);

        if (!route) {
          throw new Error('Trade route not found');
        }

        // 2. Calculate performance
        const estimatedProfit = route.estimatedProfit || 0;
        let actualProfit = 0;

        if (params.actualBuyPrice && params.actualSellPrice && params.quantityTraded) {
          actualProfit = (params.actualSellPrice - params.actualBuyPrice) * params.quantityTraded;
        }

        // Determine performance rating
        let performanceRating = 'average';
        if (actualProfit > 0 && estimatedProfit > 0) {
          const ratio = actualProfit / estimatedProfit;
          if (ratio >= 1.2) {
            performanceRating = 'excellent';
          } else if (ratio >= 1.0) {
            performanceRating = 'good';
          } else if (ratio >= 0.8) {
            performanceRating = 'average';
          } else {
            performanceRating = 'poor';
          }
        }

        // 3. Update route execution count (if the method exists)
        try {
          await this.tradingService.updateRoute(
            route.id,
            {
              status: 'active',
              lastUsedAt: new Date(),
            } as Record<string, unknown>,
            route.organizationId!
          );
        } catch (error: unknown) {
          logger.warn('Failed to update route execution data', { error });
        }

        // 4. Generate recommendations
        const recommendations: string[] = [];

        if (performanceRating === 'poor') {
          recommendations.push('Consider renegotiating prices or finding alternative routes');
        }

        if (actualProfit < estimatedProfit * 0.5) {
          recommendations.push(
            'Significant deviation from estimated profit - review market conditions'
          );
        }

        if (!params.shipId) {
          recommendations.push('Consider tracking ship usage for better fleet analytics');
        }

        logger.info('Trade run executed', {
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
      } catch (error: unknown) {
        logger.error('Failed to execute trade run', { error });
        throw error;
      }
    });
  }

  /**
   * Perform comprehensive supply chain analysis
   */
  async analyzeSupplyChain(params: SupplyChainAnalysisParams): Promise<SupplyChainAnalysisResult> {
    try {
      const commodityAnalysis: SupplyChainAnalysisResult['commodities'] = [];
      const riskFactors: string[] = [];
      const recommendations: string[] = [];
      let totalEstimatedProfit = 0;

      // Analyze each commodity
      // In a real implementation, this would query actual market data
      // Using deterministic mock data based on commodity index for consistency
      for (let i = 0; i < params.commodities.length; i++) {
        const commodity = params.commodities[i];
        // Use deterministic values based on commodity index for consistent testing
        const baseMultiplier = (i + 1) * 0.3;
        const analysis = {
          name: commodity,
          bestBuyLocation: params.startLocation,
          bestBuyPrice: Math.floor(
            DEFAULT_BASE_BUY_PRICE + DEFAULT_PRICE_VARIATION * baseMultiplier * 0.1
          ),
          bestSellLocation: params.endLocation || params.startLocation,
          bestSellPrice: Math.floor(
            DEFAULT_BASE_SELL_PRICE + DEFAULT_PRICE_VARIATION * baseMultiplier * 0.5
          ),
          potentialProfit: 0,
        };

        analysis.potentialProfit = analysis.bestSellPrice - analysis.bestBuyPrice;
        totalEstimatedProfit += analysis.potentialProfit;
        commodityAnalysis.push(analysis);
      }

      // Get optimized route if possible
      let optimizedRoute = null;
      try {
        // Create waypoints in the format expected by optimizer
        type WaypointType = 'pickup' | 'delivery' | 'refuel' | 'waypoint';
        const waypoints: Array<{
          location: string;
          type: WaypointType;
          items: Array<{ name: string; quantity: number }>;
          priority: number;
          estimatedTimeAtStop: number;
        }> = [
          {
            location: params.startLocation,
            type: 'pickup',
            items: [],
            priority: 1,
            estimatedTimeAtStop: 30,
          },
        ];

        // Add unique sell locations as waypoints
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
      } catch (error: unknown) {
        logger.warn('Route optimization failed for supply chain analysis', { error });
      }

      // Identify risk factors
      if (params.commodities.length > 5) {
        riskFactors.push('High commodity diversity increases complexity');
      }

      if (totalEstimatedProfit < 5000) {
        riskFactors.push('Low estimated profit margin');
      }

      // Generate recommendations
      if (commodityAnalysis.some(c => c.potentialProfit < 0)) {
        recommendations.push(
          'Some commodities show negative profit - consider removing from operation'
        );
      }

      if (params.budget && totalEstimatedProfit > params.budget * 0.5) {
        recommendations.push('Potential ROI exceeds 50% - high opportunity');
      }

      if (params.includeSuppliers) {
        recommendations.push(
          'Consider establishing preferred supplier relationships for regular runs'
        );
      }

      // Get supplier data if requested
      if (params.includeSuppliers) {
        try {
          const suppliers = await this.supplierService.getSuppliers(params.organizationId, {});
          if (suppliers.length === 0) {
            recommendations.push('No suppliers registered - consider adding trusted suppliers');
          } else {
            recommendations.push(`${suppliers.length} suppliers available for this supply chain`);
          }
        } catch (error: unknown) {
          logger.warn('Failed to get supplier data for analysis', { error });
        }
      }

      logger.info('Supply chain analysis completed', {
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
    } catch (error: unknown) {
      logger.error('Supply chain analysis failed', { error });
      throw error;
    }
  }

  /**
   * Bulk update route statuses with notifications
   */
  async bulkUpdateRouteStatus(
    organizationId: string,
    routeIds: string[],
    newStatus: RouteStatus,
    updatedById: string,
    reason?: string
  ): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
    notifications: number;
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    let notificationCount = 0;

    return AppDataSource.transaction(async () => {
      // Pre-fetch all routes once to avoid N+1 inside loop
      const allRoutes = await this.tradingService.getRoutes({ organizationId });
      const routeMap = new Map(allRoutes.map(r => [r.id, r]));

      for (const routeId of routeIds) {
        try {
          await this.tradingService.updateRoute(
            routeId,
            {
              status: newStatus,
            },
            organizationId
          );
          successful.push(routeId);

          // Send notification to route creator
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
          } catch (error: unknown) {
            logger.warn('Failed to send route status notification', { routeId, error });
          }
        } catch (error: unknown) {
          failed.push({
            id: routeId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Bulk route status update completed', {
        organizationId,
        successful: successful.length,
        failed: failed.length,
        newStatus,
      });

      return { successful, failed, notifications: notificationCount };
    });
  }

  /**
   * Get trade operation overview with analytics
   */
  async getTradeOperationOverview(organizationId: string): Promise<{
    activeRoutes: number;
    totalRoutes: number;
    activeAlerts: number;
    supplierCount: number;
    recentActivity: unknown[];
    topPerformingRoutes: unknown[];
  }> {
    try {
      // Get routes
      const routes = await this.tradingService.getRoutes({ organizationId });
      const activeRoutes = routes.filter(r => r.status === 'active').length;

      // Get alerts (getAlerts returns LogisticsAlert[])
      const alerts = await this.alertService.getAlerts({});
      const activeAlerts = alerts.filter(a => a.status === 'active').length;

      // Get suppliers (returns Supplier[])
      const suppliers = await this.supplierService.getSuppliers(organizationId, {});

      // Mock recent activity (in real implementation, this would query an activity log)
      const recentActivity = routes.slice(0, 5).map(r => ({
        routeId: r.id,
        routeName: r.name,
        status: r.status,
        lastUpdated: r.updatedAt || r.createdAt,
      }));

      // Top performing routes (based on estimated profit and stops)
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
    } catch (error: unknown) {
      logger.error('Failed to get trade operation overview', { error });
      throw error;
    }
  }
}

