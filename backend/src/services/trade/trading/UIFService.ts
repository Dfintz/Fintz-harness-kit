import axios, { AxiosError, AxiosInstance } from 'axios';

import { logger } from '../../../utils/logger';
import { circuitBreakerService } from '../../infrastructure';

/**
 * Universal Item Finder (UIF) Service
 * Integrates with https://finder.cstone.space/ API for Star Citizen item prices and locations
 *
 * UPDATED: Now includes proper mock fallback when API is unavailable
 */

export interface UIFItemLocation {
  location: string;
  system?: string;
  planet?: string;
  station?: string;
  shop?: string;
  price?: number;
  type: 'buy' | 'sell';
  inStock?: boolean;
  lastUpdated?: string;
}

export interface UIFItem {
  name: string;
  category: string;
  subCategory?: string;
  description?: string;
  manufacturer?: string;
  size?: string;
  grade?: string;
  locations: UIFItemLocation[];
  averagePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  lastUpdated?: Date;
}

export interface UIFSearchOptions {
  query: string;
  category?: string;
  location?: string;
  maxResults?: number;
}

export interface UIFPriceComparison {
  item: string;
  bestBuyLocation?: UIFItemLocation;
  bestSellLocation?: UIFItemLocation;
  potentialProfit?: number;
  profitMargin?: number;
}

/**
 * Mock data for when UIF API is unavailable
 */
const MOCK_ITEMS: UIFItem[] = [
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

export class UIFService {
  private baseURL: string;
  private client: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }>;
  private cacheDuration: number = 3600000; // 1 hour in milliseconds
  private useMockData: boolean = false;
  private apiAvailable: boolean = true;
  private lastApiCheck: number = 0;
  private apiCheckInterval: number = 300000; // 5 minutes
  private readonly circuitBreakerName = 'uif-api';

  constructor() {
    this.baseURL = process.env.UIF_API_URL || 'https://finder.cstone.space';
    this.cache = new Map();
    this.useMockData = process.env.UIF_USE_MOCK === 'true';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SC-Fleet-Manager/1.0',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error('UIF API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    );

    // Log initialization mode
    if (this.useMockData) {
      logger.info('UIFService initialized in MOCK mode');
    } else {
      logger.info(`UIFService initialized with API URL: ${this.baseURL} (circuit breaker enabled)`);
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  public getCircuitStatus(): { name: string; state: string | null; healthy: boolean } {
    const state = circuitBreakerService.getState(this.circuitBreakerName);
    return {
      name: this.circuitBreakerName,
      state,
      healthy: circuitBreakerService.isHealthy(this.circuitBreakerName),
    };
  }

  /**
   * Check if UIF API is available
   */
  private async checkApiAvailability(): Promise<boolean> {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastApiCheck < this.apiCheckInterval) {
      return this.apiAvailable;
    }

    this.lastApiCheck = now;

    // Check if circuit breaker is open
    if (!circuitBreakerService.isHealthy(this.circuitBreakerName)) {
      logger.warn('UIF API circuit breaker is open, using mock data');
      this.apiAvailable = false;
      return false;
    }

    try {
      await this.client.get('/api/health', { timeout: 5000 });
      this.apiAvailable = true;
      return true;
    } catch {
      logger.warn('UIF API not available, falling back to mock data');
      this.apiAvailable = false;
      return false;
    }
  }

  /**
   * Execute API call through circuit breaker
   */
  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    try {
      return await circuitBreakerService.execute(
        this.circuitBreakerName,
        operation,
        {
          timeout: 15000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
          volumeThreshold: 5,
        },
        fallback
      );
    } catch (_error: unknown) {
      logger.warn('UIF API call failed through circuit breaker, using fallback');
      return fallback();
    }
  }

  /**
   * Search for items by name or category
   */
  public async searchItems(options: UIFSearchOptions): Promise<UIFItem[]> {
    try {
      const cacheKey = `search:${JSON.stringify(options)}`;
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached as UIFItem[];
      }

      // Check if we should use mock data
      if (this.useMockData || !(await this.checkApiAvailability())) {
        return this.searchMockItems(options);
      }

      // Execute through circuit breaker
      const items = await this.executeWithCircuitBreaker(
        async () => {
          const response = await this.client.get('/api/items/search', {
            params: {
              q: options.query,
              category: options.category,
              location: options.location,
              limit: options.maxResults || 50,
            },
          });
          return this.parseItems(response.data);
        },
        () => this.searchMockItems(options)
      );

      // Cache results (non-critical, log and continue on failure)
      try {
        this.setCache(cacheKey, items);
      } catch (cacheError: unknown) {
        logger.warn('Failed to cache search results:', cacheError);
      }
      return items;
    } catch (error: unknown) {
      logger.error('Error searching items in UIF:', error);
      // Fallback to mock data on error
      return this.searchMockItems(options);
    }
  }

  /**
   * Search mock items
   */
  private searchMockItems(options: UIFSearchOptions): UIFItem[] {
    const query = options.query.toLowerCase();
    const category = options.category?.toLowerCase();
    const location = options.location?.toLowerCase();
    const maxResults = options.maxResults || 50;

    const results = MOCK_ITEMS.filter(item => {
      // Filter by query
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.description?.toLowerCase().includes(query)
      ) {
        return false;
      }

      // Filter by category
      if (category && item.category.toLowerCase() !== category) {
        return false;
      }

      // Filter by location
      if (location) {
        const hasLocation = item.locations.some(
          loc =>
            loc.location.toLowerCase().includes(location) ||
            loc.system?.toLowerCase().includes(location) ||
            loc.planet?.toLowerCase().includes(location) ||
            loc.station?.toLowerCase().includes(location)
        );
        if (!hasLocation) {
          return false;
        }
      }

      return true;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Get detailed information about a specific item
   */
  public async getItemDetails(itemName: string): Promise<UIFItem | null> {
    try {
      const cacheKey = `item:${itemName}`;
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached as UIFItem;
      }

      // Check if we should use mock data
      if (this.useMockData || !(await this.checkApiAvailability())) {
        const mockItem = this.getMockItemDetails(itemName);
        if (mockItem) {
          // Cache mock data so updateItemPrice can modify it
          this.setCache(cacheKey, mockItem);
        }
        return mockItem;
      }

      // Execute through circuit breaker
      const item = await this.executeWithCircuitBreaker(
        async () => {
          const response = await this.client.get(`/api/items/${encodeURIComponent(itemName)}`);
          return this.parseItem(response.data);
        },
        () => this.getMockItemDetails(itemName)
      );

      if (item) {
        this.setCache(cacheKey, item);
      }

      return item;
    } catch (error: unknown) {
      logger.error(`Error getting item details for ${itemName}:`, error);
      // Fallback to mock data
      const mockItem = this.getMockItemDetails(itemName);
      if (mockItem) {
        const cacheKey = `item:${itemName}`;
        this.setCache(cacheKey, mockItem);
      }
      return mockItem;
    }
  }

  /**
   * Get mock item details
   */
  private getMockItemDetails(itemName: string): UIFItem | null {
    const normalizedName = itemName.toLowerCase();
    const found = MOCK_ITEMS.find(
      item =>
        item.name.toLowerCase() === normalizedName ||
        item.name.toLowerCase().includes(normalizedName)
    );
    // Return a deep copy to avoid modifying the original mock data
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  /**
   * Get current market prices for an item
   */
  public async getItemPrices(itemName: string): Promise<UIFItemLocation[]> {
    try {
      const item = await this.getItemDetails(itemName);
      return item?.locations || [];
    } catch (error: unknown) {
      logger.error(`Error getting prices for ${itemName}:`, error);
      return [];
    }
  }

  /**
   * Find best buy location for an item
   */
  public async findBestBuyLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    try {
      const locations = await this.getItemPrices(itemName);
      const buyLocations = locations.filter(
        loc => loc.type === 'buy' && loc.price && loc.inStock !== false
      );

      if (buyLocations.length === 0) {
        return null;
      }

      // If near location specified, try to prioritize it
      if (nearLocation) {
        const nearbyLocation = buyLocations.find(
          loc =>
            loc.location.toLowerCase().includes(nearLocation.toLowerCase()) ||
            loc.system?.toLowerCase().includes(nearLocation.toLowerCase())
        );
        if (nearbyLocation) {
          return nearbyLocation;
        }
      }

      // Otherwise return cheapest
      return buyLocations.reduce((min, loc) =>
        (loc.price ?? Infinity) < (min.price ?? Infinity) ? loc : min
      );
    } catch (error: unknown) {
      logger.error(`Error finding best buy location for ${itemName}:`, error);
      return null;
    }
  }

  /**
   * Find best sell location for an item
   */
  public async findBestSellLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    try {
      const locations = await this.getItemPrices(itemName);
      const sellLocations = locations.filter(loc => loc.type === 'sell' && loc.price);

      if (sellLocations.length === 0) {
        return null;
      }

      // If near location specified, try to prioritize it
      if (nearLocation) {
        const nearbyLocation = sellLocations.find(
          loc =>
            loc.location.toLowerCase().includes(nearLocation.toLowerCase()) ||
            loc.system?.toLowerCase().includes(nearLocation.toLowerCase())
        );
        if (nearbyLocation) {
          return nearbyLocation;
        }
      }

      // Otherwise return highest price
      return sellLocations.reduce((max, loc) => ((loc.price ?? 0) > (max.price ?? 0) ? loc : max));
    } catch (error: unknown) {
      logger.error(`Error finding best sell location for ${itemName}:`, error);
      return null;
    }
  }

  /**
   * Compare prices and find trading opportunities
   */
  public async comparePrices(itemName: string): Promise<UIFPriceComparison | null> {
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
    } catch (error: unknown) {
      logger.error(`Error comparing prices for ${itemName}:`, error);
      return null;
    }
  }

  /**
   * Get items by category
   */
  public async getItemsByCategory(category: string): Promise<UIFItem[]> {
    try {
      const cacheKey = `category:${category}`;
      const cached = this.getCached(cacheKey) as UIFItem[] | null;
      if (cached) {
        return cached;
      }

      // Placeholder implementation
      const response = await this.client.get(
        `/api/categories/${encodeURIComponent(category)}/items`
      );
      const items = this.parseItems(response.data);

      this.setCache(cacheKey, items);
      return items;
    } catch (error: unknown) {
      logger.error(`Error getting items for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Get items available at a specific location
   */
  public async getItemsAtLocation(location: string): Promise<UIFItem[]> {
    try {
      const cacheKey = `location:${location}`;
      const cached = this.getCached(cacheKey) as UIFItem[] | null;
      if (cached) {
        return cached;
      }

      // Placeholder implementation
      const response = await this.client.get('/api/locations', {
        params: { location },
      });
      const items = this.parseItems(response.data);

      this.setCache(cacheKey, items);
      return items;
    } catch (error: unknown) {
      logger.error(`Error getting items at location ${location}:`, error);
      return [];
    }
  }

  /**
   * Get trading opportunities between two locations
   */
  public async getTradingOpportunities(
    fromLocation: string,
    toLocation: string,
    minProfitMargin: number = 10
  ): Promise<UIFPriceComparison[]> {
    try {
      const itemsAtFrom = await this.getItemsAtLocation(fromLocation);
      const opportunities: UIFPriceComparison[] = [];

      for (const item of itemsAtFrom) {
        const comparison = await this.comparePrices(item.name);

        if (comparison?.profitMargin && comparison.profitMargin >= minProfitMargin) {
          opportunities.push(comparison);
        }
      }

      // Sort by profit margin
      return opportunities.sort((a, b) => (b.profitMargin ?? 0) - (a.profitMargin ?? 0));
    } catch (error: unknown) {
      logger.error(
        `Error getting trading opportunities from ${fromLocation} to ${toLocation}:`,
        error
      );
      return [];
    }
  }

  /**
   * Update item price in cache
   */
  public updateItemPrice(
    itemName: string,
    location: string,
    price: number,
    type: 'buy' | 'sell'
  ): void {
    try {
      const cacheKey = `item:${itemName}`;
      const cached = this.cache.get(cacheKey);

      if (cached?.data) {
        const item = cached.data as UIFItem;
        const locationIndex = item.locations.findIndex(
          loc => loc.location === location && loc.type === type
        );

        if (locationIndex >= 0 && item.locations[locationIndex]) {
          item.locations[locationIndex].price = price;
          item.locations[locationIndex].lastUpdated = new Date().toISOString();
        } else {
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
    } catch (error: unknown) {
      logger.error('Error updating item price:', error);
    }
  }

  /**
   * Parse API response into UIFItem format
   */
  private parseItem(data: Record<string, unknown>): UIFItem | null {
    try {
      // This will need to be adjusted based on actual API response format
      return {
        name: (data.name as string) || (data.itemName as string),
        category: data.category as string,
        subCategory: data.subCategory as string | undefined,
        description: data.description as string | undefined,
        manufacturer: data.manufacturer as string | undefined,
        size: data.size as string | undefined,
        grade: data.grade as string | undefined,
        locations: (data.locations as UIFItemLocation[]) || [],
        averagePrice: data.averagePrice as number | undefined,
        minPrice: data.minPrice as number | undefined,
        maxPrice: data.maxPrice as number | undefined,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated as string) : new Date(),
      };
    } catch (error: unknown) {
      logger.error('Error parsing item data:', error);
      return null;
    }
  }

  /**
   * Parse array of items from API response
   */
  private parseItems(data: unknown): UIFItem[] {
    try {
      if (Array.isArray(data)) {
        return data
          .map(item => this.parseItem(item as Record<string, unknown>))
          .filter(item => item !== null);
      } else if (data && typeof data === 'object' && 'items' in data) {
        const items = (data as Record<string, unknown>).items;
        if (Array.isArray(items)) {
          return items
            .map((item: unknown) => this.parseItem(item as Record<string, unknown>))
            .filter((item: UIFItem | null) => item !== null);
        }
      }
      return [];
    } catch (error: unknown) {
      logger.error('Error parsing items data:', error);
      return [];
    }
  }

  /**
   * Get cached data if still valid
   */
  private getCached(key: string): unknown {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cache
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('UIF service cache cleared');
  }

  /**
   * Clear cache for specific item
   */
  public clearItemCache(itemName: string): void {
    this.cache.delete(`item:${itemName}`);
  }
}

export const uifService = new UIFService();

