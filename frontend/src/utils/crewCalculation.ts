/**
 * Crew Calculation Utilities
 *
 * NOTE: This file is duplicated at backend/src/utils/crewCalculation.ts.
 * Both copies must be kept in sync until a shared-utils package is created.
 *
 * Derives minimum and maximum crew requirements from a ship's crew value.
 *
 * - **Lean** (0.4×): Pilot + only the most critical specialists.
 * - **Conservative** (0.5×): Most roles filled by humans for best performance.
 * - **Max** (1.0×): Full crew complement.
 */

export type CrewMode = 'lean' | 'conservative';

const CREW_MULTIPLIERS: Record<CrewMode, number> = {
  lean: 0.4,
  conservative: 0.5,
};

export interface CrewRequirements {
  minCrew: number;
  maxCrew: number;
  multiplier: number;
  mode: CrewMode;
}

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

export function resolveShipCrew(ship: {
  crew?: number | null;
  maxCrew?: number | null;
  size?: string | null;
}): number {
  // Prefer the larger of maxCrew/crew. The Erkul live API only reports
  // `vehicle.crewSize` (minimum operating crew, often 1); curated
  // `maxCrew` carries the full complement. Falling back to the max
  // avoids stale crew=1 values shadowing a backfilled maxCrew.
  const rawCrew = Math.max(ship.maxCrew ?? 0, ship.crew ?? 0) || null;

  // If crew data exists and is reasonable, use it
  if (rawCrew && rawCrew > 1) return rawCrew;

  // Heuristic: many capital/large ships have crew=1 in RSI Ship Matrix
  // (it reports minimum pilot count, not recommended crew)
  // Use size-based defaults when crew is missing or suspiciously low (1)
  if (ship.size) {
    const sizeDefaults: Record<string, number> = {
      capital: 20,
      large: 6,
      medium: 3,
      small: 1,
      snub: 1,
      vehicle: 1,
    };
    const sizeDefault = sizeDefaults[ship.size.toLowerCase()];
    if (sizeDefault && (!rawCrew || rawCrew < sizeDefault)) {
      return sizeDefault;
    }
  }

  return rawCrew ?? 1;
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
