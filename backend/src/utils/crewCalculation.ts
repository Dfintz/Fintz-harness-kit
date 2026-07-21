/**
 * Crew Calculation Utilities
 *
 * NOTE: This file is duplicated at frontend/src/utils/crewCalculation.ts.
 * Both copies must be kept in sync until a shared-utils package is created.
 * See: https://github.com/sc-fleet-manager — tech debt backlog.
 *
 * Derives minimum and maximum crew requirements from a ship's crew value.
 *
 * - **Lean** (0.4×): Pilot + only the most critical specialists.
 * - **Conservative** (0.5×): Most roles filled by humans for best performance.
 * - **Max** (1.0×): Full crew complement.
 *
 * These multipliers model realistic operational crewing for Star Citizen ships
 * without relying on separate minCrew/maxCrew fields from external data sources.
 */

export type CrewMode = 'lean' | 'conservative';

const CREW_MULTIPLIERS: Record<CrewMode, number> = {
  lean: 0.4,
  conservative: 0.5,
};

export interface CrewRequirements {
  /** Minimum crew needed (ceil of crew × multiplier, at least 1) */
  minCrew: number;
  /** Maximum crew (the ship's full crew complement) */
  maxCrew: number;
  /** The multiplier used for minCrew */
  multiplier: number;
  /** The crew mode used */
  mode: CrewMode;
}

/**
 * Calculate min/max crew requirements from a ship's crew value.
 *
 * @param crew - The ship's crew capacity (from Ship.crew field)
 * @param mode - 'lean' (0.4×) or 'conservative' (0.5×), defaults to 'lean'
 * @returns Calculated min/max crew with at least 1 for each
 */
export function calculateCrewRequirements(
  crew: number | undefined | null,
  mode: CrewMode = 'lean'
): CrewRequirements {
  const effectiveCrew = crew && crew > 0 ? crew : 1;
  const multiplier = CREW_MULTIPLIERS[mode];
  const minCrew = Math.max(1, Math.ceil(effectiveCrew * multiplier));

  return {
    minCrew,
    maxCrew: effectiveCrew,
    multiplier,
    mode,
  };
}

/**
 * Resolve the effective crew value from a ship's fields.
 *
 * Picks the larger of maxCrew and crew, falling back to 1.
 *
 * Background: the Erkul live API only exposes a single `vehicle.crewSize`
 * value, which is the *minimum operating crew* (often 1) — not the total
 * crew complement. Our catalogue stores the curated full complement in
 * `maxCrew`. Using `Math.max` ensures backfilled `maxCrew` is preferred
 * over a stale `crew=1` left behind by Erkul ingestion, without regressing
 * older rows where only `crew` was populated.
 */
export function resolveShipCrew(ship: { crew?: number | null; maxCrew?: number | null }): number {
  return Math.max(ship.maxCrew ?? 0, ship.crew ?? 0) || 1;
}

/**
 * Calculate total crew from ship requirement entries (pure, no DB lookups).
 * Uses the crewPerShip / avgCrewPerShip values already present in each entry.
 */
export function calculateCrewFromRequirements(
  requirements: ReadonlyArray<{
    requirementType: string;
    count: number;
    crewPerShip?: number;
    avgCrewPerShip?: number;
  }>
): number {
  let total = 0;
  for (const req of requirements) {
    if (req.requirementType === 'specific') {
      total += req.count * (req.crewPerShip || 1);
    } else if (req.requirementType === 'role') {
      total += req.count * (req.avgCrewPerShip || 1);
    }
  }
  return total;
}
