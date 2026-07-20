import type {
  MarketAnalysis,
  MarketAnalysisParams,
  TradingAnalytics,
  TradingOpportunities,
  TradingOpportunityParams,
  TradingRouteListParams,
  TradingRouteV2,
} from '@/types/apiV2';
import { RouteStatus } from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

/**
 * Price alert condition types
 */
export type PriceAlertCondition = 'above' | 'below' | 'change_percent';

/**
 * Price alert data from the API
 */
export interface PriceAlert {
  id: string;
  userId: string;
  commodity: string;
  location?: string | null;
  condition: PriceAlertCondition;
  threshold: number;
  enabled: boolean;
  lastTriggered?: string | null;
  createdAt: string;
}

/**
 * Input for creating a price alert
 */
export interface CreatePriceAlertInput {
  commodity: string;
  condition: PriceAlertCondition;
  threshold: number;
  location?: string;
  enabled?: boolean;
}

/**
 * Input for updating a price alert
 */
export interface UpdatePriceAlertInput {
  commodity?: string;
  condition?: PriceAlertCondition;
  threshold?: number;
  location?: string | null;
  enabled?: boolean;
}

/**
 * A trade route suggestion from UEX Corp data
 */
export interface UEXTradeRoute {
  commodity: string;
  commodityCode: string;
  buyTerminal: string;
  buyLocation: string;
  buyPrice: number;
  buySystem: string;
  sellTerminal: string;
  sellLocation: string;
  sellPrice: number;
  sellSystem: string;
  profitPerScu: number;
  profitMargin: number;
  scuAvailable: number;
  maxProfit: number;
  lastUpdated: string;
}

/**
 * Response shape for the UEX routes endpoint
 */
export interface UEXRoutesResponse {
  routes: UEXTradeRoute[];
  total: number;
  source: string;
  disclaimer: string;
}

/**
 * Search params matching UEX trade route search fields
 */
export interface UEXRouteSearchParams {
  limit?: number;
  minMargin?: number;
  commodity?: string;
  starSystemStart?: string;
  starSystemEnd?: string;
  terminalStart?: string;
  terminalEnd?: string;
  investment?: number;
  scu?: number;
}

/**
 * Terminal info for dropdown population
 */
export interface UEXTerminalInfo {
  id: number;
  name: string;
  code: string;
  type?: string;
  starSystem: string;
  planet: string;
  orbit: string;
}

/**
 * Commodity info for dropdown population
 */
export interface UEXCommodityInfo {
  id: number;
  name: string;
  code: string;
  kind: string;
  avgBuyPrice: number;
  avgSellPrice: number;
  isBuyable: boolean;
  isSellable: boolean;
}

/**
 * Trading Service V2
 * Handles all trading route and market analysis API calls using v2 endpoints
 */
class TradingServiceV2 extends BaseService {
  protected basePath = '/api/v2/trading';

  // ============================================================================
  // Organization-Scoped Trading Operations
  // ============================================================================

  /**
   * Get all trading routes for an organization with pagination
   * GET /api/v2/organizations/:orgId/trading/routes
   */
  async getRoutes(organizationId: string, params?: TradingRouteListParams) {
    try {
      this.log('getRoutes', { organizationId, params });

      const url = `/api/v2/organizations/${organizationId}/trading/routes`;
      const queryParams = {
        ...this.getPaginationParams(params),
        status: params?.status,
        search: params?.search,
      };

      const response = await apiClient.getPaginated<TradingRouteV2>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getRoutes');
    }
  }

  /**
   * Create a new trading route for an organization
   * POST /api/v2/organizations/:orgId/trading/routes
   */
  async createRoute(
    organizationId: string,
    data: {
      name: string;
      description?: string;
      stops: Array<{
        location: string;
        buyGoods?: string[];
        sellGoods?: string[];
        order: number;
      }>;
      estimatedProfit?: number;
      estimatedDuration?: number;
      minCargoCapacity?: number;
      tags?: string[];
      notes?: string;
    }
  ) {
    try {
      this.log('createRoute', { organizationId, data });

      const url = `/api/v2/organizations/${organizationId}/trading/routes`;
      const response = await apiClient.post<TradingRouteV2>(url, data);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createRoute');
    }
  }

  /**
   * Get trading analytics for an organization
   * GET /api/v2/organizations/:orgId/trading/analytics
   */
  async getAnalytics(organizationId: string) {
    try {
      this.log('getAnalytics', { organizationId });

      const url = `/api/v2/organizations/${organizationId}/trading/analytics`;
      const response = await apiClient.get<TradingAnalytics>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getAnalytics');
    }
  }

  /**
   * Get suggested trade routes from UEX Corp data
   * GET /api/v2/organizations/:orgId/trading/uex-routes
   */
  async getUexRoutes(
    organizationId: string,
    params?: UEXRouteSearchParams
  ): Promise<UEXRoutesResponse> {
    try {
      this.log('getUexRoutes', { organizationId, params });

      const url = `/api/v2/organizations/${organizationId}/trading/uex-routes`;
      const response = await apiClient.get<UEXRoutesResponse>(url, { params });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUexRoutes');
    }
  }

  /**
   * Get UEX terminals for dropdown population
   * GET /api/v2/organizations/:orgId/trading/uex-terminals
   */
  async getUexTerminals(organizationId: string): Promise<UEXTerminalInfo[]> {
    try {
      this.log('getUexTerminals', { organizationId });

      const url = `/api/v2/organizations/${organizationId}/trading/uex-terminals`;
      const response = await apiClient.get<UEXTerminalInfo[]>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUexTerminals');
    }
  }

  /**
   * Get UEX commodities for dropdown population
   * GET /api/v2/organizations/:orgId/trading/uex-commodities
   */
  async getUexCommodities(organizationId: string): Promise<UEXCommodityInfo[]> {
    try {
      this.log('getUexCommodities', { organizationId });

      const url = `/api/v2/organizations/${organizationId}/trading/uex-commodities`;
      const response = await apiClient.get<UEXCommodityInfo[]>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUexCommodities');
    }
  }

  // ============================================================================
  // Individual Route Operations
  // ============================================================================

  /**
   * Get trading route by ID
   * GET /api/v2/trading/routes/:id
   */
  async getRouteById(id: string) {
    try {
      this.log('getRouteById', { id });

      const response = await apiClient.get<TradingRouteV2>(`${this.basePath}/routes/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getRouteById');
    }
  }

  /**
   * Update trading route
   * PUT /api/v2/trading/routes/:id
   */
  async updateRoute(
    id: string,
    data: {
      name?: string;
      description?: string;
      stops?: Array<{
        location: string;
        buyGoods?: string[];
        sellGoods?: string[];
        order: number;
      }>;
      estimatedProfit?: number;
      estimatedDuration?: number;
      minCargoCapacity?: number;
      status?: RouteStatus;
      tags?: string[];
      notes?: string;
    }
  ) {
    try {
      this.log('updateRoute', { id, data });

      const response = await apiClient.put<TradingRouteV2>(`${this.basePath}/routes/${id}`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateRoute');
    }
  }

  /**
   * Delete trading route
   * DELETE /api/v2/trading/routes/:id
   */
  async deleteRoute(id: string) {
    try {
      this.log('deleteRoute', { id });

      await apiClient.delete(`${this.basePath}/routes/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteRoute');
    }
  }

  // ============================================================================
  // Discovery & Market Analysis
  // ============================================================================

  /**
   * Get trading opportunities based on filters
   * GET /api/v2/trading/opportunities
   */
  async getOpportunities(params?: TradingOpportunityParams) {
    try {
      this.log('getOpportunities', params);

      const response = await apiClient.get<TradingOpportunities>(`${this.basePath}/opportunities`, {
        params,
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOpportunities');
    }
  }

  /**
   * Get market analysis data
   * GET /api/v2/trading/market-analysis
   */
  async getMarketAnalysis(params?: MarketAnalysisParams) {
    try {
      this.log('getMarketAnalysis', params);

      const response = await apiClient.get<MarketAnalysis>(`${this.basePath}/market-analysis`, {
        params,
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMarketAnalysis');
    }
  }

  // ============================================================================
  // Price Alerts
  // ============================================================================

  /**
   * Get all price alerts for the current user
   * GET /api/v2/trading/price-alerts
   */
  async getPriceAlerts(): Promise<PriceAlert[]> {
    try {
      this.log('getPriceAlerts');
      const response = await apiClient.get<PriceAlert[]>(`${this.basePath}/price-alerts`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getPriceAlerts');
    }
  }

  /**
   * Create a new price alert
   * POST /api/v2/trading/price-alerts
   */
  async createPriceAlert(data: CreatePriceAlertInput): Promise<PriceAlert> {
    try {
      this.log('createPriceAlert', data);
      const response = await apiClient.post<PriceAlert>(`${this.basePath}/price-alerts`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createPriceAlert');
    }
  }

  /**
   * Update a price alert
   * PATCH /api/v2/trading/price-alerts/:id
   */
  async updatePriceAlert(id: string, data: UpdatePriceAlertInput): Promise<PriceAlert> {
    try {
      this.log('updatePriceAlert', { id, data });
      const response = await apiClient.patch<PriceAlert>(
        `${this.basePath}/price-alerts/${id}`,
        data
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updatePriceAlert');
    }
  }

  /**
   * Delete a price alert
   * DELETE /api/v2/trading/price-alerts/:id
   */
  async deletePriceAlert(id: string): Promise<void> {
    try {
      this.log('deletePriceAlert', { id });
      await apiClient.delete(`${this.basePath}/price-alerts/${id}`);
    } catch (error) {
      return this.handleError(error, 'deletePriceAlert');
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Search trading routes within an organization
   */
  async searchRoutes(organizationId: string, searchTerm: string, params?: TradingRouteListParams) {
    return this.getRoutes(organizationId, {
      ...params,
      search: searchTerm,
    });
  }

  /**
   * Get active routes for an organization
   */
  async getActiveRoutes(organizationId: string, params?: TradingRouteListParams) {
    return this.getRoutes(organizationId, {
      ...params,
      status: RouteStatus.ACTIVE,
    });
  }

  /**
   * Get high-profit opportunities
   */
  async getHighProfitOpportunities(minProfit: number = 50000, limit: number = 10) {
    return this.getOpportunities({
      minProfit,
      limit,
    });
  }

  /**
   * Get opportunities suitable for a specific ship
   */
  async getOpportunitiesForShip(cargoCapacity: number, minProfit: number = 10000) {
    return this.getOpportunities({
      cargoCapacity,
      minProfit,
      limit: 20,
    });
  }

  /**
   * Update route status
   */
  async updateRouteStatus(id: string, status: RouteStatus) {
    return this.updateRoute(id, { status });
  }

  /**
   * Activate route
   */
  async activateRoute(id: string) {
    return this.updateRouteStatus(id, RouteStatus.ACTIVE);
  }

  /**
   * Deactivate route
   */
  async deactivateRoute(id: string) {
    return this.updateRouteStatus(id, RouteStatus.INACTIVE);
  }

  /**
   * Deprecate route
   */
  async deprecateRoute(id: string) {
    return this.updateRouteStatus(id, RouteStatus.DEPRECATED);
  }
}

// Lazy singleton initialization to prevent "Cannot access before initialization" errors
// This defers instantiation until first access
let instance: TradingServiceV2 | null = null;

const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    instance ??= new TradingServiceV2();
    return (instance as unknown as Record<string, unknown>)[prop as string];
  },
};

export const tradingServiceV2 = new Proxy(
  {} as Record<string, unknown>,
  handler
) as unknown as TradingServiceV2;
