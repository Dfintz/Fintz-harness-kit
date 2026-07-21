/**
 * Crew-select menu value codec for the event ship-crew pickers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the pure,
 * deterministic encode/decode logic for crew-select option values its own ownership
 * boundary, separate from the Discord interaction handlers.
 *
 * The select-menu option value packs a ship identifier and its list index into a
 * single opaque string (`sid:<encoded-id>:<index>`); these helpers are the single
 * source of truth for that wire format, so the build and parse sides cannot drift.
 *
 * This module is dependency-free of `eventButtons.ts` (one-way: handlers import from
 * here) and of everything else — keeping the import graph acyclic. The helpers are
 * consumed only inside `eventButtons.ts`, so they are not re-exported there.
 */

/** Prefix marking a crew-select option value as the structured `sid:<id>:<index>` form. */
const CREW_SELECT_VALUE_PREFIX = 'sid:';

/**
 * Derive a stable ship identifier from a ship-like record, preferring the most
 * specific field available. Returns `null` when no non-empty identifier exists, so
 * callers can filter out unselectable ships.
 */
export function getCrewShipIdentifier(ship: {
  id?: string;
  shipId?: string;
  ownerId?: string;
}): string | null {
  const identifier = ship.id ?? ship.shipId ?? ship.ownerId;
  const normalized = identifier?.trim();
  return normalized || null;
}

/**
 * Pack a ship identifier and its list index into a single crew-select option value.
 * The identifier is URL-encoded so the `:` delimiter stays unambiguous.
 */
export function buildCrewSelectValue(shipIdentifier: string, index: number): string {
  return `${CREW_SELECT_VALUE_PREFIX}${encodeURIComponent(shipIdentifier)}:${index}`;
}

/**
 * Unpack a crew-select option value produced by {@link buildCrewSelectValue}.
 *
 * Falls back to treating the whole value as a bare identifier (with an undefined
 * index) when the input does not match the structured form or cannot be decoded —
 * so a legacy or malformed value never throws.
 */
export function parseCrewSelectValue(value: string): {
  shipIdentifier: string;
  shipIndex: number | undefined;
} {
  const match = /^sid:([^:]+):(\d+)$/.exec(value);
  if (!match) {
    return {
      shipIdentifier: value,
      shipIndex: undefined,
    };
  }

  try {
    return {
      shipIdentifier: decodeURIComponent(match[1]),
      shipIndex: Number.parseInt(match[2], 10),
    };
  } catch {
    return {
      shipIdentifier: value,
      shipIndex: undefined,
    };
  }
}
