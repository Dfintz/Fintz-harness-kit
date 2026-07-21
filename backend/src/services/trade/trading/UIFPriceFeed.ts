import {
    IPriceFeedProvider,
    PriceFeedSearchOptions,
} from './IPriceFeedProvider';
import {
    UIFItem,
    UIFItemLocation,
    UIFPriceComparison,
    uifService,
} from './UIFService';

/**
 * UIFPriceFeed — adapter wrapping the existing UIFService singleton
 * so it conforms to the generic `IPriceFeedProvider` interface.
 *
 * This is the **default** implementation and delegates all calls directly
 * to `uifService`.  It uses the finder.cstone.space API with local mock
 * fallback (controlled by UIF_USE_MOCK env var / circuit breaker).
 */
export class UIFPriceFeed implements IPriceFeedProvider {
  readonly name = 'UIF';

  async searchItems(options: PriceFeedSearchOptions): Promise<UIFItem[]> {
    return uifService.searchItems(options);
  }

  async getItemDetails(itemName: string): Promise<UIFItem | null> {
    return uifService.getItemDetails(itemName);
  }

  async getItemPrices(itemName: string): Promise<UIFItemLocation[]> {
    return uifService.getItemPrices(itemName);
  }

  async findBestBuyLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    return uifService.findBestBuyLocation(itemName, nearLocation);
  }

  async findBestSellLocation(
    itemName: string,
    nearLocation?: string
  ): Promise<UIFItemLocation | null> {
    return uifService.findBestSellLocation(itemName, nearLocation);
  }

  async comparePrices(itemName: string): Promise<UIFPriceComparison | null> {
    return uifService.comparePrices(itemName);
  }

  async getItemsAtLocation(location: string): Promise<UIFItem[]> {
    return uifService.getItemsAtLocation(location);
  }

  async getTradingOpportunities(
    from: string,
    to: string,
    minMargin?: number
  ): Promise<UIFPriceComparison[]> {
    return uifService.getTradingOpportunities(from, to, minMargin);
  }

  clearCache(): void {
    uifService.clearCache();
  }

  clearItemCache(itemName: string): void {
    uifService.clearItemCache(itemName);
  }

  getStatus(): { name: string; healthy: boolean; details?: Record<string, unknown> } {
    const circuit = uifService.getCircuitStatus();
    return {
      name: this.name,
      healthy: circuit.healthy,
      details: { state: circuit.state },
    };
  }
}

