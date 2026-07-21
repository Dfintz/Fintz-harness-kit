import axios, { AxiosError, AxiosInstance } from 'axios';

import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';
import { sanitizeObject } from '../../../utils/securityUtils';
import { ComponentHealth, HealthStatus, IHealthCheckable } from '../../health/ServiceHealthMonitor';
import { circuitBreakerService } from '../../infrastructure';

import { IPriceFeedProvider, PriceFeedSearchOptions } from './IPriceFeedProvider';
import type {
  UEXCommodityInfo,
  UEXRouteSearchParams,
  UEXTerminalInfo,
  UEXTradeRoute,
} from './UEXPriceFeed.types';
import { UIFItem, UIFItemLocation, UIFPriceComparison } from './UIFService';
// Public DTOs live in a sibling module (E5 decomposition); imported back for
// internal use and re-exported so any importer is unchanged.

export type {
  UEXCommodityInfo,
  UEXRouteSearchParams,
  UEXTerminalInfo,
  UEXTradeRoute,
} from './UEXPriceFeed.types';

// ── UEX API 2.0 response shapes ────────────────────────────────────────────

/** Shape returned by GET /commodities */
interface UEXCommodity {
  id: number;
  id_parent?: number;
  name: string;
  code: string;
  slug?: string;
  kind?: string;
  price_buy?: number;
  price_sell?: number;
  is_available?: number;
  is_visible?: number;
  is_buyable?: number;
  is_sellable?: number;
  date_added?: string;
  date_modified?: string;
}

/** Shape returned by GET /commodities_prices */
interface UEXCommodityPrice {
  id: number;
  id_commodity: number;
  id_terminal: number;
  price_buy?: number;
  price_sell?: number;
  scu_buy?: number;
  scu_sell?: number;
  status_buy?: number;
  status_sell?: number;
  date_added?: string;
  date_modified?: string;
  commodity_name?: string;
  commodity_code?: string;
  commodity_slug?: string;
  terminal_name?: string;
  terminal_code?: string;
  terminal_slug?: string;
  star_system_name?: string;
  planet_name?: string;
  orbit_name?: string;
  city_name?: string;
}

/** Shape returned by GET /commodities_routes */
interface UEXCommodityRoute {
  id: number;
  id_commodity: number;
  id_terminal_origin?: number;
  id_terminal_destination?: number;
  code?: string;
  price_origin?: number;
  price_destination?: number;
  price_margin?: number;
  price_roi?: number;
  scu_reachable?: number;
  profit?: number;
  investment?: number;
  date_added?: string | number;
  commodity_name?: string;
  commodity_code?: string;
  origin_star_system_name?: string;
  origin_planet_name?: string;
  origin_orbit_name?: string;
  origin_terminal_name?: string;
  destination_star_system_name?: string;
  destination_planet_name?: string;
  destination_orbit_name?: string;
  destination_terminal_name?: string;
}

/** Shape returned by GET /terminals */
interface UEXTerminal {
  id: number;
  name: string;
  code: string;
  type?: string;
  id_star_system?: number;
  id_planet?: number;
  id_orbit?: number;
  id_city?: number;
  star_system_name?: string;
  planet_name?: string;
  orbit_name?: string;
  city_name?: string;
  is_available?: number;
  is_visible?: number;
  date_added?: string;
  date_modified?: string;
}

/** Standard UEX API 2.0 envelope */
interface UEXApiResponse<T> {
  status: string;
  data: T;
  http_code?: number;
}

// ── Implementation ──────────────────────────────────────────────────────────

/**
 * UEXPriceFeed — adapter for the UEX Corp API 2.0.
 *
 * API docs: https://uexcorp.space/api/2.0
 *
 * Provides live commodity pricing data for Star Citizen.
 * Uses a dual-layer cache: Redis (shared, persistent) as L1 and an
 * in-memory Map as L2 hot cache.  If Redis is unavailable the Map
 * acts as a standalone fallback — all cache operations degrade gracefully.
 *
 * When no UEX API credential is set, all methods gracefully return empty results.
 */
export class UEXPriceFeed implements IPriceFeedProvider, IHealthCheckable {
  readonly name = 'UEX';

  private static readonly TOP_ROUTES_CACHE_VERSION = 'v3';
  private static readonly TOP_ROUTES_MAX_AGE_DAYS =
    Number(process.env.UEX_TOP_ROUTES_MAX_AGE_DAYS) || 3;

  private readonly client: AxiosInstance;
  private readonly apiBaseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly circuitBreakerName = 'uex-price-feed';

  /** Cooldown window after upstream auth failures (401/403) to reduce log noise and retries. */
  private readonly authFailureCooldownMs: number;
  private authFailureUntilMs = 0;
  private authFailureWarningAtMs = 0;

  /** In-memory L2 hot cache (Map). TTL in milliseconds. */
  private readonly memCache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly memCacheTtlMs: number;

  /** Redis L1 cache prefix & TTL (seconds). */
  private static readonly REDIS_PREFIX = 'uex:';
  private readonly redisTtlSeconds: number;

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = apiBaseUrl ?? process.env.UEX_API_URL ?? 'https://api.uexcorp.uk/2.0';
    this.apiKey = this.resolveApiCredential();
    this.authFailureCooldownMs = Number(process.env.UEX_AUTH_FAILURE_COOLDOWN_MS) || 5 * 60 * 1000;
    const clientVersion = process.env.UEX_CLIENT_VERSION?.trim();

    // UEX_CACHE_TTL is in seconds (default 900 = 15 min)
    this.redisTtlSeconds = Number(process.env.UEX_CACHE_TTL) || 900;
    this.memCacheTtlMs = this.redisTtlSeconds * 1000;

    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: Number(process.env.UEX_API_TIMEOUT) || 10_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SC-Fleet-Manager/1.0',
        ...(this.apiKey
          ? {
              Authorization: `Bearer ${this.apiKey}`,
              api_key: this.apiKey,
            }
          : {}),
        ...(clientVersion
          ? {
              'X-Client-Version': clientVersion,
            }
          : {}),
      },
    });

    if (this.apiKey) {
      logger.info(`UEXPriceFeed initialized — apiBaseUrl: ${this.apiBaseUrl}, API key configured`);
    } else {
      logger.warn(
        `UEXPriceFeed initialized (no key) — apiBaseUrl: ${this.apiBaseUrl}, ` +
          'set UEX_API_KEY to enable live data'
      );
    }
  }

  // ── IPriceFeedProvider — item search ────────────────────────────────────

  async searchItems(options: PriceFeedSearchOptions): Promise<UIFItem[]> {
    if (!this.apiKey) {
      return [];
    }

    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = await this.getCached<UIFItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UIFItem[]>(cacheKey) ?? [];
    }

    try {
      const items = await this.withCircuitBreaker(async () => {
        const params: Record<string, string | number> = {};
        if (options.query) {
          params.name = options.query;
        }

        const commodities = await this.fetchApi<UEXCommodity[]>('/commodities', params);
        if (!commodities.length) {
          return [];
        }

        const limited = commodities.slice(0, options.maxResults ?? 50);

        const results: UIFItem[] = [];
        for (const commodity of limited) {
          const prices = await this.fetchCommodityPrices(commodity.id);
          results.push(this.mapCommodityToUIFItem(commodity, prices));
        }
        return results;
      });

      await this.setCache(cacheKey, items);
      return items;
    } catch (error: unknown) {
      this.logUexRequestFailure('UEXPriceFeed.searchItems', error, {
        query: options.query,
      });
      return [];
    }
  }

  async getItemDetails(itemName: string): Promise<UIFItem | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = `item:${itemName.toLowerCase()}`;
    const cached = await this.getCached<UIFItem>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UIFItem>(cacheKey);
    }

    try {
      const item = await this.withCircuitBreaker(async () => {
        const commodities = await this.fetchApi<UEXCommodity[]>('/commodities', {
          name: itemName,
        });
        const commodity =
          commodities.find(c => c.name.toLowerCase() === itemName.toLowerCase()) ?? commodities[0];

        if (!commodity) {
          return null;
        }

        const prices = await this.fetchCommodityPrices(commodity.id);
        return this.mapCommodityToUIFItem(commodity, prices);
      });

      if (item) {
        await this.setCache(cacheKey, item);
      }
      return item;
    } catch (error: unknown) {
      this.logUexRequestFailure('UEXPriceFeed.getItemDetails', error, {
        itemName,
      });
      return null;
    }
  }

  // ── IPriceFeedProvider — price queries ──────────────────────────────────

  async getItemPrices(itemName: string): Promise<UIFItemLocation[]> {
    const item = await this.getItemDetails(itemName);
    return item?.locations ?? [];
  }

  async findBestBuyLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    const locations = await this.getItemPrices(itemName);
    const buyLocations = locations.filter(
      loc => loc.type === 'buy' && loc.price !== null && loc.inStock !== false
    );

    if (buyLocations.length === 0) {
      return null;
    }

    if (nearLocation) {
      const near = nearLocation.toLowerCase();
      const nearby = buyLocations.find(
        loc =>
          loc.location.toLowerCase().includes(near) ||
          loc.system?.toLowerCase().includes(near) ||
          loc.planet?.toLowerCase().includes(near) ||
          loc.station?.toLowerCase().includes(near)
      );
      if (nearby) {
        return nearby;
      }
    }

    return buyLocations.reduce<UIFItemLocation>(
      (min, loc) => ((loc.price ?? Infinity) < (min.price ?? Infinity) ? loc : min),
      buyLocations[0]
    );
  }

  async findBestSellLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    const locations = await this.getItemPrices(itemName);
    const sellLocations = locations.filter(loc => loc.type === 'sell' && loc.price !== null);

    if (sellLocations.length === 0) {
      return null;
    }

    if (nearLocation) {
      const near = nearLocation.toLowerCase();
      const nearby = sellLocations.find(
        loc =>
          loc.location.toLowerCase().includes(near) ||
          loc.system?.toLowerCase().includes(near) ||
          loc.planet?.toLowerCase().includes(near) ||
          loc.station?.toLowerCase().includes(near)
      );
      if (nearby) {
        return nearby;
      }
    }

    return sellLocations.reduce<UIFItemLocation>(
      (max, loc) => ((loc.price ?? 0) > (max.price ?? 0) ? loc : max),
      sellLocations[0]
    );
  }

  async comparePrices(itemName: string): Promise<UIFPriceComparison | null> {
    const bestBuy = await this.findBestBuyLocation(itemName);
    const bestSell = await this.findBestSellLocation(itemName);

    if (!bestBuy?.price || !bestSell?.price) {
      return null;
    }

    const potentialProfit = bestSell.price - bestBuy.price;
    const profitMargin = (potentialProfit / bestBuy.price) * 100;

    return {
      item: itemName,
      bestBuyLocation: bestBuy,
      bestSellLocation: bestSell,
      potentialProfit,
      profitMargin,
    };
  }

  async getItemsAtLocation(location: string): Promise<UIFItem[]> {
    if (!this.apiKey) {
      return [];
    }

    const cacheKey = `location:${location.toLowerCase()}`;
    const cached = await this.getCached<UIFItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UIFItem[]>(cacheKey) ?? [];
    }

    try {
      const items = await this.withCircuitBreaker(async () => {
        const terminals = await this.fetchApi<UEXTerminal[]>('/terminals', { name: location });
        const terminal =
          terminals.find(t => t.name.toLowerCase() === location.toLowerCase()) ?? terminals[0];

        if (!terminal) {
          return [];
        }

        const prices = await this.fetchApi<UEXCommodityPrice[]>('/commodities_prices', {
          id_terminal: terminal.id,
        });

        return this.groupPricesByItem(prices);
      });

      if (items.length) {
        await this.setCache(cacheKey, items);
      }
      return items;
    } catch (error: unknown) {
      this.logUexRequestFailure('UEXPriceFeed.getItemsAtLocation', error, {
        location,
      });
      return [];
    }
  }

  async getTradingOpportunities(
    from: string,
    to: string,
    minMargin: number = 0
  ): Promise<UIFPriceComparison[]> {
    if (!this.apiKey) {
      return [];
    }

    const cacheKey = `opportunities:${from.toLowerCase()}:${to.toLowerCase()}:${minMargin}`;
    const cached = await this.getCached<UIFPriceComparison[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UIFPriceComparison[]>(cacheKey) ?? [];
    }

    try {
      const opportunities = await this.withCircuitBreaker(async () => {
        const [fromTerminals, toTerminals] = await Promise.all([
          this.fetchApi<UEXTerminal[]>('/terminals', { name: from }),
          this.fetchApi<UEXTerminal[]>('/terminals', { name: to }),
        ]);

        const fromTerminal =
          fromTerminals.find(t => t.name.toLowerCase() === from.toLowerCase()) ?? fromTerminals[0];
        const toTerminal =
          toTerminals.find(t => t.name.toLowerCase() === to.toLowerCase()) ?? toTerminals[0];

        if (!fromTerminal || !toTerminal) {
          return [];
        }

        const [fromPrices, toPrices] = await Promise.all([
          this.fetchApi<UEXCommodityPrice[]>('/commodities_prices', {
            id_terminal: fromTerminal.id,
          }),
          this.fetchApi<UEXCommodityPrice[]>('/commodities_prices', {
            id_terminal: toTerminal.id,
          }),
        ]);

        const results: UIFPriceComparison[] = [];

        for (const fp of fromPrices) {
          if (!fp.price_buy || fp.price_buy <= 0) {
            continue;
          }

          const tp = toPrices.find(p => p.id_commodity === fp.id_commodity);
          if (!tp?.price_sell || tp.price_sell <= 0) {
            continue;
          }

          const potentialProfit = tp.price_sell - fp.price_buy;
          const profitMargin = (potentialProfit / fp.price_buy) * 100;

          if (profitMargin < minMargin) {
            continue;
          }

          results.push({
            item: fp.commodity_name ?? `commodity_${fp.id_commodity}`,
            bestBuyLocation: {
              location: fromTerminal.name,
              system: fp.star_system_name,
              planet: fp.planet_name,
              station: fromTerminal.name,
              price: fp.price_buy,
              type: 'buy',
              inStock: (fp.scu_buy ?? 0) > 0,
              lastUpdated: fp.date_modified ?? fp.date_added,
            },
            bestSellLocation: {
              location: toTerminal.name,
              system: tp.star_system_name,
              planet: tp.planet_name,
              station: toTerminal.name,
              price: tp.price_sell,
              type: 'sell',
              inStock: true,
              lastUpdated: tp.date_modified ?? tp.date_added,
            },
            potentialProfit,
            profitMargin,
          });
        }

        results.sort((a, b) => (b.profitMargin ?? 0) - (a.profitMargin ?? 0));
        return results;
      });

      if (opportunities.length) {
        await this.setCache(cacheKey, opportunities);
      }
      return opportunities;
    } catch (error: unknown) {
      this.logUexRequestFailure('UEXPriceFeed.getTradingOpportunities', error, {
        from,
        to,
        minMargin,
      });
      return [];
    }
  }

  // ── Top trade routes (powers the "UEX Routes" feature) ───────────────

  /**
   * Calculate the most profitable trade routes from UEX commodity price data.
   * This replicates the logic behind https://uexcorp.space/trade/routes/.
   *
   * Fetches all commodity prices, pairs buy↔sell across terminals, ranks by
   * profit-per-SCU, and returns the top N results.
   *
   * @param limit  Maximum routes to return (default 25)
   * @param minMargin  Minimum profit margin % to include (default 5)
   * @param filters  Optional search filters matching UEX route search fields
   */
  async getTopTradeRoutes(
    limit: number = 25,
    minMargin: number = 5,
    filters?: UEXRouteSearchParams
  ): Promise<UEXTradeRoute[]> {
    if (!this.apiKey) {
      return [];
    }

    const maxAgeDays = UEXPriceFeed.TOP_ROUTES_MAX_AGE_DAYS;
    const freshnessCutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    // Cache key versioned (v3): adds strict freshness window (last N days)
    // and route-api integration fallback behavior.
    const cacheKey =
      `top-routes:${UEXPriceFeed.TOP_ROUTES_CACHE_VERSION}:${maxAgeDays}:` +
      `${limit}:${minMargin}:${JSON.stringify(filters ?? {})}`;
    const cached = await this.getCached<unknown>(cacheKey);
    if (cached) {
      const normalizedCached = this.filterRecentRoutes(
        this.normalizeTradeRoutes(cached),
        freshnessCutoffMs
      ).slice(0, limit);
      if (normalizedCached.length > 0) {
        return normalizedCached;
      }
    }

    if (this.isAuthFailureCooldownActive()) {
      const stale = this.getStaleCached<unknown>(cacheKey);
      if (stale) {
        return this.filterRecentRoutes(this.normalizeTradeRoutes(stale), freshnessCutoffMs).slice(
          0,
          limit
        );
      }
      return [];
    }

    try {
      const routes = await this.withCircuitBreaker(async () => {
        // Prefer UEX's route-native endpoint when required inputs are available.
        const routeApiRoutes = await this.getTopTradeRoutesFromCommodityRoutesApi(
          limit,
          minMargin,
          filters,
          freshnessCutoffMs
        );
        if (routeApiRoutes.length > 0) {
          return routeApiRoutes;
        }

        // Fetch all commodity prices in one call. The unfiltered /commodities_prices
        // endpoint was deprecated by UEX (now returns 400 missing_required_input);
        // /commodities_prices_all is the documented bulk-fetch replacement.
        const allPrices = await this.fetchApi<UEXCommodityPrice[]>('/commodities_prices_all');
        const recentPrices = allPrices.filter(price =>
          this.isRecentPriceEntry(price, freshnessCutoffMs)
        );

        // Group prices by commodity
        const byCommodity = this.groupPricesByCommodity(recentPrices);

        // Find best buy→sell pairs per commodity
        const builtRoutes = this.buildTradeRoutes(byCommodity, minMargin, limit, filters);
        return this.filterRecentRoutes(
          this.normalizeTradeRoutes(builtRoutes),
          freshnessCutoffMs
        ).slice(0, limit);
      });

      await this.setCache(cacheKey, routes);
      return routes;
    } catch (error: unknown) {
      const stale = this.getStaleCached<unknown>(cacheKey);
      if (stale) {
        const normalizedStale = this.filterRecentRoutes(
          this.normalizeTradeRoutes(stale),
          freshnessCutoffMs
        ).slice(0, limit);
        this.logUexRequestFailure(
          'UEXPriceFeed.getTopTradeRoutes',
          error,
          {
            fallback: 'stale-cache',
            staleRoutes: normalizedStale.length,
          },
          true
        );
        return normalizedStale;
      }
      this.logUexRequestFailure('UEXPriceFeed.getTopTradeRoutes', error, {
        fallback: 'empty',
      });
      return [];
    }
  }

  /**
   * Calculate estimated profit for a given set of trade stops using UEX prices.
   *
   * For each stop, looks up buy/sell prices from UEX data and accumulates
   * per-SCU profit across all commodities.
   */
  async calculateRouteProfit(
    stops: Array<{
      location: string;
      buyGoods?: string[];
      sellGoods?: string[];
    }>
  ): Promise<number> {
    if (!this.apiKey) {
      return 0;
    }

    if (this.isAuthFailureCooldownActive()) {
      return 0;
    }

    try {
      const transactions = new Map<string, { buyPrice?: number; sellPrice?: number }>();

      for (const stop of stops) {
        await this.lookupStopPrices(stop, transactions);
      }

      let totalProfit = 0;
      for (const [, prices] of transactions) {
        if (prices.buyPrice && prices.sellPrice) {
          totalProfit += prices.sellPrice - prices.buyPrice;
        }
      }

      return totalProfit;
    } catch (error: unknown) {
      this.logUexRequestFailure('UEXPriceFeed.calculateRouteProfit', error);
      return 0;
    }
  }

  /** Look up buy/sell prices for a single stop and accumulate into transactions map. */
  private async lookupStopPrices(
    stop: { location: string; buyGoods?: string[]; sellGoods?: string[] },
    transactions: Map<string, { buyPrice?: number; sellPrice?: number }>
  ): Promise<void> {
    if (stop.buyGoods) {
      for (const good of stop.buyGoods) {
        const bestBuy = await this.findBestBuyLocation(good, stop.location);
        if (bestBuy?.price) {
          const existing = transactions.get(good) ?? {};
          existing.buyPrice = bestBuy.price;
          transactions.set(good, existing);
        }
      }
    }
    if (stop.sellGoods) {
      for (const good of stop.sellGoods) {
        const bestSell = await this.findBestSellLocation(good, stop.location);
        if (bestSell?.price) {
          const existing = transactions.get(good) ?? {};
          existing.sellPrice = bestSell.price;
          transactions.set(good, existing);
        }
      }
    }
  }

  // ── Reference data for dropdowns ────────────────────────────────────────

  /** Fetch all terminals for dropdown population. Results are cached. */
  async getTerminalsList(): Promise<UEXTerminalInfo[]> {
    if (!this.apiKey) {
      return [];
    }

    const cacheKey = 'terminals-list';
    const cached = await this.getCached<UEXTerminalInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UEXTerminalInfo[]>(cacheKey) ?? [];
    }

    try {
      const terminals = await this.withCircuitBreaker(() =>
        this.fetchApi<UEXTerminal[]>('/terminals')
      );

      const result: UEXTerminalInfo[] = terminals
        .filter(t => (t.is_available ?? 1) === 1 && (t.is_visible ?? 1) === 1)
        .map(t => ({
          id: t.id,
          name: t.name,
          code: t.code,
          type: t.type,
          starSystem: t.star_system_name ?? '',
          planet: t.planet_name ?? '',
          orbit: t.orbit_name ?? '',
        }));

      await this.setCache(cacheKey, result);
      return result;
    } catch (error: unknown) {
      const stale = this.getStaleCached<UEXTerminalInfo[]>(cacheKey);
      if (stale) {
        this.logUexRequestFailure(
          'UEXPriceFeed.getTerminalsList',
          error,
          {
            fallback: 'stale-cache',
          },
          true
        );
        return stale;
      }
      this.logUexRequestFailure('UEXPriceFeed.getTerminalsList', error, {
        fallback: 'empty',
      });
      return [];
    }
  }

  /** Fetch all tradeable commodities for dropdown population. Results are cached. */
  async getCommoditiesList(): Promise<UEXCommodityInfo[]> {
    if (!this.apiKey) {
      return [];
    }

    const cacheKey = 'commodities-list';
    const cached = await this.getCached<UEXCommodityInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isAuthFailureCooldownActive()) {
      return this.getStaleCached<UEXCommodityInfo[]>(cacheKey) ?? [];
    }

    try {
      const commodities = await this.withCircuitBreaker(() =>
        this.fetchApi<UEXCommodity[]>('/commodities')
      );

      const result: UEXCommodityInfo[] = commodities
        .filter(c => (c.is_available ?? 1) === 1 && (c.is_visible ?? 1) === 1)
        .map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          kind: c.kind ?? 'Other',
          avgBuyPrice: c.price_buy ?? 0,
          avgSellPrice: c.price_sell ?? 0,
          isBuyable: c.is_buyable === 1,
          isSellable: c.is_sellable === 1,
        }))
        .filter(c => c.isBuyable || c.isSellable);

      await this.setCache(cacheKey, result);
      return result;
    } catch (error: unknown) {
      const stale = this.getStaleCached<UEXCommodityInfo[]>(cacheKey);
      if (stale) {
        this.logUexRequestFailure(
          'UEXPriceFeed.getCommoditiesList',
          error,
          {
            fallback: 'stale-cache',
          },
          true
        );
        return stale;
      }
      this.logUexRequestFailure('UEXPriceFeed.getCommoditiesList', error, {
        fallback: 'empty',
      });
      return [];
    }
  }

  // ── Cache lifecycle ─────────────────────────────────────────────────────

  clearCache(): void {
    this.memCache.clear();
    // Fire-and-forget — Redis graceful degradation handles failures
    void cache.delPattern(`${UEXPriceFeed.REDIS_PREFIX}*`);
    logger.info('UEXPriceFeed cache cleared (memory + Redis)');
  }

  clearItemCache(itemName: string): void {
    const prefix = `item:${itemName.toLowerCase()}`;
    for (const key of this.memCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memCache.delete(key);
      }
    }
    void cache.delPattern(`${UEXPriceFeed.REDIS_PREFIX}${prefix}*`);
  }

  getStatus(): { name: string; healthy: boolean; details?: Record<string, unknown> } {
    const cbState = circuitBreakerService.getState(this.circuitBreakerName);
    // A null state means no requests yet — treat as healthy if key is configured
    const cbHealthy = cbState === null || circuitBreakerService.isHealthy(this.circuitBreakerName);
    const redisStatus = cache.getStatus();

    return {
      name: this.name,
      healthy: !!this.apiKey && cbHealthy,
      details: {
        status: this.resolveStatusLabel(cbHealthy),
        apiBaseUrl: this.apiBaseUrl,
        apiKeyConfigured: !!this.apiKey,
        circuitBreaker: cbState ?? 'not-initialised',
        authFailureCooldownActive: this.isAuthFailureCooldownActive(),
        authFailureRetryAfterMs: Math.max(this.authFailureUntilMs - Date.now(), 0),
        memCacheSize: this.memCache.size,
        redisConnected: redisStatus.connected,
        redisEnabled: redisStatus.enabled,
        cacheTtlSeconds: this.redisTtlSeconds,
      },
    };
  }

  // ── Private: status helpers ─────────────────────────────────────────────

  private resolveApiCredential(): string | undefined {
    const configuredCredential =
      process.env.UEX_API_KEY ?? process.env.UEX_API_TOKEN ?? process.env.UEX_API_BEARER_TOKEN;

    if (!configuredCredential) {
      return undefined;
    }

    const normalized = configuredCredential.trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.toLowerCase().startsWith('bearer ')) {
      const token = normalized.slice(7).trim();
      return token || undefined;
    }

    return normalized;
  }

  private resolveStatusLabel(cbHealthy: boolean): string {
    if (!this.apiKey) {
      return 'disabled — UEX API credential not set';
    }
    if (cbHealthy) {
      return 'operational';
    }
    return 'degraded — circuit breaker open';
  }

  private isAuthFailureCooldownActive(): boolean {
    return Date.now() < this.authFailureUntilMs;
  }

  private isAuthFailureResponse(error: unknown): error is AxiosError {
    return (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    );
  }

  private markAuthFailureWindow(): void {
    const cooldownEndsAt = Date.now() + this.authFailureCooldownMs;
    if (cooldownEndsAt > this.authFailureUntilMs) {
      this.authFailureUntilMs = cooldownEndsAt;
    }
  }

  private sanitizeUexErrorResponseData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data.length > 500 ? `${data.slice(0, 500)}...` : data;
    }

    if (typeof data === 'object') {
      return sanitizeObject({ responseData: data }).responseData;
    }

    return data;
  }

  private sanitizeUexError(error: unknown): Record<string, unknown> {
    if (axios.isAxiosError(error)) {
      return sanitizeObject({
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        method: error.config?.method,
        url: error.config?.url,
        params: error.config?.params,
        responseData: this.sanitizeUexErrorResponseData(error.response?.data),
      });
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      message: String(error),
    };
  }

  private logUexRequestFailure(
    methodName: string,
    error: unknown,
    context: Record<string, unknown> = {},
    degraded: boolean = false
  ): void {
    const safeContext = sanitizeObject({
      ...context,
      error: this.sanitizeUexError(error),
    });

    if (this.isAuthFailureResponse(error)) {
      this.markAuthFailureWindow();

      const now = Date.now();
      if (now >= this.authFailureWarningAtMs) {
        this.authFailureWarningAtMs = now + this.authFailureCooldownMs;
        logger.warn(`${methodName} upstream auth failed; enabling temporary cooldown`, {
          ...safeContext,
          retryAfterMs: Math.max(this.authFailureUntilMs - now, 0),
        });
      }
      return;
    }

    if (degraded) {
      logger.warn(`${methodName} degraded`, safeContext);
      return;
    }

    logger.error(`${methodName} failed`, safeContext);
  }

  // ── Private: HTTP helpers ───────────────────────────────────────────────

  /** Group commodity prices into buy/sell buckets keyed by commodity ID. */
  private groupPricesByCommodity(
    allPrices: UEXCommodityPrice[]
  ): Map<
    number,
    { buys: UEXCommodityPrice[]; sells: UEXCommodityPrice[]; name: string; code: string }
  > {
    const byCommodity = new Map<
      number,
      { buys: UEXCommodityPrice[]; sells: UEXCommodityPrice[]; name: string; code: string }
    >();

    for (const p of allPrices) {
      if (!byCommodity.has(p.id_commodity)) {
        byCommodity.set(p.id_commodity, {
          buys: [],
          sells: [],
          name: p.commodity_name ?? `commodity_${p.id_commodity}`,
          code: p.commodity_code ?? '',
        });
      }
      const entry = byCommodity.get(p.id_commodity)!;

      if (p.price_buy && p.price_buy > 0 && (p.scu_buy ?? 0) > 0) {
        entry.buys.push(p);
      }
      if (p.price_sell && p.price_sell > 0) {
        entry.sells.push(p);
      }
    }

    return byCommodity;
  }

  /** Build sorted trade routes from grouped commodity prices. */
  private buildTradeRoutes(
    byCommodity: Map<
      number,
      { buys: UEXCommodityPrice[]; sells: UEXCommodityPrice[]; name: string; code: string }
    >,
    minMargin: number,
    limit: number,
    filters?: UEXRouteSearchParams
  ): UEXTradeRoute[] {
    const results: UEXTradeRoute[] = [];

    for (const [, { buys, sells, name, code }] of byCommodity) {
      // Commodity name filter
      if (filters?.commodity && !name.toLowerCase().includes(filters.commodity.toLowerCase())) {
        continue;
      }

      const filteredBuys = this.applyLocationFilters(
        buys,
        filters?.starSystemStart,
        filters?.terminalStart
      );
      const filteredSells = this.applyLocationFilters(
        sells,
        filters?.starSystemEnd,
        filters?.terminalEnd
      );

      if (filteredBuys.length === 0 || filteredSells.length === 0) {
        continue;
      }

      const route = this.buildSingleRoute(
        filteredBuys,
        filteredSells,
        name,
        code,
        minMargin,
        filters
      );
      if (route) {
        results.push(route);
      }
    }

    results.sort((a, b) => b.profitPerScu - a.profitPerScu);
    return results.slice(0, limit);
  }

  /**
   * Try route-native UEX endpoint when filters provide required inputs.
   * Falls back to empty list when no required filter can be resolved.
   */
  private async getTopTradeRoutesFromCommodityRoutesApi(
    limit: number,
    minMargin: number,
    filters: UEXRouteSearchParams | undefined,
    freshnessCutoffMs: number
  ): Promise<UEXTradeRoute[]> {
    const params = await this.buildCommodityRoutesParams(filters);
    if (!params) {
      return [];
    }

    let routes: UEXCommodityRoute[] = [];
    try {
      routes = await this.fetchApi<UEXCommodityRoute[]>('/commodities_routes', params);
    } catch (error: unknown) {
      this.logUexRequestFailure(
        'UEXPriceFeed.getTopTradeRoutesFromCommodityRoutesApi',
        error,
        {
          params,
        },
        true
      );
      return [];
    }

    if (!routes.length) {
      return [];
    }

    const normalized = routes
      .map(route => this.mapCommodityRouteToTradeRoute(route))
      .filter((route): route is UEXTradeRoute => route !== null);

    const filtered = this.applyRouteTextFilters(normalized, filters)
      .filter(route => route.profitMargin >= minMargin)
      .sort((a, b) => b.profitPerScu - a.profitPerScu);

    return this.filterRecentRoutes(filtered, freshnessCutoffMs).slice(0, limit);
  }

  /** Build /commodities_routes parameters from UI filters when possible. */
  private async buildCommodityRoutesParams(
    filters?: UEXRouteSearchParams
  ): Promise<Record<string, string | number> | null> {
    if (!filters) {
      return null;
    }

    const params: Record<string, string | number> = {};

    const commodityIdFromFilter = this.parsePositiveInt(filters.commodity);
    if (commodityIdFromFilter) {
      params.id_commodity = commodityIdFromFilter;
    } else if (filters.commodity) {
      const commodityId = await this.resolveCommodityId(filters.commodity);
      if (commodityId) {
        params.id_commodity = commodityId;
      }
    }

    const originTerminalIdFromFilter = this.parsePositiveInt(filters.terminalStart);
    if (originTerminalIdFromFilter) {
      params.id_terminal_origin = originTerminalIdFromFilter;
    } else if (filters.terminalStart) {
      const terminalId = await this.resolveTerminalId(
        filters.terminalStart,
        filters.starSystemStart
      );
      if (terminalId) {
        params.id_terminal_origin = terminalId;
      }
    }

    const destinationTerminalIdFromFilter = this.parsePositiveInt(filters.terminalEnd);
    if (destinationTerminalIdFromFilter) {
      params.id_terminal_destination = destinationTerminalIdFromFilter;
    } else if (filters.terminalEnd) {
      const terminalId = await this.resolveTerminalId(filters.terminalEnd, filters.starSystemEnd);
      if (terminalId) {
        params.id_terminal_destination = terminalId;
      }
    }

    if (filters.investment && filters.investment > 0) {
      params.investment = Math.floor(filters.investment);
    }

    // UEX requires at least one origin/commodity selector for this endpoint.
    if (!params.id_commodity && !params.id_terminal_origin) {
      return null;
    }

    return params;
  }

  /** Convert route endpoint payload to canonical UEXTradeRoute shape. */
  private mapCommodityRouteToTradeRoute(raw: UEXCommodityRoute): UEXTradeRoute | null {
    const buyPrice = this.toNumber(raw.price_origin) ?? 0;
    const sellPrice = this.toNumber(raw.price_destination) ?? 0;
    if (buyPrice <= 0 || sellPrice <= 0) {
      return null;
    }

    const profitPerScu = this.toNumber(raw.price_margin) ?? sellPrice - buyPrice;
    if (profitPerScu <= 0) {
      return null;
    }

    const profitMargin =
      this.toNumber(raw.price_roi) ?? (buyPrice > 0 ? (profitPerScu / buyPrice) * 100 : 0);
    const scuAvailable = this.toNumber(raw.scu_reachable) ?? 0;
    const maxProfit = this.toNumber(raw.profit) ?? profitPerScu * Math.max(scuAvailable, 0);

    const commodity = this.toString(raw.commodity_name) ?? `commodity_${raw.id_commodity}`;
    const commodityCode = this.toString(raw.commodity_code) ?? commodity.slice(0, 4).toUpperCase();

    const buyTerminal =
      this.toString(raw.origin_terminal_name) ??
      `terminal_${this.toString(raw.id_terminal_origin) ?? 'origin'}`;
    const sellTerminal =
      this.toString(raw.destination_terminal_name) ??
      `terminal_${this.toString(raw.id_terminal_destination) ?? 'destination'}`;

    const buyLocationParts = [
      this.toString(raw.origin_planet_name),
      this.toString(raw.origin_orbit_name),
    ].filter((part): part is string => !!part);
    const sellLocationParts = [
      this.toString(raw.destination_planet_name),
      this.toString(raw.destination_orbit_name),
    ].filter((part): part is string => !!part);

    return {
      commodity,
      commodityCode,
      buyTerminal,
      buyLocation: buyLocationParts.join(' - ') || buyTerminal,
      buyPrice,
      buySystem: this.toString(raw.origin_star_system_name) ?? '',
      sellTerminal,
      sellLocation: sellLocationParts.join(' - ') || sellTerminal,
      sellPrice,
      sellSystem: this.toString(raw.destination_star_system_name) ?? '',
      profitPerScu,
      profitMargin: Math.round(profitMargin * 100) / 100,
      scuAvailable,
      maxProfit,
      lastUpdated: this.toIsoString(raw.date_added) ?? '',
    };
  }

  /** Apply current UI filters consistently to both route and price based sources. */
  private applyRouteTextFilters(
    routes: UEXTradeRoute[],
    filters?: UEXRouteSearchParams
  ): UEXTradeRoute[] {
    if (!filters) {
      return routes;
    }

    const hasNumericCommodityId = this.parsePositiveInt(filters.commodity) !== undefined;

    return routes.filter(route => {
      if (filters.commodity && !hasNumericCommodityId) {
        const query = filters.commodity.toLowerCase();
        const commodityMatch =
          route.commodity.toLowerCase().includes(query) ||
          route.commodityCode.toLowerCase().includes(query);
        if (!commodityMatch) {
          return false;
        }
      }

      if (
        filters.starSystemStart &&
        !route.buySystem.toLowerCase().includes(filters.starSystemStart.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.starSystemEnd &&
        !route.sellSystem.toLowerCase().includes(filters.starSystemEnd.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.terminalStart &&
        !route.buyTerminal.toLowerCase().includes(filters.terminalStart.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.terminalEnd &&
        !route.sellTerminal.toLowerCase().includes(filters.terminalEnd.toLowerCase())
      ) {
        return false;
      }

      if (filters.investment && route.buyPrice > filters.investment) {
        return false;
      }

      if (filters.scu && route.scuAvailable < filters.scu) {
        return false;
      }

      return true;
    });
  }

  /** Keep only routes updated within the configured freshness window. */
  private filterRecentRoutes(routes: UEXTradeRoute[], cutoffMs: number): UEXTradeRoute[] {
    return routes.filter(route => {
      const updatedAtMs = this.toTimestampMs(route.lastUpdated);
      return updatedAtMs !== undefined && updatedAtMs >= cutoffMs;
    });
  }

  /** Keep only price entries updated within the freshness window. */
  private isRecentPriceEntry(price: UEXCommodityPrice, cutoffMs: number): boolean {
    const updatedAtMs = this.toTimestampMs(price.date_modified ?? price.date_added);
    return updatedAtMs !== undefined && updatedAtMs >= cutoffMs;
  }

  /** Parse positive integer values from freeform filter inputs. */
  private parsePositiveInt(value: unknown): number | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    const parsed = Number(String(value).trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }

  /** Resolve commodity ID by exact/partial name or code. */
  private async resolveCommodityId(search: string): Promise<number | undefined> {
    const query = search.trim().toLowerCase();
    if (!query) {
      return undefined;
    }

    const commodities = await this.getCommoditiesList();
    if (!commodities.length) {
      return undefined;
    }

    const exactMatch = commodities.find(
      commodity => commodity.name.toLowerCase() === query || commodity.code.toLowerCase() === query
    );
    if (exactMatch) {
      return exactMatch.id;
    }

    return commodities.find(
      commodity =>
        commodity.name.toLowerCase().includes(query) || commodity.code.toLowerCase().includes(query)
    )?.id;
  }

  /** Resolve terminal ID by exact/partial name or code, optionally scoped by star system. */
  private async resolveTerminalId(
    search: string,
    starSystem?: string
  ): Promise<number | undefined> {
    const query = search.trim().toLowerCase();
    if (!query) {
      return undefined;
    }

    let terminals = await this.getTerminalsList();
    if (starSystem?.trim()) {
      const system = starSystem.trim().toLowerCase();
      terminals = terminals.filter(terminal => terminal.starSystem.toLowerCase().includes(system));
    }

    if (!terminals.length) {
      return undefined;
    }

    const exactMatch = terminals.find(
      terminal => terminal.name.toLowerCase() === query || terminal.code.toLowerCase() === query
    );
    if (exactMatch) {
      return exactMatch.id;
    }

    return terminals.find(
      terminal =>
        terminal.name.toLowerCase().includes(query) || terminal.code.toLowerCase().includes(query)
    )?.id;
  }

  /**
   * Normalize trade route records from cache or legacy payloads to the
   * canonical UEXTradeRoute shape expected by frontend consumers.
   */
  private normalizeTradeRoutes(raw: unknown): UEXTradeRoute[] {
    const routeEntries = this.extractRouteEntries(raw);

    return routeEntries
      .map(route => this.normalizeTradeRoute(route))
      .filter((route): route is UEXTradeRoute => route !== null);
  }

  /** Extract route array from common envelope variants. */
  private extractRouteEntries(raw: unknown): unknown[] {
    if (Array.isArray(raw)) {
      return raw;
    }

    const record = this.asRecord(raw);
    if (!record) {
      return [];
    }

    if (Array.isArray(record.routes)) {
      return record.routes;
    }

    const dataRecord = this.asRecord(record.data);
    if (dataRecord && Array.isArray(dataRecord.routes)) {
      return dataRecord.routes;
    }

    return [];
  }

  /** Normalize a single route from mixed naming conventions (camel/snake/legacy). */
  private normalizeTradeRoute(raw: unknown): UEXTradeRoute | null {
    const routeRecord = this.asRecord(raw);
    if (!routeRecord) {
      return null;
    }

    const buyRecord = this.asRecord(routeRecord.buy) ?? {};
    const sellRecord = this.asRecord(routeRecord.sell) ?? {};

    const commodity =
      this.toString(
        this.getFirstDefinedValue(routeRecord, [
          'commodity',
          'commodity_name',
          'commodityName',
          'item',
        ])
      ) ?? 'Unknown Commodity';

    const commodityCode =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['commodityCode', 'commodity_code', 'code'])
      ) ?? commodity.slice(0, 4).toUpperCase();

    const buyTerminal =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['buyTerminal', 'buy_terminal', 'fromTerminal'])
      ) ??
      this.toString(this.getFirstDefinedValue(buyRecord, ['terminal', 'terminal_name', 'name'])) ??
      'Unknown Buy Terminal';

    const sellTerminal =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['sellTerminal', 'sell_terminal', 'toTerminal'])
      ) ??
      this.toString(this.getFirstDefinedValue(sellRecord, ['terminal', 'terminal_name', 'name'])) ??
      'Unknown Sell Terminal';

    const buyPrice =
      this.toNumber(
        this.getFirstDefinedValue(routeRecord, ['buyPrice', 'buy_price', 'price_buy'])
      ) ??
      this.toNumber(this.getFirstDefinedValue(buyRecord, ['price', 'buyPrice', 'price_buy'])) ??
      0;

    const sellPrice =
      this.toNumber(
        this.getFirstDefinedValue(routeRecord, ['sellPrice', 'sell_price', 'price_sell'])
      ) ??
      this.toNumber(this.getFirstDefinedValue(sellRecord, ['price', 'sellPrice', 'price_sell'])) ??
      0;

    // Drop routes with no usable price data. Prevents rendering rows of "N/A"
    // when stale cache or upstream shape drift leaves prices unresolved.
    if (buyPrice <= 0 || sellPrice <= 0) {
      return null;
    }

    const resolvedProfitPerScu =
      this.toNumber(
        this.getFirstDefinedValue(routeRecord, ['profitPerScu', 'profit_per_scu', 'profit'])
      ) ??
      this.toNumber(this.getFirstDefinedValue(routeRecord, ['profitPerUnit', 'profit_per_unit'])) ??
      (buyPrice > 0 && sellPrice > 0 ? sellPrice - buyPrice : 0);

    const resolvedProfitMargin =
      this.toNumber(
        this.getFirstDefinedValue(routeRecord, ['profitMargin', 'profit_margin', 'margin'])
      ) ?? (buyPrice > 0 ? (resolvedProfitPerScu / buyPrice) * 100 : 0);

    const scuAvailable =
      this.toNumber(
        this.getFirstDefinedValue(routeRecord, [
          'scuAvailable',
          'scu_available',
          'availableScu',
          'scu',
          'scu_buy',
        ])
      ) ??
      this.toNumber(this.getFirstDefinedValue(buyRecord, ['scu', 'scu_buy', 'available'])) ??
      0;

    const maxProfit =
      this.toNumber(this.getFirstDefinedValue(routeRecord, ['maxProfit', 'max_profit'])) ??
      resolvedProfitPerScu * scuAvailable;

    const buyLocation =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['buyLocation', 'buy_location', 'fromLocation'])
      ) ??
      this.toString(this.getFirstDefinedValue(buyRecord, ['location', 'location_name'])) ??
      buyTerminal;

    const sellLocation =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['sellLocation', 'sell_location', 'toLocation'])
      ) ??
      this.toString(this.getFirstDefinedValue(sellRecord, ['location', 'location_name'])) ??
      sellTerminal;

    const buySystem =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['buySystem', 'buy_system', 'fromSystem'])
      ) ??
      this.toString(this.getFirstDefinedValue(buyRecord, ['system', 'star_system_name'])) ??
      '';

    const sellSystem =
      this.toString(
        this.getFirstDefinedValue(routeRecord, ['sellSystem', 'sell_system', 'toSystem'])
      ) ??
      this.toString(this.getFirstDefinedValue(sellRecord, ['system', 'star_system_name'])) ??
      '';

    const lastUpdated =
      this.toIsoString(
        this.getFirstDefinedValue(routeRecord, [
          'lastUpdated',
          'last_updated',
          'updatedAt',
          'date_added',
          'date_modified',
          'dateModified',
        ])
      ) ??
      this.toIsoString(
        this.getFirstDefinedValue(buyRecord, ['date_modified', 'dateModified', 'date_added'])
      ) ??
      this.toIsoString(
        this.getFirstDefinedValue(sellRecord, ['date_modified', 'dateModified', 'date_added'])
      ) ??
      '';

    return {
      commodity,
      commodityCode,
      buyTerminal,
      buyLocation,
      buyPrice,
      buySystem,
      sellTerminal,
      sellLocation,
      sellPrice,
      sellSystem,
      profitPerScu: resolvedProfitPerScu,
      profitMargin: Math.round(resolvedProfitMargin * 100) / 100,
      scuAvailable,
      maxProfit,
      lastUpdated,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private getFirstDefinedValue(
    source: Record<string, unknown>,
    keys: string[]
  ): string | number | boolean | Date | object | undefined {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private toString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return undefined;
  }

  private toIsoString(value: unknown): string | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
      const parsedDate = new Date(milliseconds);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      const timestamp = Date.parse(trimmed);
      if (Number.isNaN(timestamp)) {
        return trimmed;
      }
      return new Date(timestamp).toISOString();
    }

    return undefined;
  }

  private toTimestampMs(value: unknown): number | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      }

      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  private getMostRecentIsoTimestamp(values: Array<string | number | undefined>): string {
    let mostRecentMs: number | undefined;

    for (const value of values) {
      const timestampMs = this.toTimestampMs(value);
      if (timestampMs === undefined) {
        continue;
      }

      if (mostRecentMs === undefined || timestampMs > mostRecentMs) {
        mostRecentMs = timestampMs;
      }
    }

    return mostRecentMs !== undefined ? new Date(mostRecentMs).toISOString() : '';
  }

  /** Apply star system and terminal filters to a list of prices. */
  private applyLocationFilters(
    prices: UEXCommodityPrice[],
    starSystem?: string,
    terminal?: string
  ): UEXCommodityPrice[] {
    let filtered = prices;
    if (starSystem) {
      const lc = starSystem.toLowerCase();
      filtered = filtered.filter(p => (p.star_system_name ?? '').toLowerCase().includes(lc));
    }
    if (terminal) {
      const lc = terminal.toLowerCase();
      filtered = filtered.filter(p => (p.terminal_name ?? '').toLowerCase().includes(lc));
    }
    return filtered;
  }

  /** Compute a single trade route from filtered buy/sell price lists. */
  private buildSingleRoute(
    buys: UEXCommodityPrice[],
    sells: UEXCommodityPrice[],
    name: string,
    code: string,
    minMargin: number,
    filters?: UEXRouteSearchParams
  ): UEXTradeRoute | null {
    const bestBuy = buys.reduce((min, p) => (p.price_buy! < min.price_buy! ? p : min), buys[0]);
    const bestSell = sells.reduce(
      (max, p) => (p.price_sell! > max.price_sell! ? p : max),
      sells[0]
    );

    if (bestBuy.id_terminal === bestSell.id_terminal) {
      return null;
    }

    const profitPerScu = bestSell.price_sell! - bestBuy.price_buy!;
    if (profitPerScu <= 0) {
      return null;
    }

    const profitMargin = (profitPerScu / bestBuy.price_buy!) * 100;
    if (profitMargin < minMargin) {
      return null;
    }

    if (filters?.investment && bestBuy.price_buy! > filters.investment) {
      return null;
    }

    const scuAvailable = bestBuy.scu_buy ?? 0;
    if (filters?.scu && scuAvailable < filters.scu) {
      return null;
    }

    const buyLocation = [bestBuy.planet_name, bestBuy.orbit_name].filter(Boolean).join(' - ');
    const sellLocation = [bestSell.planet_name, bestSell.orbit_name].filter(Boolean).join(' - ');
    const lastUpdated = this.getMostRecentIsoTimestamp([
      bestBuy.date_modified,
      bestBuy.date_added,
      bestSell.date_modified,
      bestSell.date_added,
    ]);

    return {
      commodity: name,
      commodityCode: code,
      buyTerminal: bestBuy.terminal_name ?? `terminal_${bestBuy.id_terminal}`,
      buyLocation: (buyLocation || bestBuy.terminal_name) ?? '',
      buyPrice: bestBuy.price_buy!,
      buySystem: bestBuy.star_system_name ?? '',
      sellTerminal: bestSell.terminal_name ?? `terminal_${bestSell.id_terminal}`,
      sellLocation: (sellLocation || bestSell.terminal_name) ?? '',
      sellPrice: bestSell.price_sell!,
      sellSystem: bestSell.star_system_name ?? '',
      profitPerScu,
      profitMargin: Math.round(profitMargin * 100) / 100,
      scuAvailable,
      maxProfit: profitPerScu * scuAvailable,
      lastUpdated,
    };
  }

  /** Fetch from UEX API, unwrapping the `{ status, data }` envelope when present. */
  private async fetchApi<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    try {
      const response = await this.client.get<UEXApiResponse<T> | T>(path, { params });
      const body = response.data;

      if (body && typeof body === 'object' && 'data' in body && 'status' in body) {
        return body.data;
      }
      return body;
    } catch (error: unknown) {
      if (this.isAuthFailureResponse(error)) {
        this.markAuthFailureWindow();
      }
      throw error;
    }
  }

  /** Fetch price entries for a single commodity ID. */
  private async fetchCommodityPrices(commodityId: number): Promise<UEXCommodityPrice[]> {
    return this.fetchApi<UEXCommodityPrice[]>('/commodities_prices', {
      id_commodity: commodityId,
    });
  }

  /** Run an async operation through the circuit breaker. */
  private async withCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    return circuitBreakerService.execute(this.circuitBreakerName, operation, {
      timeout: 15_000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
    });
  }

  // ── Private: response mapping ───────────────────────────────────────────

  /** Convert a UEX commodity + its price entries to the unified UIFItem shape. */
  private mapCommodityToUIFItem(commodity: UEXCommodity, prices: UEXCommodityPrice[]): UIFItem {
    const locations: UIFItemLocation[] = [];

    for (const p of prices) {
      const baseLoc = {
        system: p.star_system_name,
        planet: p.planet_name,
        station: p.terminal_name,
        lastUpdated: p.date_modified ?? p.date_added,
      };

      if (p.price_buy !== null && p.price_buy !== undefined && p.price_buy > 0) {
        locations.push({
          ...baseLoc,
          location: p.terminal_name ?? `terminal_${p.id_terminal}`,
          price: p.price_buy,
          type: 'buy',
          inStock: (p.scu_buy ?? 0) > 0,
        });
      }

      if (p.price_sell !== null && p.price_sell !== undefined && p.price_sell > 0) {
        locations.push({
          ...baseLoc,
          location: p.terminal_name ?? `terminal_${p.id_terminal}`,
          price: p.price_sell,
          type: 'sell',
          inStock: true,
        });
      }
    }

    const priceValues = locations.map(l => l.price).filter((p): p is number => p !== null);
    const avg = priceValues.length
      ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
      : undefined;

    return {
      name: commodity.name,
      category: commodity.kind ?? 'Commodity',
      subCategory: undefined,
      description: undefined,
      locations,
      averagePrice: avg ? Math.round(avg * 100) / 100 : undefined,
      minPrice: priceValues.length ? Math.min(...priceValues) : undefined,
      maxPrice: priceValues.length ? Math.max(...priceValues) : undefined,
      lastUpdated: new Date(),
    };
  }

  /** Group flat price rows (from a terminal query) into UIFItems keyed by commodity. */
  private groupPricesByItem(prices: UEXCommodityPrice[]): UIFItem[] {
    const grouped = new Map<number, { name: string; kind: string; prices: UEXCommodityPrice[] }>();

    for (const p of prices) {
      const existing = grouped.get(p.id_commodity);
      if (existing) {
        existing.prices.push(p);
      } else {
        grouped.set(p.id_commodity, {
          name: p.commodity_name ?? `commodity_${p.id_commodity}`,
          kind: 'Commodity',
          prices: [p],
        });
      }
    }

    return Array.from(grouped.values()).map(({ name, kind, prices: plist }) => {
      const commodity: UEXCommodity = { id: 0, name, code: '', kind };
      return this.mapCommodityToUIFItem(commodity, plist);
    });
  }

  // ── Private: cache helpers ──────────────────────────────────────────────

  /**
   * Dual-layer cache read: in-memory Map → Redis → null.
   * Redis fills the Map on a hit so subsequent reads are fast.
   */
  private async getCached<T>(key: string): Promise<T | null> {
    // L2 — in-memory hot cache
    const memEntry = this.memCache.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < this.memCacheTtlMs) {
      return memEntry.data as T;
    }

    // L1 — Redis (gracefully returns null when unavailable)
    const redisKey = `${UEXPriceFeed.REDIS_PREFIX}${key}`;
    const redisValue = await cache.get<T>(redisKey);
    if (redisValue !== null) {
      // Populate in-memory cache from Redis
      this.memCache.set(key, { data: redisValue, timestamp: Date.now() });
      return redisValue;
    }

    return null;
  }

  /**
   * Stale cache fallback: returns expired in-memory data when the upstream API
   * is unavailable.  Does NOT touch Redis (avoids latency on failure path).
   */
  private getStaleCached<T>(key: string): T | null {
    const memEntry = this.memCache.get(key);
    if (memEntry) {
      return memEntry.data as T;
    }
    return null;
  }

  private async setCache(key: string, data: unknown): Promise<void> {
    // L2 — in-memory
    this.memCache.set(key, { data, timestamp: Date.now() });

    // L1 — Redis (fire-and-forget, graceful degradation built-in)
    const redisKey = `${UEXPriceFeed.REDIS_PREFIX}${key}`;
    await cache.set(redisKey, data, this.redisTtlSeconds);
  }

  // ── IHealthCheckable ──────────────────────────────────────────────────

  getServiceName(): string {
    return 'UEXPriceFeed';
  }

  async healthCheck(): Promise<ComponentHealth> {
    const start = Date.now();
    const status = this.getStatus();
    const redisStatus = cache.getStatus();

    let healthStatus: HealthStatus;
    if (!this.apiKey) {
      healthStatus = HealthStatus.UNKNOWN;
    } else if (status.healthy && redisStatus.connected) {
      healthStatus = HealthStatus.HEALTHY;
    } else if (status.healthy) {
      healthStatus = HealthStatus.DEGRADED;
    } else {
      healthStatus = HealthStatus.UNHEALTHY;
    }

    return {
      name: this.getServiceName(),
      status: healthStatus,
      message: this.resolveHealthMessage(healthStatus, redisStatus.connected),
      responseTime: Date.now() - start,
      details: status.details,
      lastCheck: new Date(),
    };
  }

  private resolveHealthMessage(healthStatus: HealthStatus, redisConnected: boolean): string {
    switch (healthStatus) {
      case HealthStatus.UNKNOWN:
        return 'UEX API credential not configured — price feed disabled';
      case HealthStatus.HEALTHY:
        return 'UEX price feed operational with Redis caching';
      case HealthStatus.DEGRADED:
        return redisConnected
          ? 'UEX price feed degraded — circuit breaker open'
          : 'UEX price feed operational — Redis unavailable, using in-memory cache only';
      case HealthStatus.UNHEALTHY:
        return 'UEX price feed unhealthy — circuit breaker open';
      default:
        return 'UEX price feed status unknown';
    }
  }
}

