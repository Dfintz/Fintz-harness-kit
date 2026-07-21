import { In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet, FleetStatus } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import { TeamMember } from '../../models/TeamMember';
import { NotFoundError } from '../../utils/apiErrors';
import type { CrewMode } from '../../utils/crewCalculation';
import { calculateCrewRequirements, resolveShipCrew } from '../../utils/crewCalculation';
import { logger } from '../../utils/logger';

/**
 * Standby crew ratio — 30% of total crew positions reserved for replacements.
 * Used when calculating team capacity for auto-created fleet teams.
 */
export const STANDBY_CREW_RATIO = 0.3;

/**
 * Statuses considered "active" for crew fill rate calculations.
 * Members with these statuses count as filling their crew position.
 */
const ACTIVE_CREW_STATUSES = ['active', 'deployed'] as const;

/**
 * Per-ship crew gate breakdown
 */
export interface ShipCrewGate {
  shipId: string;
  shipName: string;
  maxCrew: number;
  leanRequired: number;
  conservativeRequired: number;
  filled: number;
  passesLean: boolean;
  passesConservative: boolean;
}

/**
 * Fleet crew health result
 */
export interface FleetCrewHealth {
  /** Overall crew fill rate as a percentage (0–100) */
  crewFillRate: number;
  /** Total crew positions across all ships (based on selected mode) */
  totalRequired: number;
  /** Positions currently filled by active/deployed team members */
  totalFilled: number;
  /** Total max crew (1.0x) across all ships */
  totalMaxCrew: number;
  /** Standby pool slots (30% of totalMaxCrew) */
  standbySlots: number;
  /** Members in standby (not assigned to a specific ship gate count) */
  standbyFilled: number;
  /** Per-ship breakdown */
  perShip: ShipCrewGate[];
  /** Overall gate result — true only if ALL ships pass the selected gate */
  overallGatePassed: boolean;
  /** The crew mode used for this calculation */
  crewMode: CrewMode;
}

/**
 * Per-ship maintenance & supply status
 */
export interface ShipMaintenanceStatus {
  shipId: string;
  shipName: string;
  size: string;
  status: string;
  isFlightReady: boolean;
  maxCrew: number;
  hullHp: number;
  shieldHp: number;
  /** Cargo capacity in SCU (0 for snub/small fighters) */
  cargoScu: number;
  /** Whether this ship is large enough to carry fleet supplies */
  isSupplyCapable: boolean;
  /** Supply allocations based on cargo SCU (only for supply-capable ships) */
  supplyCapacity: {
    /** SCU allocated to ammunition */
    ammunition: number;
    /** SCU allocated to hydrogen/quantum fuel reserves */
    fuel: number;
    /** SCU allocated to repair materials & spare parts */
    repairMaterial: number;
    /** Total allocated SCU */
    totalAllocated: number;
  };
}

/**
 * Fleet-level maintenance & supply health
 */
export interface FleetMaintenanceHealth {
  /** Total ships in the fleet */
  totalShips: number;
  /** Ships that are flight-ready */
  flightReadyShips: number;
  /** Ships that can carry supplies (large/capital) */
  supplyCapableShips: number;
  /** Fleet-wide supply totals */
  totalSupply: {
    ammunition: number;
    fuel: number;
    repairMaterial: number;
    totalScu: number;
  };
  /** Per-ship breakdown */
  perShip: ShipMaintenanceStatus[];
}

/**
 * Full fleet health score result
 */
export interface FleetHealthScore {
  fleetId: string;
  fleetName: string;
  healthScore: number;
  status: 'green' | 'yellow' | 'red';
  breakdown: {
    readinessScore: number;
    crewFillRate: number;
    capabilityScore: number;
    operationalScore: number;
  };
  details: {
    totalShips: number;
    flightReadyShips: number;
    totalCrewPositions: number;
    crewFilled: number;
    crewMode: CrewMode;
    overallGatePassed: boolean;
    standbySlots: number;
    standbyFilled: number;
    fleetStatus: string;
  };
  crewHealth: FleetCrewHealth;
  maintenanceHealth: FleetMaintenanceHealth;
}

/**
 * FleetHealthService — Extracted from fleetController.ts
 *
 * Calculates fleet health using four weighted metrics:
 *   1. Readiness (35%): proportion of flight-ready ships
 *   2. Crew Fill Rate (25%): crew positions filled per lean/conservative gate
 *   3. Capability (20%): fleet diversity (combat, cargo, crew, size)
 *   4. Operational (20%): mission stats and deployment status
 *
 * Crew fill uses the same lean (0.4×) / conservative (0.5×) multipliers
 * from crewCalculation.ts that the Activity system uses.
 */
export class FleetHealthService {
  /**
   * Calculate full fleet health score.
   */
  async calculateFleetHealth(organizationId: string, fleetId: string): Promise<FleetHealthScore> {
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet) {
      throw new NotFoundError('Fleet', fleetId);
    }

    // Backfill: auto-create team for pre-existing fleets that lack one
    if (!fleet.teamId) {
      try {
        const { FleetTeamService } = await import('./FleetTeamService');
        const fleetTeamService = FleetTeamService.getInstance();
        await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
        await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
      } catch (err: unknown) {
        logger.warn('Failed to backfill fleet team during health check', {
          fleetId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Get ships assigned to this fleet via the FleetShip join table
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShips = await fleetShipRepo.find({
      where: { fleetId, organizationId },
      relations: ['ship'],
    });

    const ships = fleetShips.map(fs => fs.ship).filter(Boolean);
    const crewMode: CrewMode =
      (fleet as Fleet & { crewMode?: CrewMode }).crewMode || 'conservative';

    // Calculate crew health (the new lean/conservative gate system)
    const crewHealth = await this.calculateCrewHealth(organizationId, fleet, ships, crewMode);

    // Calculate maintenance / supply health
    const maintenanceHealth = this.calculateMaintenanceHealth(ships);

    // Ship readiness
    const totalShips = ships.length;
    const flightReadyCount = ships.filter(s => s.status === 'flight_ready').length;
    const readinessScore = totalShips > 0 ? (flightReadyCount / totalShips) * 100 : 0;

    // Capability diversity
    const capabilityScore = this.computeCapabilityScore(ships);

    // Operational score
    const operationalScore = this.computeOperationalScore(fleet);

    // Weighted overall score
    const healthScore = Math.round(
      readinessScore * 0.35 +
        crewHealth.crewFillRate * 0.25 +
        capabilityScore * 0.2 +
        operationalScore * 0.2
    );

    let status: 'green' | 'yellow' | 'red';
    if (healthScore >= 75) {
      status = 'green';
    } else if (healthScore >= 50) {
      status = 'yellow';
    } else {
      status = 'red';
    }

    return {
      fleetId: fleet.id,
      fleetName: fleet.name,
      healthScore,
      status,
      breakdown: {
        readinessScore: Math.round(readinessScore),
        crewFillRate: Math.round(crewHealth.crewFillRate),
        capabilityScore: Math.round(capabilityScore),
        operationalScore: Math.round(operationalScore),
      },
      details: {
        totalShips,
        flightReadyShips: flightReadyCount,
        totalCrewPositions: crewHealth.totalRequired,
        crewFilled: crewHealth.totalFilled,
        crewMode,
        overallGatePassed: crewHealth.overallGatePassed,
        standbySlots: crewHealth.standbySlots,
        standbyFilled: crewHealth.standbyFilled,
        fleetStatus: fleet.status,
      },
      crewHealth,
      maintenanceHealth,
    };
  }

  /**
   * Calculate crew health using lean/conservative gate thresholds.
   *
   * Uses the same multipliers as the Activity system:
   * - Lean (0.4×): pilot + critical specialists only
   * - Conservative (0.5×): most roles filled for best performance
   *
   * Gate rule: fleet is only as ready as its least-crewed ship.
   */
  async calculateCrewHealth(
    organizationId: string,
    fleet: Fleet,
    ships: Ship[],
    crewMode: CrewMode
  ): Promise<FleetCrewHealth> {
    // Get team members if fleet has a linked team
    let activeMembers: TeamMember[] = [];
    if (fleet.teamId) {
      const memberRepo = AppDataSource.getRepository(TeamMember);
      activeMembers = await memberRepo.find({
        where: {
          teamId: fleet.teamId,
          organizationId,
          status: In([...ACTIVE_CREW_STATUSES]),
        },
      });
    }

    const totalFilled = activeMembers.length;

    // Build a map of actual crew counts per ship using assignedShipId
    const assignedPerShip = new Map<string, number>();
    for (const member of activeMembers) {
      if (member.assignedShipId) {
        assignedPerShip.set(
          member.assignedShipId,
          (assignedPerShip.get(member.assignedShipId) ?? 0) + 1
        );
      }
    }

    // Per-ship breakdown using actual assignments
    const perShip: ShipCrewGate[] = ships.map(ship => {
      const effectiveCrew = resolveShipCrew(ship);
      const lean = calculateCrewRequirements(effectiveCrew, 'lean');
      const conservative = calculateCrewRequirements(effectiveCrew, 'conservative');

      const filled = Math.min(assignedPerShip.get(ship.id) ?? 0, effectiveCrew);

      return {
        shipId: ship.id,
        shipName: ship.name,
        maxCrew: effectiveCrew,
        leanRequired: lean.minCrew,
        conservativeRequired: conservative.minCrew,
        filled,
        passesLean: filled >= lean.minCrew,
        passesConservative: filled >= conservative.minCrew,
      };
    });

    // Overall gate: ALL ships must pass the selected mode
    const computeGateStatus = (): boolean => {
      if (perShip.length === 0) {
        return true;
      }
      if (crewMode === 'lean') {
        return perShip.every(s => s.passesLean);
      }
      return perShip.every(s => s.passesConservative);
    };
    const overallGatePassed = computeGateStatus();

    // Total required based on selected mode
    const requiredKey = crewMode === 'lean' ? 'leanRequired' : 'conservativeRequired';
    const totalRequired = perShip.reduce((sum, s) => sum + s[requiredKey], 0);

    const totalMaxCrew = perShip.reduce((sum, s) => sum + s.maxCrew, 0);
    const standbySlots = Math.ceil(totalMaxCrew * STANDBY_CREW_RATIO);
    const standbyFilled = Math.max(0, totalFilled - totalMaxCrew);

    const crewFillRate = totalRequired > 0 ? Math.min((totalFilled / totalRequired) * 100, 100) : 0;

    return {
      crewFillRate,
      totalRequired,
      totalFilled,
      totalMaxCrew,
      standbySlots,
      standbyFilled,
      perShip,
      overallGatePassed,
      crewMode,
    };
  }

  /**
   * Calculate team capacity for a fleet's team based on ship crew capacities.
   * Formula: totalMaxCrew + ceil(totalMaxCrew × standbyRatio)
   */
  calculateTeamCapacity(ships: Ship[]): {
    totalCrewPositions: number;
    standbySlots: number;
    totalCapacity: number;
  } {
    const totalCrewPositions = ships.reduce((sum, ship) => sum + resolveShipCrew(ship), 0);
    const standbySlots = Math.ceil(totalCrewPositions * STANDBY_CREW_RATIO);
    return {
      totalCrewPositions,
      standbySlots,
      totalCapacity: totalCrewPositions + standbySlots,
    };
  }

  // ── Private scoring helpers (extracted from fleetController) ─────

  /**
   * Calculate maintenance & supply health for a fleet.
   *
   * Supply-capable ships (large/capital) allocate cargo SCU as follows:
   * - 30% ammunition
   * - 40% fuel reserves (hydrogen + quantum)
   * - 30% repair materials & spare parts
   */
  private calculateMaintenanceHealth(ships: Ship[]): FleetMaintenanceHealth {
    const SUPPLY_CAPABLE_SIZES = new Set(['large', 'capital']);
    const AMMO_RATIO = 0.3;
    const FUEL_RATIO = 0.4;
    const REPAIR_RATIO = 0.3;

    const perShip: ShipMaintenanceStatus[] = ships.map(ship => {
      const cargoScu = ship.cargo ?? 0;
      const sizeVal = (ship.size ?? 'small').toLowerCase();
      const isSupplyCapable = SUPPLY_CAPABLE_SIZES.has(sizeVal) && cargoScu > 0;

      const supplyCapacity = isSupplyCapable
        ? {
            ammunition: Math.round(cargoScu * AMMO_RATIO),
            fuel: Math.round(cargoScu * FUEL_RATIO),
            repairMaterial: Math.round(cargoScu * REPAIR_RATIO),
            totalAllocated: cargoScu,
          }
        : { ammunition: 0, fuel: 0, repairMaterial: 0, totalAllocated: 0 };

      return {
        shipId: ship.id,
        shipName: ship.name,
        size: sizeVal,
        status: ship.status,
        isFlightReady: ship.status === 'flight_ready',
        maxCrew: ship.maxCrew ?? ship.crew ?? 1,
        hullHp: ship.armor ?? 0,
        shieldHp: ship.shields ?? 0,
        cargoScu,
        isSupplyCapable,
        supplyCapacity,
      };
    });

    const flightReadyShips = perShip.filter(s => s.isFlightReady).length;
    const supplyCapableShips = perShip.filter(s => s.isSupplyCapable).length;

    const totalSupply = perShip.reduce(
      (acc, s) => ({
        ammunition: acc.ammunition + s.supplyCapacity.ammunition,
        fuel: acc.fuel + s.supplyCapacity.fuel,
        repairMaterial: acc.repairMaterial + s.supplyCapacity.repairMaterial,
        totalScu: acc.totalScu + s.supplyCapacity.totalAllocated,
      }),
      { ammunition: 0, fuel: 0, repairMaterial: 0, totalScu: 0 }
    );

    return {
      totalShips: ships.length,
      flightReadyShips,
      supplyCapableShips,
      totalSupply,
      perShip,
    };
  }

  private computeCapabilityScore(ships: Ship[]): number {
    let combatCapable = 0;
    let cargoCapable = 0;
    let totalCrew = 0;

    for (const ship of ships) {
      const role = (ship.role ?? '').toLowerCase();
      if (role.includes('combat') || role.includes('fighter') || role.includes('bomber')) {
        combatCapable++;
      }
      if (role.includes('cargo') || role.includes('freight') || role.includes('transport')) {
        cargoCapable++;
      }
      totalCrew += ship.maxCrew || 0;
    }

    const diversityFactors = [
      combatCapable > 0 ? 1 : 0,
      cargoCapable > 0 ? 1 : 0,
      totalCrew >= 5 ? 1 : 0,
      ships.length >= 3 ? 1 : 0,
    ];

    return (diversityFactors.reduce((s, v) => s + v, 0) / diversityFactors.length) * 100;
  }

  private computeOperationalScore(fleet: Fleet): number {
    const ops = fleet.operationalStats as
      | { averageUptime?: number; missionsCompleted?: number }
      | undefined;

    if (ops?.averageUptime !== null && ops?.averageUptime !== undefined) {
      return Math.min(ops.averageUptime, 100);
    }
    if (fleet.status === FleetStatus.DEPLOYED) {
      return 100;
    }
    return 0;
  }
}

