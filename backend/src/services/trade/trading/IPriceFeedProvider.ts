import type { UIFItem, UIFItemLocation, UIFPriceComparison } from './UIFService';

// Re-export the data types so consumers only import from the interface module
export type { UIFItem, UIFItemLocation, UIFPriceComparison };

/**
 * Search options for finding items in the price feed.
 */
export interface PriceFeedSearchOptions {
  query: string;
  category?: string;
  location?: string;
  maxResults?: number;
}

/**
 * IPriceFeedProvider — adapter interface for commodity pricing data.
 *
 * Implementations:
 *   - UIFPriceFeed  : wraps the existing UIFService (finder.cstone.space + mock fallback)
 *   - (future) UEXPriceFeed : connects to UEX / SC Trade Tools API
 *   - (future) RegolithPriceFeed : connects to regolith.space scraped data
 *
 * All consumers (TradingService, PriceAlertService, FleetInventoryService,
 * TradeAggregatorService) should migrate from the `uifService` singleton to
 * accepting an `IPriceFeedProvider` via constructor injection.
 */
export interface IPriceFeedProvider {
  /** Human-readable name, e.g. "UIF", "UEX". */
  readonly name: string;

  // ---------------------------------------------------------------------------
  // Item search
  // ---------------------------------------------------------------------------

  /** Full-text search across all items in the feed. */
  searchItems(options: PriceFeedSearchOptions): Promise<UIFItem[]>;

  /** Get full details (all locations + prices) for a single item. */
  getItemDetails(itemName: string): Promise<UIFItem | null>;

  // ---------------------------------------------------------------------------
  // Price queries
  // ---------------------------------------------------------------------------

  /** Return all known price points for an item (buy + sell at each location). */
  getItemPrices(itemName: string): Promise<UIFItemLocation[]>;

  /** Best buy location (lowest price) for an item, optionally near a location. */
  findBestBuyLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;

  /** Best sell location (highest price) for an item, optionally near a location. */
  findBestSellLocation(itemName: string, nearLocation?: string): Promise<UIFItemLocation | null>;

  /**
   * Compare best buy vs best sell across all known locations.
   * Returns profit potential for a single commodity.
   */
  comparePrices(itemName: string): Promise<UIFPriceComparison | null>;

  /** List all items available at a location. */
  getItemsAtLocation(location: string): Promise<UIFItem[]>;

  /**
   * Find profitable round-trip opportunities between two locations.
   * @param from — origin location
   * @param to — destination location
   * @param minMargin — minimum profit margin (0-100), defaults to 0
   */
  getTradingOpportunities(
    from: string,
    to: string,
    minMargin?: number
  ): Promise<UIFPriceComparison[]>;

  // ---------------------------------------------------------------------------
  // Cache / lifecycle
  // ---------------------------------------------------------------------------

  /** Clear the entire item cache (forces re-fetch on next query). */
  clearCache(): void;

  /** Clear cache for a single item. */
  clearItemCache(itemName: string): void;

  /**
   * Self-health check — providers that call external APIs should report
   * circuit breaker or connectivity status.
   */
  getStatus(): { name: string; healthy: boolean; details?: Record<string, unknown> };
}

