/**
 * Trading Manager Constants
 * 
 * Centralized constants for trading route calculations and price estimations
 */

/**
 * Price estimation constants for opportunity display
 * Used when actual market prices are unavailable
 * TODO: Replace with real-time market price API integration
 */
export const PRICE_ESTIMATION = {
  BUY_RATIO: 0.6, // Estimated buy price is 60% of total profit
  SELL_RATIO: 1.0, // Estimated sell price is 100% of total profit
  DEFAULT_BUY: 100, // Default buy price when profit data unavailable
  DEFAULT_SELL: 160, // Default sell price when profit data unavailable
  PROFIT_CONVERSION_FACTOR: 1000, // Convert % margin to absolute profit estimate
} as const;

/**
 * Fuel calculation constants for refueling stop insertion
 * TODO: Make these dynamic based on ship type and quantum drive
 */
export const FUEL_CONSTANTS = {
  CONSUMPTION_RATE: 0.1, // Fuel consumed per kilometer traveled
  REFUEL_THRESHOLD: 0.3, // Refuel when fuel drops below 30% capacity
} as const;
