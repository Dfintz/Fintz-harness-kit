import type {
  CreateInventoryItemInput,
  InventoryAdjustment,
  InventoryItem,
  InventoryQueryParams,
  InventoryStatistics,
  UpdateInventoryItemInput,
} from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { apiClient } from './apiClient';

/**
 * Logistics Service
 * Handles all inventory and logistics-related API calls using unified API client
 */
class LogisticsService {
  private readonly basePath = '/api/v2/inventory';

  // ============================================================================
  // Inventory Management
  // ============================================================================

  /**
   * Get all inventory items
   */
  async getInventory(params?: InventoryQueryParams): Promise<InventoryItem[]> {
    const response = await apiClient.get<InventoryItem[]>(this.basePath, { params });
    return response.data;
  }

  /**
   * Get inventory item by ID
   */
  async getInventoryItem(id: string): Promise<InventoryItem> {
    const response = await apiClient.get<InventoryItem>(`${this.basePath}/${id}`);
    return response.data;
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(data: CreateInventoryItemInput): Promise<InventoryItem> {
    const response = await apiClient.post<InventoryItem>(this.basePath, data);
    return response.data;
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(id: string, data: UpdateInventoryItemInput): Promise<InventoryItem> {
    const response = await apiClient.patch<InventoryItem>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`);
  }

  /**
   * Adjust inventory stock
   */
  async adjustStock(id: string, adjustment: InventoryAdjustment): Promise<InventoryItem> {
    const response = await apiClient.post<InventoryItem>(
      `${this.basePath}/${id}/adjust`,
      adjustment
    );
    return response.data;
  }

  /**
   * Search inventory
   */
  async searchInventory(query: string, category?: string): Promise<InventoryItem[]> {
    const params: Record<string, string> = { search: query };
    if (category && category !== 'all') {
      params.category = category;
    }

    const response = await apiClient.get<InventoryItem[]>(this.basePath, { params });
    return response.data;
  }

  // ============================================================================
  // Inventory Statistics & Reports
  // ============================================================================

  /**
   * Get inventory statistics
   */
  async getInventoryStatistics(fleetId?: string): Promise<InventoryStatistics> {
    const endpoint = fleetId
      ? `${this.basePath}/fleet/${fleetId}/statistics`
      : `${this.basePath}/statistics`;

    const response = await apiClient.get<InventoryStatistics>(endpoint);
    return response.data;
  }

  /**
   * Get inventory by category
   */
  async getInventoryByCategory(fleetId?: string): Promise<Record<string, InventoryItem[]>> {
    const endpoint = fleetId
      ? `${this.basePath}/fleet/${fleetId}/by-category`
      : `${this.basePath}/by-category`;

    const response = await apiClient.get<Record<string, InventoryItem[]>>(endpoint);
    return response.data;
  }

  /**
   * Get low stock report
   */
  async getLowStockReport(fleetId?: string): Promise<InventoryItem[]> {
    const endpoint = fleetId
      ? `${this.basePath}/fleet/${fleetId}/low-stock-report`
      : `${this.basePath}/low-stock-report`;

    const response = await apiClient.get<InventoryItem[]>(endpoint);
    return response.data;
  }

  // ============================================================================
  // Market Prices (UEX Corp integration)
  // ============================================================================

  /**
   * Get market prices for an item from UEX Corp
   */
  async getMarketPrices(itemName: string): Promise<{
    itemName: string;
    minPrice: number | null;
    avgPrice: number | null;
    maxPrice: number | null;
    locations: Array<{
      location: string;
      system: string | null;
      planet: string | null;
      type: 'buy' | 'sell';
      price: number;
      inStock: boolean;
    }>;
    source: string;
    available: boolean;
    lastUpdated: string | null;
  } | null> {
    try {
      const response = await apiClient.get<{
        itemName: string;
        minPrice: number | null;
        avgPrice: number | null;
        maxPrice: number | null;
        locations: Array<{
          location: string;
          system: string | null;
          planet: string | null;
          type: 'buy' | 'sell';
          price: number;
          inStock: boolean;
        }>;
        source: string;
        available: boolean;
        lastUpdated: string | null;
      }>(`${this.basePath}/market-prices/${encodeURIComponent(itemName)}`);
      return response.data;
    } catch (error) {
      // UEX price lookup may fail — return null gracefully
      logger.warn(
        'Market price lookup failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Update item prices from UEX Corp market data
   */
  async updateItemPrices(
    id: string,
    marketData: { avgBuyPrice?: number; avgSellPrice?: number }
  ): Promise<InventoryItem> {
    const response = await apiClient.patch<InventoryItem>(`${this.basePath}/${id}`, marketData);
    return response.data;
  }

  /**
   * Bulk update all item prices from UEX Corp market data
   */
  async updateAllPrices(items: InventoryItem[]): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const market = await this.getMarketPrices(item.itemName);
        if (market?.available && (market.minPrice !== null || market.maxPrice !== null)) {
          const buyLocations = market.locations.filter(l => l.type === 'buy');
          const sellLocations = market.locations.filter(l => l.type === 'sell');

          const avgBuyPrice =
            buyLocations.length > 0
              ? buyLocations.reduce((sum, l) => sum + l.price, 0) / buyLocations.length
              : undefined;
          const avgSellPrice =
            sellLocations.length > 0
              ? sellLocations.reduce((sum, l) => sum + l.price, 0) / sellLocations.length
              : undefined;

          if (avgBuyPrice !== undefined || avgSellPrice !== undefined) {
            await this.updateItemPrices(item.id, { avgBuyPrice, avgSellPrice });
            updated++;
          }
        }
      } catch {
        errors++;
      }
    }

    return { updated, errors };
  }
}

export const logisticsService = new LogisticsService();
