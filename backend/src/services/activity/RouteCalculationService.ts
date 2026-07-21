import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Activity, RouteWaypoint, ShipAssignment } from '../../models/Activity';
import { Ship } from '../../models/Ship';
import { resolveShipCrew } from '../../utils/crewCalculation';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Route calculation result with fleet capabilities
 */
export interface RouteCalculationResult {
  totalCargoCapacity: number; // Total cargo SCU across fleet
  totalQuantumFuel: number; // Total quantum fuel capacity across fleet
  totalQuantumFuelRequired: number; // Total fuel needed for route
  maxJumpRange: number; // Maximum single jump (limited by shortest-range ship)
  hasRefuelShip: boolean; // Whether fleet has refuel capability
  insufficientFuel: boolean; // Whether route exceeds fuel capacity
  refuelStopsNeeded: number; // Number of refuel stops required
  bottleneckShip?: string; // Ship limiting jump range (shortest range)
  totalCrewCapacity: number; // Total crew slots across all ships
}

/**
 * Ship specifications for route calculations
 */
interface ShipSpecs {
  shipType: string;
  cargo: number;
  quantumFuelCapacity: number;
  maxJumpRange?: number;
  isRefuelCapable: boolean;
  crewCapacity: number; // Max crew from ship catalog (or 1 fallback)
}

/**
 * RouteCalculationService
 *
 * Calculates fleet capabilities for route planning:
 * - Total cargo capacity across all ships
 * - Total quantum fuel capacity
 * - Fuel requirements for waypoints
 * - Maximum jump range (bottleneck analysis)
 * - Refuel ship detection
 *
 * Uses Ship catalogue DB for specifications.
 */
export class RouteCalculationService {
  private shipRepository: Repository<Ship> | null = null;

  // Known refuel-capable ships (Starfarer variants, etc.)
  static readonly REFUEL_SHIPS = ['starfarer', 'starfarer gemini', 'vulcan'];

  // Known rearm-capable ships (ammunition/missile resupply)
  static readonly REARM_SHIPS = ['vulcan', 'crucible'];

  // Known repair-capable ships
  static readonly REPAIR_SHIPS = ['vulcan', 'crucible', 'odyssey'];

  // Known medical-capable ships (healing/respawn)
  static readonly MEDICAL_SHIPS = [
    'apollo medivac',
    'apollo triage',
    'cutlass red',
    'terrapin medic',
    'c8r pisces rescue',
    'ursa medivac',
    'clipper',
  ];

  private getShipRepository(): Repository<Ship> {
    if (!this.shipRepository) {
      if (!AppDataSource.isInitialized) {
        throw new Error('AppDataSource must be initialized before using RouteCalculationService');
      }
      this.shipRepository = AppDataSource.getRepository(Ship);
    }
    return this.shipRepository;
  }

  /**
   * Calculate route capabilities for an activity's fleet
   *
   * @param shipAssignments - Ships assigned to the activity
   * @param routePlan - Waypoints for the route
   * @returns Route calculation result with fleet capabilities
   */
  async calculateRoute(
    shipAssignments: ShipAssignment[],
    routePlan?: RouteWaypoint[]
  ): Promise<RouteCalculationResult> {
    // Get ship specifications from catalogue
    const shipSpecs = await this.getShipSpecifications(shipAssignments);

    // Calculate total cargo capacity
    const totalCargoCapacity = shipSpecs.reduce((sum, ship) => sum + ship.cargo, 0);

    // Calculate total quantum fuel capacity
    const totalQuantumFuel = shipSpecs.reduce((sum, ship) => sum + ship.quantumFuelCapacity, 0);

    // Calculate total crew capacity from ship catalog
    const totalCrewCapacity = shipSpecs.reduce((sum, ship) => sum + ship.crewCapacity, 0);

    // Detect refuel ships
    const hasRefuelShip = shipSpecs.some(ship => ship.isRefuelCapable);

    // Calculate max jump range (bottleneck is ship with shortest range)
    let maxJumpRange = 0;
    let bottleneckShip: string | undefined;

    if (shipSpecs.length > 0) {
      const rangesWithShips = shipSpecs
        .map(ship => ({
          range: ship.maxJumpRange || 0,
          shipType: ship.shipType,
        }))
        .filter(s => s.range > 0);

      if (rangesWithShips.length > 0) {
        const bottleneck = rangesWithShips.reduce(
          (min, curr) => (curr.range < min.range ? curr : min),
          rangesWithShips[0]
        );
        maxJumpRange = bottleneck.range;
        bottleneckShip = bottleneck.shipType;
      }
    }

    // Calculate fuel requirements from route plan
    let totalQuantumFuelRequired = 0;
    let refuelStopsNeeded = 0;

    if (routePlan && routePlan.length > 0) {
      // Sum up fuel requirements from waypoints
      totalQuantumFuelRequired = routePlan.reduce(
        (sum, wp) => sum + (wp.quantumFuelRequired || wp.requiredFuel || 0),
        0
      );

      // Count refuel stops
      refuelStopsNeeded = routePlan.filter(wp => wp.refuelAvailable).length;

      // If no explicit fuel requirements, estimate based on distance
      if (totalQuantumFuelRequired === 0 && routePlan.some(wp => wp.distance)) {
        // Rough heuristic estimate when waypoints don't provide explicit fuel usage.
        // Base assumption: ~0.1 SCU per 1000 km for a "medium" ship (~100 SCU cargo).
        // We scale this by the average cargo capacity of the fleet so that all-small-fighter
        // fleets and all-capital fleets get more reasonable estimates, but this should still
        // be treated as an approximation only.
        const totalDistance = routePlan.reduce((sum, wp) => sum + (wp.distance || 0), 0);
        const BASE_FUEL_PER_1000_KM = 0.1; // SCU, medium ship baseline
        const MEDIUM_CARGO_BASELINE = 100; // SCU, rough "medium" ship cargo capacity

        const averageCargoCapacity =
          shipSpecs.length > 0
            ? shipSpecs.reduce((sum, ship) => sum + (ship.cargo || 0), 0) / shipSpecs.length
            : 0;

        // Derive a size factor from average cargo, clamped to avoid extreme outliers.
        const rawSizeFactor =
          averageCargoCapacity > 0 ? averageCargoCapacity / MEDIUM_CARGO_BASELINE : 1;
        const sizeFactor = Math.min(3, Math.max(0.5, rawSizeFactor));

        totalQuantumFuelRequired = (totalDistance / 1000) * BASE_FUEL_PER_1000_KM * sizeFactor;
      }
    }

    // Check if route exceeds fuel capacity (only if no refuel ship)
    const insufficientFuel = !hasRefuelShip && totalQuantumFuelRequired > totalQuantumFuel;

    return {
      totalCargoCapacity,
      totalQuantumFuel,
      totalQuantumFuelRequired,
      maxJumpRange,
      hasRefuelShip,
      insufficientFuel,
      refuelStopsNeeded,
      bottleneckShip,
      totalCrewCapacity,
    };
  }

  /**
   * Get ship specifications from catalogue DB
   *
   * @param shipAssignments - Ships to look up
   * @returns Ship specifications with cargo, fuel, and range data
   */
  private async getShipSpecifications(shipAssignments: ShipAssignment[]): Promise<ShipSpecs[]> {
    if (!shipAssignments || shipAssignments.length === 0) {
      return [];
    }

    const shipTypes = [...new Set(shipAssignments.map(s => s.shipType))];

    try {
      // Query ship catalogue for specifications
      const shipRepository = this.getShipRepository();
      const ships = await shipRepository
        .createQueryBuilder('ship')
        .where('LOWER(ship.name) IN (:...names)', {
          names: shipTypes.map(t => t.toLowerCase()),
        })
        .andWhere('ship.organizationId IS NULL') // Only get global catalogue entries
        .getMany();

      // Map ship assignments to specifications
      return shipAssignments.map(assignment => {
        const catalogShip = ships.find(
          s => s.name.toLowerCase() === assignment.shipType.toLowerCase()
        );

        // Check if ship is refuel-capable
        const isRefuelCapable = RouteCalculationService.REFUEL_SHIPS.some(refuelShip =>
          assignment.shipType.toLowerCase().includes(refuelShip)
        );

        return {
          shipType: assignment.shipType,
          cargo: catalogShip?.cargo ?? assignment.metadata?.cargoCapacity ?? 0,
          quantumFuelCapacity:
            catalogShip?.quantumFuelCapacity ??
            (assignment.metadata?.quantumFuelCapacity as number) ??
            0,
          crewCapacity: catalogShip ? resolveShipCrew(catalogShip) : assignment.crewCapacity || 1,
          // NOTE:
          // `Ship.quantumSpeed` is stored as a speed-like stat from the game (e.g. quantum travel
          // speed), while `maxJumpRange` is a distance value used by our route planner to
          // determine the longest single leg a ship can reasonably travel.
          //
          // We currently approximate max jump range by multiplying quantumSpeed by 100. This is
          // an intentionally coarse heuristic based on observed in‑game data, chosen only to give
          // ships with higher quantum speeds proportionally higher effective range. It is *not*
          // an exact representation of Star Citizen's internal quantum travel mechanics.
          //
          // Units: `maxJumpRange` here is in the same abstract "distance units" used elsewhere in
          // the activity/route calculations (e.g. megameters or system-relative units), and is
          // only used for relative comparisons (such as finding the bottleneck ship).
          //
          // TODO(sc-route): Replace this heuristic with a data-driven range value once
          // per-ship quantum range data and unit definitions are available from the game or
          // a reliable external data source.
          maxJumpRange: catalogShip?.quantumSpeed ? catalogShip.quantumSpeed * 100 : undefined, // Heuristic estimate (see note above)
          isRefuelCapable,
        };
      });
    } catch (error: unknown) {
      logger.error('Error fetching ship specifications for route calculation:', error);
      // Return fallback with metadata if DB query fails
      return shipAssignments.map(assignment => ({
        shipType: assignment.shipType,
        cargo: (assignment.metadata?.cargoCapacity as number) || 0,
        quantumFuelCapacity: (assignment.metadata?.quantumFuelCapacity as number) || 0,
        crewCapacity: assignment.crewCapacity || 1,
        isRefuelCapable: RouteCalculationService.REFUEL_SHIPS.some(refuelShip =>
          assignment.shipType.toLowerCase().includes(refuelShip)
        ),
      }));
    }
  }

  /**
   * Enrich ship assignment metadata from the Ship catalogue.
   *
   * Looks up each assignment's shipType in the DB and fills in
   * cargoCapacity, vehicleCargoCapacity, quantumFuelCapacity,
   * hydrogenFuelCapacity, hangarSize, and loanerShip when not
   * already provided by the caller.
   */
  async enrichShipMetadata(shipAssignments: ShipAssignment[]): Promise<void> {
    if (!shipAssignments || shipAssignments.length === 0) {
      return;
    }

    const shipTypes = [...new Set(shipAssignments.map(s => s.shipType))];

    try {
      const shipRepository = this.getShipRepository();
      const ships = await shipRepository
        .createQueryBuilder('ship')
        .where('LOWER(ship.name) IN (:...names)', {
          names: shipTypes.map(t => t.toLowerCase()),
        })
        .andWhere('ship.organizationId IS NULL')
        .getMany();

      for (const assignment of shipAssignments) {
        const catalogShip = ships.find(
          s => s.name.toLowerCase() === assignment.shipType.toLowerCase()
        );
        if (!catalogShip) {
          continue;
        }

        assignment.metadata ??= {};
        const meta = assignment.metadata;

        // Only fill fields that aren't already set
        meta.cargoCapacity ??= catalogShip.cargo ?? 0;
        meta.vehicleCargoCapacity ??= catalogShip.vehicleCargo ?? 0;
        meta.quantumFuelCapacity ??= catalogShip.quantumFuelCapacity ?? 0;
        meta.hydrogenFuelCapacity ??= catalogShip.hydrogenFuelCapacity ?? 0;
        meta.hangarSize ??= catalogShip.hangarSize;
        meta.loanerShip ??= catalogShip.loanerShip;
        meta.manufacturer ??= catalogShip.manufacturer;
        meta.size ??= catalogShip.size;

        // Detect refuel-capable ships
        meta.isRefuelCapable ??= RouteCalculationService.REFUEL_SHIPS.some(r =>
          assignment.shipType.toLowerCase().includes(r)
        );

        // Detect rearm/repair-capable ships
        meta.isRearmCapable ??= RouteCalculationService.REARM_SHIPS.some(r =>
          assignment.shipType.toLowerCase().includes(r)
        );
        meta.isRepairCapable ??= RouteCalculationService.REPAIR_SHIPS.some(r =>
          assignment.shipType.toLowerCase().includes(r)
        );

        // Also update crewCapacity from catalog if still at default
        if (assignment.crewCapacity <= 1) {
          const catalogCrew = resolveShipCrew(catalogShip);
          if (catalogCrew > 1) {
            assignment.crewCapacity = catalogCrew;
            assignment.maxCrew = catalogCrew;
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Error enriching ship metadata from catalogue:', error);
      // Non-fatal — ship cards will just show zeros for missing data
    }
  }

  /**
   * Update activity with calculated route data
   *
   * @param activity - Activity to update
   * @returns Updated activity with route calculations
   */
  async updateActivityRouteData(activity: Activity): Promise<Activity> {
    // Use shipAssignments or ships (alias), defaulting to empty array
    const shipAssignments: ShipAssignment[] = activity.shipAssignments ?? activity.ships ?? [];

    const routeCalc = await this.calculateRoute(shipAssignments, activity.routePlan);

    // Update activity fields from route calculation result (even if empty to clear stale data)
    activity.totalCargoCapacity = routeCalc.totalCargoCapacity;
    activity.totalQuantumFuel = routeCalc.totalQuantumFuel;
    activity.totalQuantumFuelRequired = routeCalc.totalQuantumFuelRequired;
    activity.maxJumpRange = routeCalc.maxJumpRange;
    activity.hasRefuelShip = routeCalc.hasRefuelShip;
    activity.totalCrewCapacity = routeCalc.totalCrewCapacity;

    logger.info('Updated activity route calculation fields', {
      activityId: activity.id,
      organizationId: activity.organizationId,
      totalCargoCapacity: routeCalc.totalCargoCapacity,
      totalQuantumFuel: routeCalc.totalQuantumFuel,
      totalCrewCapacity: routeCalc.totalCrewCapacity,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'ACTIVITY_ROUTE_DATA_UPDATED',
      message: `Updated route calculation fields for activity ${activity.id}`,
      organizationId: activity.organizationId ?? undefined,
      resource: `activity/${activity.id}`,
      metadata: {
        activityId: activity.id,
        totalCargoCapacity: routeCalc.totalCargoCapacity,
        totalQuantumFuel: routeCalc.totalQuantumFuel,
        totalCrewCapacity: routeCalc.totalCrewCapacity,
      },
    });

    return activity;
  }
}
