import { AppDataSource } from '../../config/database';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import { RouteCalculationService } from '../../services/activity/RouteCalculationService';
import { logger } from '../../utils/logger';

/** Fleet capability summary computed from ships */
export interface FleetCapabilities {
  totalCargoCapacity: number;
  avgQuantumFuel: number | null;
  hasRefuelShip: boolean;
  hasRearmShip: boolean;
  hasRepairShip: boolean;
  hasMedicalShip: boolean;
  refuelShipNames: string[];
  rearmShipNames: string[];
  repairShipNames: string[];
  medicalShipNames: string[];
}

/** Check if a ship name matches any entry in a capability list */
export function matchesCapability(nameLower: string, capList: readonly string[]): boolean {
  return capList.some(c => nameLower.includes(c));
}

/** Aggregate capability stats from a list of ships */
export function aggregateShipCapabilities(ships: Ship[]): FleetCapabilities {
  let totalCargo = 0;
  let totalQF = 0;
  let qfCount = 0;
  let hasRefuel = false;
  let hasRearm = false;
  let hasRepair = false;
  let hasMedical = false;
  const refuelShipNames: string[] = [];
  const rearmShipNames: string[] = [];
  const repairShipNames: string[] = [];
  const medicalShipNames: string[] = [];

  for (const ship of ships) {
    totalCargo += ship.cargo ?? 0;
    if (ship.quantumFuelCapacity) {
      totalQF += ship.quantumFuelCapacity;
      qfCount++;
    }
    const nameLower = ship.name.toLowerCase();
    if (matchesCapability(nameLower, RouteCalculationService.REFUEL_SHIPS)) {
      hasRefuel = true;
      refuelShipNames.push(ship.name);
    }
    if (matchesCapability(nameLower, RouteCalculationService.REARM_SHIPS)) {
      hasRearm = true;
      rearmShipNames.push(ship.name);
    }
    if (matchesCapability(nameLower, RouteCalculationService.REPAIR_SHIPS)) {
      hasRepair = true;
      repairShipNames.push(ship.name);
    }
    if (matchesCapability(nameLower, RouteCalculationService.MEDICAL_SHIPS)) {
      hasMedical = true;
      medicalShipNames.push(ship.name);
    }
  }

  return {
    totalCargoCapacity: totalCargo,
    avgQuantumFuel: qfCount > 0 ? totalQF / qfCount : null,
    hasRefuelShip: hasRefuel,
    hasRearmShip: hasRearm,
    hasRepairShip: hasRepair,
    hasMedicalShip: hasMedical,
    refuelShipNames,
    rearmShipNames,
    repairShipNames,
    medicalShipNames,
  };
}

/**
 * Batch-load ship counts for a list of fleets in a single query.
 * Uses TypeORM QueryBuilder with INNER JOIN on ships to ensure only
 * valid (non-deleted) ships are counted, matching the getFleetShips
 * endpoint behaviour exactly.
 */
export async function batchShipCounts(fleetIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (fleetIds.length === 0) {
    return result;
  }

  try {
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const rows = await fleetShipRepo
      .createQueryBuilder('fs')
      .select('fs.fleetId', 'fleetId')
      .addSelect('COUNT(*)::int', 'count')
      .innerJoin('fs.ship', 'ship')
      .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
      .groupBy('fs.fleetId')
      .getRawMany<{ fleetId: string; count: number }>();

    for (const row of rows) {
      result.set(row.fleetId, row.count);
    }
  } catch (error) {
    logger.error('Error loading ship counts:', error);
  }

  return result;
}

/**
 * Batch-load active team member counts for fleets that have an assigned team.
 * Counts members with status 'active' or 'deployed' via team_members.
 * A single team can be assigned to multiple fleets, so we track all fleet IDs per team.
 */
export async function batchMemberCounts(
  fleets: Fleet[],
  organizationId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const teamToFleets = new Map<string, string[]>();
  for (const fleet of fleets) {
    if (fleet.teamId) {
      const existing = teamToFleets.get(fleet.teamId) ?? [];
      existing.push(fleet.id);
      teamToFleets.set(fleet.teamId, existing);
    }
  }
  if (teamToFleets.size === 0) {
    return result;
  }

  try {
    const teamIds = Array.from(teamToFleets.keys());
    const rows = await AppDataSource.query(
      `SELECT "teamId", COUNT(*)::int AS "count"
       FROM team_members
       WHERE "teamId" = ANY($1)
         AND "organizationId" = $2
         AND status IN ('active', 'deployed')
       GROUP BY "teamId"`,
      [teamIds, organizationId]
    );
    for (const row of rows as { teamId: string; count: number }[]) {
      const fleetIds = teamToFleets.get(row.teamId);
      if (fleetIds) {
        for (const fleetId of fleetIds) {
          result.set(fleetId, row.count);
        }
      }
    }
  } catch (error) {
    logger.error('Error loading member counts:', error);
  }

  return result;
}

/**
 * Batch-compute fleet capabilities for multiple fleets.
 * Loads ships via FleetShip join, aggregates cargo/fuel/capability flags.
 */
export async function computeFleetCapabilities(
  fleetIds: string[]
): Promise<Map<string, FleetCapabilities>> {
  const result = new Map<string, FleetCapabilities>();
  if (fleetIds.length === 0) {
    return result;
  }

  // Initialize defaults
  const defaultCaps: FleetCapabilities = {
    totalCargoCapacity: 0,
    avgQuantumFuel: null,
    hasRefuelShip: false,
    hasRearmShip: false,
    hasRepairShip: false,
    hasMedicalShip: false,
    refuelShipNames: [],
    rearmShipNames: [],
    repairShipNames: [],
    medicalShipNames: [],
  };
  for (const id of fleetIds) {
    result.set(id, { ...defaultCaps });
  }

  try {
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const rows = await fleetShipRepo
      .createQueryBuilder('fs')
      .innerJoinAndSelect('fs.ship', 'ship')
      .where('fs.fleetId IN (:...ids)', { ids: fleetIds })
      .getMany();

    // Group ships by fleet
    const fleetShips = new Map<string, Ship[]>();
    for (const row of rows) {
      const arr = fleetShips.get(row.fleetId) ?? [];
      arr.push(row.ship);
      fleetShips.set(row.fleetId, arr);
    }

    for (const [fleetId, ships] of fleetShips) {
      result.set(fleetId, aggregateShipCapabilities(ships));
    }
  } catch (error) {
    logger.error('Error computing fleet capabilities:', error);
  }

  return result;
}
