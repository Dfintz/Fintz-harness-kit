/**
 * Trading Manager Types
 * 
 * Type definitions for trading components
 */

/**
 * RouteDisplay - Simplified route structure for table display
 * Transforms TradingRouteV2 from API into flat structure for UI
 */
export interface RouteDisplay {
  id: string;
  name: string;
  description: string;
  stops: number;
  estimatedProfit: number;
  duration: number;
  runCount: number;
  status: 'active' | 'inactive' | 'deprecated';
}

/**
 * OpportunityDisplay - Simplified opportunity structure for table display
 * Calculated from TradingOpportunity with estimated prices
 */
export interface OpportunityDisplay {
  commodity: string;
  buyLocation: string;
  sellLocation: string;
  buyPrice: number;
  sellPrice: number;
  profitPerUnit: number;
  profitMargin: number;
}

/**
 * RouteStop - Internal representation of a route stop for editing
 */
export interface RouteStop {
  location: string;
  buyGoods: string;
  sellGoods: string;
  order: number;
  type: 'trade' | 'refuel' | 'waypoint';
  distance: string;
}
