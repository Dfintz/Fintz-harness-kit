import { Fleet, FleetStatus } from '../../models/Fleet';
import { Ship } from '../../models/Ship';

export interface ShipMetrics {
  flightReadyCount: number;
  combatCapable: number;
  cargoCapable: number;
  totalCrew: number;
}

/** Compute ship readiness, capability, and crew tallies. */
export function computeShipMetrics(ships: Ship[]): ShipMetrics {
  let flightReadyCount = 0;
  let combatCapable = 0;
  let cargoCapable = 0;
  let totalCrew = 0;

  for (const ship of ships) {
    if (ship.status === 'flight_ready') {
      flightReadyCount++;
    }
    const role = (ship.role ?? '').toLowerCase();
    if (role.includes('combat') || role.includes('fighter') || role.includes('bomber')) {
      combatCapable++;
    }
    if (role.includes('cargo') || role.includes('freight') || role.includes('transport')) {
      cargoCapable++;
    }
    totalCrew += ship.maxCrew ?? 0;
  }

  return { flightReadyCount, combatCapable, cargoCapable, totalCrew };
}

/**
 * Derive an operational score from fleet stats and status.
 * Returns 0 for new/empty fleets — operational readiness requires
 * actual activity data (future: logistics, fuel, armament, maintenance).
 */
export function computeOperationalScore(fleet: Pick<Fleet, 'operationalStats' | 'status'>): number {
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
