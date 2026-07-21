/**
 * UEXPriceFeed public types (E5 decomposition).
 *
 * The public trade-route / search / dropdown DTOs produced by {@link UEXPriceFeed},
 * extracted into a sibling module so the service file holds the UEX API client +
 * route-calculation logic (and its many private API-shape interfaces) only. Pure
 * structural types — no imports — re-exported from `./UEXPriceFeed` so any import
 * path is preserved.
 */

/** A suggested trade route calculated from UEX price data. */
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

/** Filter parameters for searching UEX trade routes. */
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

/** Lightweight terminal entry for dropdown population. */
export interface UEXTerminalInfo {
  id: number;
  name: string;
  code: string;
  type?: string;
  starSystem: string;
  planet: string;
  orbit: string;
}

/** Lightweight commodity entry for dropdown population. */
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

