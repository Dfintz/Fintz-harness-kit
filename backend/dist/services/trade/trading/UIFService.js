"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uifService = exports.UIFService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
const infrastructure_1 = require("../../infrastructure");
const MOCK_ITEMS = [
    {
        name: 'Laranite',
        category: 'Commodity',
        subCategory: 'Minerals',
        description: 'A valuable mineral used in quantum fuel production',
        locations: [
            {
                location: 'Lathan',
                system: 'Stanton',
                station: 'Covalex Hub',
                price: 27.89,
                type: 'buy',
                inStock: true,
            },
            {
                location: 'Area 18',
                system: 'Stanton',
                planet: 'ArcCorp',
                price: 31.25,
                type: 'sell',
                inStock: true,
            },
            {
                location: 'Lorville',
                system: 'Stanton',
                planet: 'Hurston',
                price: 30.5,
                type: 'sell',
                inStock: true,
            },
        ],
        averagePrice: 29.88,
        minPrice: 27.89,
        maxPrice: 31.25,
        lastUpdated: new Date(),
    },
    {
        name: 'Agricium',
        category: 'Commodity',
        subCategory: 'Minerals',
        description: 'Rare agricultural mineral',
        locations: [
            {
                location: 'Bezdek',
                system: 'Stanton',
                station: 'Mining Facility',
                price: 23.5,
                type: 'buy',
                inStock: true,
            },
            {
                location: 'New Babbage',
                system: 'Stanton',
                planet: 'microTech',
                price: 27.15,
                type: 'sell',
                inStock: true,
            },
        ],
        averagePrice: 25.32,
        minPrice: 23.5,
        maxPrice: 27.15,
        lastUpdated: new Date(),
    },
    {
        name: 'Titanium',
        category: 'Commodity',
        subCategory: 'Metals',
        description: 'Industrial metal for ship construction',
        locations: [
            { location: 'Deakins Research', system: 'Stanton', price: 8.25, type: 'buy', inStock: true },
            {
                location: 'Port Olisar',
                system: 'Stanton',
                station: 'Port Olisar',
                price: 9.5,
                type: 'sell',
                inStock: true,
            },
        ],
        averagePrice: 8.87,
        minPrice: 8.25,
        maxPrice: 9.5,
        lastUpdated: new Date(),
    },
    {
        name: 'Medical Supplies',
        category: 'Commodity',
        subCategory: 'Medical',
        description: 'Essential medical equipment and supplies',
        locations: [
            {
                location: 'Orison',
                system: 'Stanton',
                planet: 'Crusader',
                price: 17.89,
                type: 'buy',
                inStock: true,
            },
            {
                location: 'GrimHEX',
                system: 'Stanton',
                station: 'GrimHEX',
                price: 21.5,
                type: 'sell',
                inStock: true,
            },
        ],
        averagePrice: 19.69,
        minPrice: 17.89,
        maxPrice: 21.5,
        lastUpdated: new Date(),
    },
    {
        name: 'Quantum Fuel',
        category: 'Fuel',
        description: 'Refined quantum fuel for ship travel',
        locations: [
            {
                location: 'CRU-L1',
                system: 'Stanton',
                station: 'Ambitious Dream',
                price: 1.5,
                type: 'buy',
                inStock: true,
            },
            {
                location: 'Port Tressler',
                system: 'Stanton',
                station: 'Port Tressler',
                price: 1.65,
                type: 'buy',
                inStock: true,
            },
        ],
        averagePrice: 1.57,
        minPrice: 1.5,
        maxPrice: 1.65,
        lastUpdated: new Date(),
    },
];
class UIFService {
    baseURL;
    client;
    cache;
    cacheDuration = 3600000;
    useMockData = false;
    apiAvailable = true;
    lastApiCheck = 0;
    apiCheckInterval = 300000;
    circuitBreakerName = 'uif-api';
    constructor() {
        this.baseURL = process.env.UIF_API_URL || 'https://finder.cstone.space';
        this.cache = new Map();
        this.useMockData = process.env.UIF_USE_MOCK === 'true';
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SC-Fleet-Manager/1.0',
            },
        });
        this.client.interceptors.response.use(response => response, (error) => {
            logger_1.logger.error('UIF API Error:', {
                url: error.config?.url,
                status: error.response?.status,
                message: error.message,
            });
            throw error;
        });
        if (this.useMockData) {
            logger_1.logger.info('UIFService initialized in MOCK mode');
        }
        else {
            logger_1.logger.info(`UIFService initialized with API URL: ${this.baseURL} (circuit breaker enabled)`);
        }
    }
    getCircuitStatus() {
        const state = infrastructure_1.circuitBreakerService.getState(this.circuitBreakerName);
        return {
            name: this.circuitBreakerName,
            state,
            healthy: infrastructure_1.circuitBreakerService.isHealthy(this.circuitBreakerName),
        };
    }
    async checkApiAvailability() {
        const now = Date.now();
        if (now - this.lastApiCheck < this.apiCheckInterval) {
            return this.apiAvailable;
        }
        this.lastApiCheck = now;
        if (!infrastructure_1.circuitBreakerService.isHealthy(this.circuitBreakerName)) {
            logger_1.logger.warn('UIF API circuit breaker is open, using mock data');
            this.apiAvailable = false;
            return false;
        }
        try {
            await this.client.get('/api/health', { timeout: 5000 });
            this.apiAvailable = true;
            return true;
        }
        catch {
            logger_1.logger.warn('UIF API not available, falling back to mock data');
            this.apiAvailable = false;
            return false;
        }
    }
    async executeWithCircuitBreaker(operation, fallback) {
        try {
            return await infrastructure_1.circuitBreakerService.execute(this.circuitBreakerName, operation, {
                timeout: 15000,
                errorThresholdPercentage: 50,
                resetTimeout: 30000,
                volumeThreshold: 5,
            }, fallback);
        }
        catch (_error) {
            logger_1.logger.warn('UIF API call failed through circuit breaker, using fallback');
            return fallback();
        }
    }
    async searchItems(options) {
        try {
            const cacheKey = `search:${JSON.stringify(options)}`;
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            if (this.useMockData || !(await this.checkApiAvailability())) {
                return this.searchMockItems(options);
            }
            const items = await this.executeWithCircuitBreaker(async () => {
                const response = await this.client.get('/api/items/search', {
                    params: {
                        q: options.query,
                        category: options.category,
                        location: options.location,
                        limit: options.maxResults || 50,
                    },
                });
                return this.parseItems(response.data);
            }, () => this.searchMockItems(options));
            try {
                this.setCache(cacheKey, items);
            }
            catch (cacheError) {
                logger_1.logger.warn('Failed to cache search results:', cacheError);
            }
            return items;
        }
        catch (error) {
            logger_1.logger.error('Error searching items in UIF:', error);
            return this.searchMockItems(options);
        }
    }
    searchMockItems(options) {
        const query = options.query.toLowerCase();
        const category = options.category?.toLowerCase();
        const location = options.location?.toLowerCase();
        const maxResults = options.maxResults || 50;
        const results = MOCK_ITEMS.filter(item => {
            if (query &&
                !item.name.toLowerCase().includes(query) &&
                !item.description?.toLowerCase().includes(query)) {
                return false;
            }
            if (category && item.category.toLowerCase() !== category) {
                return false;
            }
            if (location) {
                const hasLocation = item.locations.some(loc => loc.location.toLowerCase().includes(location) ||
                    loc.system?.toLowerCase().includes(location) ||
                    loc.planet?.toLowerCase().includes(location) ||
                    loc.station?.toLowerCase().includes(location));
                if (!hasLocation) {
                    return false;
                }
            }
            return true;
        });
        return results.slice(0, maxResults);
    }
    async getItemDetails(itemName) {
        try {
            const cacheKey = `item:${itemName}`;
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            if (this.useMockData || !(await this.checkApiAvailability())) {
                const mockItem = this.getMockItemDetails(itemName);
                if (mockItem) {
                    this.setCache(cacheKey, mockItem);
                }
                return mockItem;
            }
            const item = await this.executeWithCircuitBreaker(async () => {
                const response = await this.client.get(`/api/items/${encodeURIComponent(itemName)}`);
                return this.parseItem(response.data);
            }, () => this.getMockItemDetails(itemName));
            if (item) {
                this.setCache(cacheKey, item);
            }
            return item;
        }
        catch (error) {
            logger_1.logger.error(`Error getting item details for ${itemName}:`, error);
            const mockItem = this.getMockItemDetails(itemName);
            if (mockItem) {
                const cacheKey = `item:${itemName}`;
                this.setCache(cacheKey, mockItem);
            }
            return mockItem;
        }
    }
    getMockItemDetails(itemName) {
        const normalizedName = itemName.toLowerCase();
        const found = MOCK_ITEMS.find(item => item.name.toLowerCase() === normalizedName ||
            item.name.toLowerCase().includes(normalizedName));
        return found ? JSON.parse(JSON.stringify(found)) : null;
    }
    async getItemPrices(itemName) {
        try {
            const item = await this.getItemDetails(itemName);
            return item?.locations || [];
        }
        catch (error) {
            logger_1.logger.error(`Error getting prices for ${itemName}:`, error);
            return [];
        }
    }
    async findBestBuyLocation(itemName, nearLocation) {
        try {
            const locations = await this.getItemPrices(itemName);
            const buyLocations = locations.filter(loc => loc.type === 'buy' && loc.price && loc.inStock !== false);
            if (buyLocations.length === 0) {
                return null;
            }
            if (nearLocation) {
                const nearbyLocation = buyLocations.find(loc => loc.location.toLowerCase().includes(nearLocation.toLowerCase()) ||
                    loc.system?.toLowerCase().includes(nearLocation.toLowerCase()));
                if (nearbyLocation) {
                    return nearbyLocation;
                }
            }
            return buyLocations.reduce((min, loc) => (loc.price ?? Infinity) < (min.price ?? Infinity) ? loc : min);
        }
        catch (error) {
            logger_1.logger.error(`Error finding best buy location for ${itemName}:`, error);
            return null;
        }
    }
    async findBestSellLocation(itemName, nearLocation) {
        try {
            const locations = await this.getItemPrices(itemName);
            const sellLocations = locations.filter(loc => loc.type === 'sell' && loc.price);
            if (sellLocations.length === 0) {
                return null;
            }
            if (nearLocation) {
                const nearbyLocation = sellLocations.find(loc => loc.location.toLowerCase().includes(nearLocation.toLowerCase()) ||
                    loc.system?.toLowerCase().includes(nearLocation.toLowerCase()));
                if (nearbyLocation) {
                    return nearbyLocation;
                }
            }
            return sellLocations.reduce((max, loc) => ((loc.price ?? 0) > (max.price ?? 0) ? loc : max));
        }
        catch (error) {
            logger_1.logger.error(`Error finding best sell location for ${itemName}:`, error);
            return null;
        }
    }
    async comparePrices(itemName) {
        try {
            const bestBuy = await this.findBestBuyLocation(itemName);
            const bestSell = await this.findBestSellLocation(itemName);
            if (!bestBuy || !bestSell || !bestBuy.price || !bestSell.price) {
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
        catch (error) {
            logger_1.logger.error(`Error comparing prices for ${itemName}:`, error);
            return null;
        }
    }
    async getItemsByCategory(category) {
        try {
            const cacheKey = `category:${category}`;
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await this.client.get(`/api/categories/${encodeURIComponent(category)}/items`);
            const items = this.parseItems(response.data);
            this.setCache(cacheKey, items);
            return items;
        }
        catch (error) {
            logger_1.logger.error(`Error getting items for category ${category}:`, error);
            return [];
        }
    }
    async getItemsAtLocation(location) {
        try {
            const cacheKey = `location:${location}`;
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await this.client.get('/api/locations', {
                params: { location },
            });
            const items = this.parseItems(response.data);
            this.setCache(cacheKey, items);
            return items;
        }
        catch (error) {
            logger_1.logger.error(`Error getting items at location ${location}:`, error);
            return [];
        }
    }
    async getTradingOpportunities(fromLocation, toLocation, minProfitMargin = 10) {
        try {
            const itemsAtFrom = await this.getItemsAtLocation(fromLocation);
            const opportunities = [];
            for (const item of itemsAtFrom) {
                const comparison = await this.comparePrices(item.name);
                if (comparison?.profitMargin && comparison.profitMargin >= minProfitMargin) {
                    opportunities.push(comparison);
                }
            }
            return opportunities.sort((a, b) => (b.profitMargin ?? 0) - (a.profitMargin ?? 0));
        }
        catch (error) {
            logger_1.logger.error(`Error getting trading opportunities from ${fromLocation} to ${toLocation}:`, error);
            return [];
        }
    }
    updateItemPrice(itemName, location, price, type) {
        try {
            const cacheKey = `item:${itemName}`;
            const cached = this.cache.get(cacheKey);
            if (cached?.data) {
                const item = cached.data;
                const locationIndex = item.locations.findIndex(loc => loc.location === location && loc.type === type);
                if (locationIndex >= 0 && item.locations[locationIndex]) {
                    item.locations[locationIndex].price = price;
                    item.locations[locationIndex].lastUpdated = new Date().toISOString();
                }
                else {
                    item.locations.push({
                        location,
                        price,
                        type,
                        inStock: true,
                        lastUpdated: new Date().toISOString(),
                    });
                }
                this.setCache(cacheKey, item);
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating item price:', error);
        }
    }
    parseItem(data) {
        try {
            return {
                name: data.name || data.itemName,
                category: data.category,
                subCategory: data.subCategory,
                description: data.description,
                manufacturer: data.manufacturer,
                size: data.size,
                grade: data.grade,
                locations: data.locations || [],
                averagePrice: data.averagePrice,
                minPrice: data.minPrice,
                maxPrice: data.maxPrice,
                lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
            };
        }
        catch (error) {
            logger_1.logger.error('Error parsing item data:', error);
            return null;
        }
    }
    parseItems(data) {
        try {
            if (Array.isArray(data)) {
                return data
                    .map(item => this.parseItem(item))
                    .filter(item => item !== null);
            }
            else if (data && typeof data === 'object' && 'items' in data) {
                const items = data.items;
                if (Array.isArray(items)) {
                    return items
                        .map((item) => this.parseItem(item))
                        .filter((item) => item !== null);
                }
            }
            return [];
        }
        catch (error) {
            logger_1.logger.error('Error parsing items data:', error);
            return [];
        }
    }
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }
        return null;
    }
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }
    clearCache() {
        this.cache.clear();
        logger_1.logger.info('UIF service cache cleared');
    }
    clearItemCache(itemName) {
        this.cache.delete(`item:${itemName}`);
    }
}
exports.UIFService = UIFService;
exports.uifService = new UIFService();
//# sourceMappingURL=UIFService.js.map