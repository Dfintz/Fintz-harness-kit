import { IPriceFeedProvider } from './IPriceFeedProvider';
import { UEXPriceFeed } from './UEXPriceFeed';
import { UIFPriceFeed } from './UIFPriceFeed';

/**
 * Factory for creating price feed providers.
 *
 * Usage:
 *   const provider = createPriceFeedProvider();           // default = UIF
 *   const uex      = createPriceFeedProvider('uex');      // UEX stub
 *
 * Consumers should accept `IPriceFeedProvider` via constructor injection
 * rather than importing a specific implementation directly.
 */
export function createPriceFeedProvider(
  name: 'uif' | 'uex' = 'uif'
): IPriceFeedProvider {
  switch (name) {
    case 'uex':
      return new UEXPriceFeed();
    case 'uif':
    default:
      return new UIFPriceFeed();
  }
}

/**
 * Default singleton — uses the UIF provider (same behavior as direct
 * `uifService` import, but now behind the `IPriceFeedProvider` contract).
 *
 * Consumers can start by replacing `import { uifService }` with
 * `import { defaultPriceFeed as priceFeed }` for a zero-behavior-change
 * migration.
 */
export const defaultPriceFeed: IPriceFeedProvider = createPriceFeedProvider('uif');

