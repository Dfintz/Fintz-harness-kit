/**
 * Trading Manager Utilities
 * 
 * Utility functions for data transformation and calculations
 */

import type { TradingOpportunity, TradingRouteV2, FleetShip, RouteFleetComposition } from '@/types/apiV2';
import type { OpportunityDisplay, RouteDisplay, RouteStop } from './types';
import { PRICE_ESTIMATION, FUEL_CONSTANTS } from './constants';

/**
 * Transform an opportunity from the API into display format
 * Estimates buy/sell prices based on estimated profit
 *
 * TODO: Replace price estimation with real market data API
 *
 * @param opp - Trading opportunity from backend API
 * @returns OpportunityDisplay with calculated prices and margins
 */
export const transformOpportunityToDisplay = (opp: TradingOpportunity): OpportunityDisplay => {
  const firstStop = opp.stops[0];
  const secondStop = opp.stops[1];

  // Estimate buy/sell prices based on profit
  const estimatedBuyPrice = opp.estimatedProfit
    ? opp.estimatedProfit * PRICE_ESTIMATION.BUY_RATIO
    : PRICE_ESTIMATION.DEFAULT_BUY;
  const estimatedSellPrice = opp.estimatedProfit
    ? opp.estimatedProfit * PRICE_ESTIMATION.SELL_RATIO
    : PRICE_ESTIMATION.DEFAULT_SELL;
  const profitPerUnit = estimatedSellPrice - estimatedBuyPrice;
  const profitMargin = (profitPerUnit / estimatedBuyPrice) * 100;

  return {
    commodity: firstStop?.buyGoods?.[0] || firstStop?.sellGoods?.[0] || 'Mixed Goods',
    buyLocation: firstStop?.location || 'Unknown',
    sellLocation: secondStop?.location || 'Unknown',
    buyPrice: estimatedBuyPrice,
    sellPrice: estimatedSellPrice,
    profitPerUnit,
    profitMargin,
  };
};

/**
 * Transform API route to display format
 * 
 * @param route - Trading route from backend API
 * @returns RouteDisplay with simplified structure for UI
 */
export const transformRouteToDisplay = (route: TradingRouteV2): RouteDisplay => ({
  id: route.id,
  name: route.name,
  description: route.description,
  stops: route.stops.length,
  estimatedProfit: route.estimatedProfit || 0,
  duration: route.estimatedDuration || 0,
  runCount: route.performance?.runCount || 0,
  status: route.status as 'active' | 'inactive' | 'deprecated',
});

/**
 * Calculate aggregate fleet composition from individual ships
 *
 * Computes total cargo capacity, slowest speeds, minimum fuel capacity,
 * and checks for presence of refueling ships.
 *
 * @param fleetShips - Array of fleet ships
 * @returns RouteFleetComposition object or null if no ships
 */
export const calculateFleetComposition = (fleetShips: FleetShip[]): RouteFleetComposition | null => {
  if (fleetShips.length === 0) return null;

  const totalCargo = fleetShips.reduce((sum, ship) => sum + (ship.cargo || 0) * ship.quantity, 0);
  const slowestSpeed = Math.min(...fleetShips.map(s => s.speed || Infinity));
  const slowestQuantumSpeed = Math.min(...fleetShips.map(s => s.quantumSpeed || Infinity));
  const minFuelCapacity = Math.min(...fleetShips.map(s => s.quantumFuelCapacity || Infinity));
  const hasRefuelingShip = fleetShips.some(s => s.isRefuelingShip);

  return {
    ships: fleetShips,
    totalCargo,
    slowestSpeed: isFinite(slowestSpeed) ? slowestSpeed : 0,
    slowestQuantumSpeed: isFinite(slowestQuantumSpeed) ? slowestQuantumSpeed : 0,
    minFuelCapacity: isFinite(minFuelCapacity) ? minFuelCapacity : 0,
    hasRefuelingShip,
  };
};

/**
 * Calculate and insert refueling stops based on fleet fuel capacity
 *
 * Analyzes each leg of the route and inserts refueling stops when the
 * fleet's fuel would drop below the threshold. Automatically skipped if
 * fleet contains a refueling ship (e.g., Starfarer).
 *
 * Algorithm:
 * 1. Start with full fuel (minFuelCapacity)
 * 2. For each stop, calculate fuel needed based on distance
 * 3. If remaining fuel after leg < threshold, insert refuel stop midway
 * 4. Skip all refueling if fleet has refueling ship
 *
 * TODO: Use actual star system distances instead of manual input
 * TODO: Dynamic fuel consumption based on ship type and quantum drive
 * TODO: Validate refueling stations exist at calculated positions
 *
 * @param stops - Original route stops with distances
 * @param fleetShips - Fleet composition
 * @returns Updated stops array with refueling stops inserted
 */
export const calculateRefuelingStops = (stops: RouteStop[], fleetShips: FleetShip[]): RouteStop[] => {
  const fleetComp = calculateFleetComposition(fleetShips);
  if (!fleetComp || fleetComp.hasRefuelingShip) {
    // No refueling stops needed if we have a refueling ship
    return stops;
  }

  const updatedStops = [...stops];
  const fuelPerKm = FUEL_CONSTANTS.CONSUMPTION_RATE;
  const refuelThreshold = fleetComp.minFuelCapacity * FUEL_CONSTANTS.REFUEL_THRESHOLD;

  let currentFuel = fleetComp.minFuelCapacity;
  const stopsWithRefuel: RouteStop[] = [];

  for (let i = 0; i < updatedStops.length; i++) {
    const stop = updatedStops[i];
    const distance = parseFloat(stop.distance) || 0;
    const fuelNeeded = distance * fuelPerKm;

    // Check if we need refueling before this stop
    if (currentFuel - fuelNeeded < refuelThreshold && distance > 0) {
      // Add refueling stop
      stopsWithRefuel.push({
        ...stop,
        location: `Refuel Station (before ${stop.location})`,
        type: 'refuel',
        buyGoods: '',
        sellGoods: '',
        order: stopsWithRefuel.length,
        distance: (distance / 2).toString(), // Midway approximation
      });
      currentFuel = fleetComp.minFuelCapacity; // Refueled
    }

    stopsWithRefuel.push({ ...stop, order: stopsWithRefuel.length });
    currentFuel -= fuelNeeded;
  }

  return stopsWithRefuel;
};

/**
 * Get badge variant for route status
 * 
 * @param status - Route status
 * @returns Badge variant string
 */
export const getStatusBadgeVariant = (status: string): 'positive' | 'neutral' | 'yellow' => {
  switch (status) {
    case 'active':
      return 'positive';
    case 'inactive':
      return 'neutral';
    case 'deprecated':
      return 'yellow';
    default:
      return 'neutral';
  }
};
