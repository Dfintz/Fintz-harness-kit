"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UEXPriceFeed = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const securityUtils_1 = require("../../../utils/securityUtils");
const ServiceHealthMonitor_1 = require("../../health/ServiceHealthMonitor");
const infrastructure_1 = require("../../infrastructure");
class UEXPriceFeed {
    name = 'UEX';
    static TOP_ROUTES_CACHE_VERSION = 'v3';
    static TOP_ROUTES_MAX_AGE_DAYS = Number(process.env.UEX_TOP_ROUTES_MAX_AGE_DAYS) || 3;
    client;
    apiBaseUrl;
    apiKey;
    circuitBreakerName = 'uex-price-feed';
    authFailureCooldownMs;
    authFailureUntilMs = 0;
    authFailureWarningAtMs = 0;
    memCache = new Map();
    memCacheTtlMs;
    static REDIS_PREFIX = 'uex:';
    redisTtlSeconds;
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl ?? process.env.UEX_API_URL ?? 'https://api.uexcorp.uk/2.0';
        this.apiKey = this.resolveApiCredential();
        this.authFailureCooldownMs = Number(process.env.UEX_AUTH_FAILURE_COOLDOWN_MS) || 5 * 60 * 1000;
        const clientVersion = process.env.UEX_CLIENT_VERSION?.trim();
        this.redisTtlSeconds = Number(process.env.UEX_CACHE_TTL) || 900;
        this.memCacheTtlMs = this.redisTtlSeconds * 1000;
        this.client = axios_1.default.create({
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
            logger_1.logger.info(`UEXPriceFeed initialized — apiBaseUrl: ${this.apiBaseUrl}, API key configured`);
        }
        else {
            logger_1.logger.warn(`UEXPriceFeed initialized (no key) — apiBaseUrl: ${this.apiBaseUrl}, ` +
                'set UEX_API_KEY to enable live data');
        }
    }
    async searchItems(options) {
        if (!this.apiKey) {
            return [];
        }
        const cacheKey = `search:${JSON.stringify(options)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey) ?? [];
        }
        try {
            const items = await this.withCircuitBreaker(async () => {
                const params = {};
                if (options.query) {
                    params.name = options.query;
                }
                const commodities = await this.fetchApi('/commodities', params);
                if (!commodities.length) {
                    return [];
                }
                const limited = commodities.slice(0, options.maxResults ?? 50);
                const results = [];
                for (const commodity of limited) {
                    const prices = await this.fetchCommodityPrices(commodity.id);
                    results.push(this.mapCommodityToUIFItem(commodity, prices));
                }
                return results;
            });
            await this.setCache(cacheKey, items);
            return items;
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.searchItems', error, {
                query: options.query,
            });
            return [];
        }
    }
    async getItemDetails(itemName) {
        if (!this.apiKey) {
            return null;
        }
        const cacheKey = `item:${itemName.toLowerCase()}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey);
        }
        try {
            const item = await this.withCircuitBreaker(async () => {
                const commodities = await this.fetchApi('/commodities', {
                    name: itemName,
                });
                const commodity = commodities.find(c => c.name.toLowerCase() === itemName.toLowerCase()) ?? commodities[0];
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
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.getItemDetails', error, {
                itemName,
            });
            return null;
        }
    }
    async getItemPrices(itemName) {
        const item = await this.getItemDetails(itemName);
        return item?.locations ?? [];
    }
    async findBestBuyLocation(itemName, nearLocation) {
        const locations = await this.getItemPrices(itemName);
        const buyLocations = locations.filter(loc => loc.type === 'buy' && loc.price !== null && loc.inStock !== false);
        if (buyLocations.length === 0) {
            return null;
        }
        if (nearLocation) {
            const near = nearLocation.toLowerCase();
            const nearby = buyLocations.find(loc => loc.location.toLowerCase().includes(near) ||
                loc.system?.toLowerCase().includes(near) ||
                loc.planet?.toLowerCase().includes(near) ||
                loc.station?.toLowerCase().includes(near));
            if (nearby) {
                return nearby;
            }
        }
        return buyLocations.reduce((min, loc) => ((loc.price ?? Infinity) < (min.price ?? Infinity) ? loc : min), buyLocations[0]);
    }
    async findBestSellLocation(itemName, nearLocation) {
        const locations = await this.getItemPrices(itemName);
        const sellLocations = locations.filter(loc => loc.type === 'sell' && loc.price !== null);
        if (sellLocations.length === 0) {
            return null;
        }
        if (nearLocation) {
            const near = nearLocation.toLowerCase();
            const nearby = sellLocations.find(loc => loc.location.toLowerCase().includes(near) ||
                loc.system?.toLowerCase().includes(near) ||
                loc.planet?.toLowerCase().includes(near) ||
                loc.station?.toLowerCase().includes(near));
            if (nearby) {
                return nearby;
            }
        }
        return sellLocations.reduce((max, loc) => ((loc.price ?? 0) > (max.price ?? 0) ? loc : max), sellLocations[0]);
    }
    async comparePrices(itemName) {
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
    async getItemsAtLocation(location) {
        if (!this.apiKey) {
            return [];
        }
        const cacheKey = `location:${location.toLowerCase()}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey) ?? [];
        }
        try {
            const items = await this.withCircuitBreaker(async () => {
                const terminals = await this.fetchApi('/terminals', { name: location });
                const terminal = terminals.find(t => t.name.toLowerCase() === location.toLowerCase()) ?? terminals[0];
                if (!terminal) {
                    return [];
                }
                const prices = await this.fetchApi('/commodities_prices', {
                    id_terminal: terminal.id,
                });
                return this.groupPricesByItem(prices);
            });
            if (items.length) {
                await this.setCache(cacheKey, items);
            }
            return items;
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.getItemsAtLocation', error, {
                location,
            });
            return [];
        }
    }
    async getTradingOpportunities(from, to, minMargin = 0) {
        if (!this.apiKey) {
            return [];
        }
        const cacheKey = `opportunities:${from.toLowerCase()}:${to.toLowerCase()}:${minMargin}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey) ?? [];
        }
        try {
            const opportunities = await this.withCircuitBreaker(async () => {
                const [fromTerminals, toTerminals] = await Promise.all([
                    this.fetchApi('/terminals', { name: from }),
                    this.fetchApi('/terminals', { name: to }),
                ]);
                const fromTerminal = fromTerminals.find(t => t.name.toLowerCase() === from.toLowerCase()) ?? fromTerminals[0];
                const toTerminal = toTerminals.find(t => t.name.toLowerCase() === to.toLowerCase()) ?? toTerminals[0];
                if (!fromTerminal || !toTerminal) {
                    return [];
                }
                const [fromPrices, toPrices] = await Promise.all([
                    this.fetchApi('/commodities_prices', {
                        id_terminal: fromTerminal.id,
                    }),
                    this.fetchApi('/commodities_prices', {
                        id_terminal: toTerminal.id,
                    }),
                ]);
                const results = [];
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
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.getTradingOpportunities', error, {
                from,
                to,
                minMargin,
            });
            return [];
        }
    }
    async getTopTradeRoutes(limit = 25, minMargin = 5, filters) {
        if (!this.apiKey) {
            return [];
        }
        const maxAgeDays = UEXPriceFeed.TOP_ROUTES_MAX_AGE_DAYS;
        const freshnessCutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        const cacheKey = `top-routes:${UEXPriceFeed.TOP_ROUTES_CACHE_VERSION}:${maxAgeDays}:` +
            `${limit}:${minMargin}:${JSON.stringify(filters ?? {})}`;
        const cached = await this.getCached(cacheKey);
        if (cached) {
            const normalizedCached = this.filterRecentRoutes(this.normalizeTradeRoutes(cached), freshnessCutoffMs).slice(0, limit);
            if (normalizedCached.length > 0) {
                return normalizedCached;
            }
        }
        if (this.isAuthFailureCooldownActive()) {
            const stale = this.getStaleCached(cacheKey);
            if (stale) {
                return this.filterRecentRoutes(this.normalizeTradeRoutes(stale), freshnessCutoffMs).slice(0, limit);
            }
            return [];
        }
        try {
            const routes = await this.withCircuitBreaker(async () => {
                const routeApiRoutes = await this.getTopTradeRoutesFromCommodityRoutesApi(limit, minMargin, filters, freshnessCutoffMs);
                if (routeApiRoutes.length > 0) {
                    return routeApiRoutes;
                }
                const allPrices = await this.fetchApi('/commodities_prices_all');
                const recentPrices = allPrices.filter(price => this.isRecentPriceEntry(price, freshnessCutoffMs));
                const byCommodity = this.groupPricesByCommodity(recentPrices);
                const builtRoutes = this.buildTradeRoutes(byCommodity, minMargin, limit, filters);
                return this.filterRecentRoutes(this.normalizeTradeRoutes(builtRoutes), freshnessCutoffMs).slice(0, limit);
            });
            await this.setCache(cacheKey, routes);
            return routes;
        }
        catch (error) {
            const stale = this.getStaleCached(cacheKey);
            if (stale) {
                const normalizedStale = this.filterRecentRoutes(this.normalizeTradeRoutes(stale), freshnessCutoffMs).slice(0, limit);
                this.logUexRequestFailure('UEXPriceFeed.getTopTradeRoutes', error, {
                    fallback: 'stale-cache',
                    staleRoutes: normalizedStale.length,
                }, true);
                return normalizedStale;
            }
            this.logUexRequestFailure('UEXPriceFeed.getTopTradeRoutes', error, {
                fallback: 'empty',
            });
            return [];
        }
    }
    async calculateRouteProfit(stops) {
        if (!this.apiKey) {
            return 0;
        }
        if (this.isAuthFailureCooldownActive()) {
            return 0;
        }
        try {
            const transactions = new Map();
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
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.calculateRouteProfit', error);
            return 0;
        }
    }
    async lookupStopPrices(stop, transactions) {
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
    async getTerminalsList() {
        if (!this.apiKey) {
            return [];
        }
        const cacheKey = 'terminals-list';
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey) ?? [];
        }
        try {
            const terminals = await this.withCircuitBreaker(() => this.fetchApi('/terminals'));
            const result = terminals
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
        }
        catch (error) {
            const stale = this.getStaleCached(cacheKey);
            if (stale) {
                this.logUexRequestFailure('UEXPriceFeed.getTerminalsList', error, {
                    fallback: 'stale-cache',
                }, true);
                return stale;
            }
            this.logUexRequestFailure('UEXPriceFeed.getTerminalsList', error, {
                fallback: 'empty',
            });
            return [];
        }
    }
    async getCommoditiesList() {
        if (!this.apiKey) {
            return [];
        }
        const cacheKey = 'commodities-list';
        const cached = await this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        if (this.isAuthFailureCooldownActive()) {
            return this.getStaleCached(cacheKey) ?? [];
        }
        try {
            const commodities = await this.withCircuitBreaker(() => this.fetchApi('/commodities'));
            const result = commodities
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
        }
        catch (error) {
            const stale = this.getStaleCached(cacheKey);
            if (stale) {
                this.logUexRequestFailure('UEXPriceFeed.getCommoditiesList', error, {
                    fallback: 'stale-cache',
                }, true);
                return stale;
            }
            this.logUexRequestFailure('UEXPriceFeed.getCommoditiesList', error, {
                fallback: 'empty',
            });
            return [];
        }
    }
    clearCache() {
        this.memCache.clear();
        void redis_1.cache.delPattern(`${UEXPriceFeed.REDIS_PREFIX}*`);
        logger_1.logger.info('UEXPriceFeed cache cleared (memory + Redis)');
    }
    clearItemCache(itemName) {
        const prefix = `item:${itemName.toLowerCase()}`;
        for (const key of this.memCache.keys()) {
            if (key.startsWith(prefix)) {
                this.memCache.delete(key);
            }
        }
        void redis_1.cache.delPattern(`${UEXPriceFeed.REDIS_PREFIX}${prefix}*`);
    }
    getStatus() {
        const cbState = infrastructure_1.circuitBreakerService.getState(this.circuitBreakerName);
        const cbHealthy = cbState === null || infrastructure_1.circuitBreakerService.isHealthy(this.circuitBreakerName);
        const redisStatus = redis_1.cache.getStatus();
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
    resolveApiCredential() {
        const configuredCredential = process.env.UEX_API_KEY ?? process.env.UEX_API_TOKEN ?? process.env.UEX_API_BEARER_TOKEN;
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
    resolveStatusLabel(cbHealthy) {
        if (!this.apiKey) {
            return 'disabled — UEX API credential not set';
        }
        if (cbHealthy) {
            return 'operational';
        }
        return 'degraded — circuit breaker open';
    }
    isAuthFailureCooldownActive() {
        return Date.now() < this.authFailureUntilMs;
    }
    isAuthFailureResponse(error) {
        return (axios_1.default.isAxiosError(error) &&
            (error.response?.status === 401 || error.response?.status === 403));
    }
    markAuthFailureWindow() {
        const cooldownEndsAt = Date.now() + this.authFailureCooldownMs;
        if (cooldownEndsAt > this.authFailureUntilMs) {
            this.authFailureUntilMs = cooldownEndsAt;
        }
    }
    sanitizeUexErrorResponseData(data) {
        if (data === null || data === undefined) {
            return data;
        }
        if (typeof data === 'string') {
            return data.length > 500 ? `${data.slice(0, 500)}...` : data;
        }
        if (typeof data === 'object') {
            return (0, securityUtils_1.sanitizeObject)({ responseData: data }).responseData;
        }
        return data;
    }
    sanitizeUexError(error) {
        if (axios_1.default.isAxiosError(error)) {
            return (0, securityUtils_1.sanitizeObject)({
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
    logUexRequestFailure(methodName, error, context = {}, degraded = false) {
        const safeContext = (0, securityUtils_1.sanitizeObject)({
            ...context,
            error: this.sanitizeUexError(error),
        });
        if (this.isAuthFailureResponse(error)) {
            this.markAuthFailureWindow();
            const now = Date.now();
            if (now >= this.authFailureWarningAtMs) {
                this.authFailureWarningAtMs = now + this.authFailureCooldownMs;
                logger_1.logger.warn(`${methodName} upstream auth failed; enabling temporary cooldown`, {
                    ...safeContext,
                    retryAfterMs: Math.max(this.authFailureUntilMs - now, 0),
                });
            }
            return;
        }
        if (degraded) {
            logger_1.logger.warn(`${methodName} degraded`, safeContext);
            return;
        }
        logger_1.logger.error(`${methodName} failed`, safeContext);
    }
    groupPricesByCommodity(allPrices) {
        const byCommodity = new Map();
        for (const p of allPrices) {
            if (!byCommodity.has(p.id_commodity)) {
                byCommodity.set(p.id_commodity, {
                    buys: [],
                    sells: [],
                    name: p.commodity_name ?? `commodity_${p.id_commodity}`,
                    code: p.commodity_code ?? '',
                });
            }
            const entry = byCommodity.get(p.id_commodity);
            if (p.price_buy && p.price_buy > 0 && (p.scu_buy ?? 0) > 0) {
                entry.buys.push(p);
            }
            if (p.price_sell && p.price_sell > 0) {
                entry.sells.push(p);
            }
        }
        return byCommodity;
    }
    buildTradeRoutes(byCommodity, minMargin, limit, filters) {
        const results = [];
        for (const [, { buys, sells, name, code }] of byCommodity) {
            if (filters?.commodity && !name.toLowerCase().includes(filters.commodity.toLowerCase())) {
                continue;
            }
            const filteredBuys = this.applyLocationFilters(buys, filters?.starSystemStart, filters?.terminalStart);
            const filteredSells = this.applyLocationFilters(sells, filters?.starSystemEnd, filters?.terminalEnd);
            if (filteredBuys.length === 0 || filteredSells.length === 0) {
                continue;
            }
            const route = this.buildSingleRoute(filteredBuys, filteredSells, name, code, minMargin, filters);
            if (route) {
                results.push(route);
            }
        }
        results.sort((a, b) => b.profitPerScu - a.profitPerScu);
        return results.slice(0, limit);
    }
    async getTopTradeRoutesFromCommodityRoutesApi(limit, minMargin, filters, freshnessCutoffMs) {
        const params = await this.buildCommodityRoutesParams(filters);
        if (!params) {
            return [];
        }
        let routes = [];
        try {
            routes = await this.fetchApi('/commodities_routes', params);
        }
        catch (error) {
            this.logUexRequestFailure('UEXPriceFeed.getTopTradeRoutesFromCommodityRoutesApi', error, {
                params,
            }, true);
            return [];
        }
        if (!routes.length) {
            return [];
        }
        const normalized = routes
            .map(route => this.mapCommodityRouteToTradeRoute(route))
            .filter((route) => route !== null);
        const filtered = this.applyRouteTextFilters(normalized, filters)
            .filter(route => route.profitMargin >= minMargin)
            .sort((a, b) => b.profitPerScu - a.profitPerScu);
        return this.filterRecentRoutes(filtered, freshnessCutoffMs).slice(0, limit);
    }
    async buildCommodityRoutesParams(filters) {
        if (!filters) {
            return null;
        }
        const params = {};
        const commodityIdFromFilter = this.parsePositiveInt(filters.commodity);
        if (commodityIdFromFilter) {
            params.id_commodity = commodityIdFromFilter;
        }
        else if (filters.commodity) {
            const commodityId = await this.resolveCommodityId(filters.commodity);
            if (commodityId) {
                params.id_commodity = commodityId;
            }
        }
        const originTerminalIdFromFilter = this.parsePositiveInt(filters.terminalStart);
        if (originTerminalIdFromFilter) {
            params.id_terminal_origin = originTerminalIdFromFilter;
        }
        else if (filters.terminalStart) {
            const terminalId = await this.resolveTerminalId(filters.terminalStart, filters.starSystemStart);
            if (terminalId) {
                params.id_terminal_origin = terminalId;
            }
        }
        const destinationTerminalIdFromFilter = this.parsePositiveInt(filters.terminalEnd);
        if (destinationTerminalIdFromFilter) {
            params.id_terminal_destination = destinationTerminalIdFromFilter;
        }
        else if (filters.terminalEnd) {
            const terminalId = await this.resolveTerminalId(filters.terminalEnd, filters.starSystemEnd);
            if (terminalId) {
                params.id_terminal_destination = terminalId;
            }
        }
        if (filters.investment && filters.investment > 0) {
            params.investment = Math.floor(filters.investment);
        }
        if (!params.id_commodity && !params.id_terminal_origin) {
            return null;
        }
        return params;
    }
    mapCommodityRouteToTradeRoute(raw) {
        const buyPrice = this.toNumber(raw.price_origin) ?? 0;
        const sellPrice = this.toNumber(raw.price_destination) ?? 0;
        if (buyPrice <= 0 || sellPrice <= 0) {
            return null;
        }
        const profitPerScu = this.toNumber(raw.price_margin) ?? sellPrice - buyPrice;
        if (profitPerScu <= 0) {
            return null;
        }
        const profitMargin = this.toNumber(raw.price_roi) ?? (buyPrice > 0 ? (profitPerScu / buyPrice) * 100 : 0);
        const scuAvailable = this.toNumber(raw.scu_reachable) ?? 0;
        const maxProfit = this.toNumber(raw.profit) ?? profitPerScu * Math.max(scuAvailable, 0);
        const commodity = this.toString(raw.commodity_name) ?? `commodity_${raw.id_commodity}`;
        const commodityCode = this.toString(raw.commodity_code) ?? commodity.slice(0, 4).toUpperCase();
        const buyTerminal = this.toString(raw.origin_terminal_name) ??
            `terminal_${this.toString(raw.id_terminal_origin) ?? 'origin'}`;
        const sellTerminal = this.toString(raw.destination_terminal_name) ??
            `terminal_${this.toString(raw.id_terminal_destination) ?? 'destination'}`;
        const buyLocationParts = [
            this.toString(raw.origin_planet_name),
            this.toString(raw.origin_orbit_name),
        ].filter((part) => !!part);
        const sellLocationParts = [
            this.toString(raw.destination_planet_name),
            this.toString(raw.destination_orbit_name),
        ].filter((part) => !!part);
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
    applyRouteTextFilters(routes, filters) {
        if (!filters) {
            return routes;
        }
        const hasNumericCommodityId = this.parsePositiveInt(filters.commodity) !== undefined;
        return routes.filter(route => {
            if (filters.commodity && !hasNumericCommodityId) {
                const query = filters.commodity.toLowerCase();
                const commodityMatch = route.commodity.toLowerCase().includes(query) ||
                    route.commodityCode.toLowerCase().includes(query);
                if (!commodityMatch) {
                    return false;
                }
            }
            if (filters.starSystemStart &&
                !route.buySystem.toLowerCase().includes(filters.starSystemStart.toLowerCase())) {
                return false;
            }
            if (filters.starSystemEnd &&
                !route.sellSystem.toLowerCase().includes(filters.starSystemEnd.toLowerCase())) {
                return false;
            }
            if (filters.terminalStart &&
                !route.buyTerminal.toLowerCase().includes(filters.terminalStart.toLowerCase())) {
                return false;
            }
            if (filters.terminalEnd &&
                !route.sellTerminal.toLowerCase().includes(filters.terminalEnd.toLowerCase())) {
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
    filterRecentRoutes(routes, cutoffMs) {
        return routes.filter(route => {
            const updatedAtMs = this.toTimestampMs(route.lastUpdated);
            return updatedAtMs !== undefined && updatedAtMs >= cutoffMs;
        });
    }
    isRecentPriceEntry(price, cutoffMs) {
        const updatedAtMs = this.toTimestampMs(price.date_modified ?? price.date_added);
        return updatedAtMs !== undefined && updatedAtMs >= cutoffMs;
    }
    parsePositiveInt(value) {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return undefined;
        }
        const parsed = Number(String(value).trim());
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return undefined;
        }
        return parsed;
    }
    async resolveCommodityId(search) {
        const query = search.trim().toLowerCase();
        if (!query) {
            return undefined;
        }
        const commodities = await this.getCommoditiesList();
        if (!commodities.length) {
            return undefined;
        }
        const exactMatch = commodities.find(commodity => commodity.name.toLowerCase() === query || commodity.code.toLowerCase() === query);
        if (exactMatch) {
            return exactMatch.id;
        }
        return commodities.find(commodity => commodity.name.toLowerCase().includes(query) || commodity.code.toLowerCase().includes(query))?.id;
    }
    async resolveTerminalId(search, starSystem) {
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
        const exactMatch = terminals.find(terminal => terminal.name.toLowerCase() === query || terminal.code.toLowerCase() === query);
        if (exactMatch) {
            return exactMatch.id;
        }
        return terminals.find(terminal => terminal.name.toLowerCase().includes(query) || terminal.code.toLowerCase().includes(query))?.id;
    }
    normalizeTradeRoutes(raw) {
        const routeEntries = this.extractRouteEntries(raw);
        return routeEntries
            .map(route => this.normalizeTradeRoute(route))
            .filter((route) => route !== null);
    }
    extractRouteEntries(raw) {
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
    normalizeTradeRoute(raw) {
        const routeRecord = this.asRecord(raw);
        if (!routeRecord) {
            return null;
        }
        const buyRecord = this.asRecord(routeRecord.buy) ?? {};
        const sellRecord = this.asRecord(routeRecord.sell) ?? {};
        const commodity = this.toString(this.getFirstDefinedValue(routeRecord, [
            'commodity',
            'commodity_name',
            'commodityName',
            'item',
        ])) ?? 'Unknown Commodity';
        const commodityCode = this.toString(this.getFirstDefinedValue(routeRecord, ['commodityCode', 'commodity_code', 'code'])) ?? commodity.slice(0, 4).toUpperCase();
        const buyTerminal = this.toString(this.getFirstDefinedValue(routeRecord, ['buyTerminal', 'buy_terminal', 'fromTerminal'])) ??
            this.toString(this.getFirstDefinedValue(buyRecord, ['terminal', 'terminal_name', 'name'])) ??
            'Unknown Buy Terminal';
        const sellTerminal = this.toString(this.getFirstDefinedValue(routeRecord, ['sellTerminal', 'sell_terminal', 'toTerminal'])) ??
            this.toString(this.getFirstDefinedValue(sellRecord, ['terminal', 'terminal_name', 'name'])) ??
            'Unknown Sell Terminal';
        const buyPrice = this.toNumber(this.getFirstDefinedValue(routeRecord, ['buyPrice', 'buy_price', 'price_buy'])) ??
            this.toNumber(this.getFirstDefinedValue(buyRecord, ['price', 'buyPrice', 'price_buy'])) ??
            0;
        const sellPrice = this.toNumber(this.getFirstDefinedValue(routeRecord, ['sellPrice', 'sell_price', 'price_sell'])) ??
            this.toNumber(this.getFirstDefinedValue(sellRecord, ['price', 'sellPrice', 'price_sell'])) ??
            0;
        if (buyPrice <= 0 || sellPrice <= 0) {
            return null;
        }
        const resolvedProfitPerScu = this.toNumber(this.getFirstDefinedValue(routeRecord, ['profitPerScu', 'profit_per_scu', 'profit'])) ??
            this.toNumber(this.getFirstDefinedValue(routeRecord, ['profitPerUnit', 'profit_per_unit'])) ??
            (buyPrice > 0 && sellPrice > 0 ? sellPrice - buyPrice : 0);
        const resolvedProfitMargin = this.toNumber(this.getFirstDefinedValue(routeRecord, ['profitMargin', 'profit_margin', 'margin'])) ?? (buyPrice > 0 ? (resolvedProfitPerScu / buyPrice) * 100 : 0);
        const scuAvailable = this.toNumber(this.getFirstDefinedValue(routeRecord, [
            'scuAvailable',
            'scu_available',
            'availableScu',
            'scu',
            'scu_buy',
        ])) ??
            this.toNumber(this.getFirstDefinedValue(buyRecord, ['scu', 'scu_buy', 'available'])) ??
            0;
        const maxProfit = this.toNumber(this.getFirstDefinedValue(routeRecord, ['maxProfit', 'max_profit'])) ??
            resolvedProfitPerScu * scuAvailable;
        const buyLocation = this.toString(this.getFirstDefinedValue(routeRecord, ['buyLocation', 'buy_location', 'fromLocation'])) ??
            this.toString(this.getFirstDefinedValue(buyRecord, ['location', 'location_name'])) ??
            buyTerminal;
        const sellLocation = this.toString(this.getFirstDefinedValue(routeRecord, ['sellLocation', 'sell_location', 'toLocation'])) ??
            this.toString(this.getFirstDefinedValue(sellRecord, ['location', 'location_name'])) ??
            sellTerminal;
        const buySystem = this.toString(this.getFirstDefinedValue(routeRecord, ['buySystem', 'buy_system', 'fromSystem'])) ??
            this.toString(this.getFirstDefinedValue(buyRecord, ['system', 'star_system_name'])) ??
            '';
        const sellSystem = this.toString(this.getFirstDefinedValue(routeRecord, ['sellSystem', 'sell_system', 'toSystem'])) ??
            this.toString(this.getFirstDefinedValue(sellRecord, ['system', 'star_system_name'])) ??
            '';
        const lastUpdated = this.toIsoString(this.getFirstDefinedValue(routeRecord, [
            'lastUpdated',
            'last_updated',
            'updatedAt',
            'date_added',
            'date_modified',
            'dateModified',
        ])) ??
            this.toIsoString(this.getFirstDefinedValue(buyRecord, ['date_modified', 'dateModified', 'date_added'])) ??
            this.toIsoString(this.getFirstDefinedValue(sellRecord, ['date_modified', 'dateModified', 'date_added'])) ??
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
    asRecord(value) {
        if (!value || typeof value !== 'object') {
            return null;
        }
        return value;
    }
    getFirstDefinedValue(source, keys) {
        for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
        return undefined;
    }
    toNumber(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : undefined;
        }
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
    }
    toString(value) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
        return undefined;
    }
    toIsoString(value) {
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
    toTimestampMs(value) {
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
    getMostRecentIsoTimestamp(values) {
        let mostRecentMs;
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
    applyLocationFilters(prices, starSystem, terminal) {
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
    buildSingleRoute(buys, sells, name, code, minMargin, filters) {
        const bestBuy = buys.reduce((min, p) => (p.price_buy < min.price_buy ? p : min), buys[0]);
        const bestSell = sells.reduce((max, p) => (p.price_sell > max.price_sell ? p : max), sells[0]);
        if (bestBuy.id_terminal === bestSell.id_terminal) {
            return null;
        }
        const profitPerScu = bestSell.price_sell - bestBuy.price_buy;
        if (profitPerScu <= 0) {
            return null;
        }
        const profitMargin = (profitPerScu / bestBuy.price_buy) * 100;
        if (profitMargin < minMargin) {
            return null;
        }
        if (filters?.investment && bestBuy.price_buy > filters.investment) {
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
            buyPrice: bestBuy.price_buy,
            buySystem: bestBuy.star_system_name ?? '',
            sellTerminal: bestSell.terminal_name ?? `terminal_${bestSell.id_terminal}`,
            sellLocation: (sellLocation || bestSell.terminal_name) ?? '',
            sellPrice: bestSell.price_sell,
            sellSystem: bestSell.star_system_name ?? '',
            profitPerScu,
            profitMargin: Math.round(profitMargin * 100) / 100,
            scuAvailable,
            maxProfit: profitPerScu * scuAvailable,
            lastUpdated,
        };
    }
    async fetchApi(path, params) {
        try {
            const response = await this.client.get(path, { params });
            const body = response.data;
            if (body && typeof body === 'object' && 'data' in body && 'status' in body) {
                return body.data;
            }
            return body;
        }
        catch (error) {
            if (this.isAuthFailureResponse(error)) {
                this.markAuthFailureWindow();
            }
            throw error;
        }
    }
    async fetchCommodityPrices(commodityId) {
        return this.fetchApi('/commodities_prices', {
            id_commodity: commodityId,
        });
    }
    async withCircuitBreaker(operation) {
        return infrastructure_1.circuitBreakerService.execute(this.circuitBreakerName, operation, {
            timeout: 15_000,
            errorThresholdPercentage: 50,
            resetTimeout: 30_000,
            volumeThreshold: 5,
        });
    }
    mapCommodityToUIFItem(commodity, prices) {
        const locations = [];
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
        const priceValues = locations.map(l => l.price).filter((p) => p !== null);
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
    groupPricesByItem(prices) {
        const grouped = new Map();
        for (const p of prices) {
            const existing = grouped.get(p.id_commodity);
            if (existing) {
                existing.prices.push(p);
            }
            else {
                grouped.set(p.id_commodity, {
                    name: p.commodity_name ?? `commodity_${p.id_commodity}`,
                    kind: 'Commodity',
                    prices: [p],
                });
            }
        }
        return Array.from(grouped.values()).map(({ name, kind, prices: plist }) => {
            const commodity = { id: 0, name, code: '', kind };
            return this.mapCommodityToUIFItem(commodity, plist);
        });
    }
    async getCached(key) {
        const memEntry = this.memCache.get(key);
        if (memEntry && Date.now() - memEntry.timestamp < this.memCacheTtlMs) {
            return memEntry.data;
        }
        const redisKey = `${UEXPriceFeed.REDIS_PREFIX}${key}`;
        const redisValue = await redis_1.cache.get(redisKey);
        if (redisValue !== null) {
            this.memCache.set(key, { data: redisValue, timestamp: Date.now() });
            return redisValue;
        }
        return null;
    }
    getStaleCached(key) {
        const memEntry = this.memCache.get(key);
        if (memEntry) {
            return memEntry.data;
        }
        return null;
    }
    async setCache(key, data) {
        this.memCache.set(key, { data, timestamp: Date.now() });
        const redisKey = `${UEXPriceFeed.REDIS_PREFIX}${key}`;
        await redis_1.cache.set(redisKey, data, this.redisTtlSeconds);
    }
    getServiceName() {
        return 'UEXPriceFeed';
    }
    async healthCheck() {
        const start = Date.now();
        const status = this.getStatus();
        const redisStatus = redis_1.cache.getStatus();
        let healthStatus;
        if (!this.apiKey) {
            healthStatus = ServiceHealthMonitor_1.HealthStatus.UNKNOWN;
        }
        else if (status.healthy && redisStatus.connected) {
            healthStatus = ServiceHealthMonitor_1.HealthStatus.HEALTHY;
        }
        else if (status.healthy) {
            healthStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
        }
        else {
            healthStatus = ServiceHealthMonitor_1.HealthStatus.UNHEALTHY;
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
    resolveHealthMessage(healthStatus, redisConnected) {
        switch (healthStatus) {
            case ServiceHealthMonitor_1.HealthStatus.UNKNOWN:
                return 'UEX API credential not configured — price feed disabled';
            case ServiceHealthMonitor_1.HealthStatus.HEALTHY:
                return 'UEX price feed operational with Redis caching';
            case ServiceHealthMonitor_1.HealthStatus.DEGRADED:
                return redisConnected
                    ? 'UEX price feed degraded — circuit breaker open'
                    : 'UEX price feed operational — Redis unavailable, using in-memory cache only';
            case ServiceHealthMonitor_1.HealthStatus.UNHEALTHY:
                return 'UEX price feed unhealthy — circuit breaker open';
            default:
                return 'UEX price feed status unknown';
        }
    }
}
exports.UEXPriceFeed = UEXPriceFeed;
//# sourceMappingURL=UEXPriceFeed.js.map