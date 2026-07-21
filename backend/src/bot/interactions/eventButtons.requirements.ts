/**
 * Required-ship-type parsing and fill-count matching for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the pure
 * logic that works with an activity's `requiredShipTypes` its own ownership boundary,
 * separate from the Discord interaction handlers:
 * - `parseRequiredShipTypes` normalises the column into a structured `ShipRequirement[]`.
 * - `computeFilledCounts` matches committed ships against those requirements, mutating
 *   each requirement's `filled` count (one ship fills at most one requirement).
 *
 * The column has accumulated three on-disk shapes over time — a JSON array of
 * `ShipRequirement` objects (current), a JSON array of legacy type-name strings, and
 * a bare comma-separated string (oldest). `parseRequiredShipTypes` accepts all three
 * and always returns the structured form, so the handlers never branch on storage
 * shape.
 *
 * This module is pure (its only dependencies are the ship-taxonomy constants/types),
 * keeping the import graph acyclic (one-way: handlers → parser). Both exports are
 * imported back by `eventButtons.ts`; they are not re-exported (no external or test
 * consumers).
 */
import {
  shipMatchesRequirement,
  TYPE_TO_ROLE,
  type ShipRequirement,
} from '../constants/shipTaxonomy';

/** Map a single legacy type-name string to a structured, preferred-strictness requirement. */
function legacyNameToRequirement(name: string): ShipRequirement {
  const parentRole = TYPE_TO_ROLE[name];
  return {
    role: parentRole,
    type: parentRole ? name : undefined,
    count: 1,
    filled: 0,
    strictness: 'preferred' as const,
  };
}

/**
 * Normalise an activity's `requiredShipTypes` column into `ShipRequirement[]`.
 *
 * Handles all historical storage shapes:
 * - JSON array of `ShipRequirement` objects → returned as-is
 * - JSON array of legacy type-name strings → mapped via {@link legacyNameToRequirement}
 * - bare comma-separated string (parse fallback) → split, trimmed, then mapped
 *
 * Returns `[]` for nullish/empty input or an unrecognised array element shape.
 */
export function parseRequiredShipTypes(raw: string | null | undefined): ShipRequirement[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    if (typeof parsed[0] === 'object' && 'count' in parsed[0]) {
      return parsed as ShipRequirement[];
    }
    if (typeof parsed[0] === 'string') {
      return (parsed as string[]).map(legacyNameToRequirement);
    }
    return [];
  } catch {
    const names = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return names.map(legacyNameToRequirement);
  }
}

/**
 * Compute filled counts for requirements — each ship fills at most one requirement.
 *
 * Mutates `reqs` in place, setting each `req.filled` to the number of committed ships
 * that satisfy it. A ship is claimed by the first requirement it matches (keyed by
 * `id`, or `ownerId_shipType` when unsaved), so it cannot double-count across
 * requirements, and matching for a requirement stops once its `count` is met.
 */
export function computeFilledCounts(
  reqs: ShipRequirement[],
  ships: Array<{ id?: string; ownerId: string; shipType: string; role?: string }>
): void {
  const claimed = new Set<string>();
  for (const req of reqs) {
    let filled = 0;
    for (const s of ships) {
      const key = s.id ?? `${s.ownerId}_${s.shipType}`;
      if (claimed.has(key)) {
        continue;
      }
      if (shipMatchesRequirement(s.role, s.shipType, req)) {
        filled++;
        claimed.add(key);
        if (filled >= req.count) {
          break;
        }
      }
    }
    req.filled = filled;
  }
}
