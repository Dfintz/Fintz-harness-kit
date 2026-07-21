/**
 * Hangar ship grouping for the event bring-fleet/bring-ship pickers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the pure,
 * deterministic hangar-grouping logic its own ownership boundary, separate from the
 * Discord interaction handlers. `eventButtons.ts` re-exports `HangarSuggestion`,
 * `HangarGroup`, and `buildHangarGroups`, so every existing import path is preserved.
 *
 * This module is dependency-free of `eventButtons.ts` (one-way: handlers import from
 * here), keeping the import graph acyclic.
 */
import { getShipRoleEmoji, SHIP_ROLES, type ShipRoleCategory } from '../constants/shipTaxonomy';

/** Max options Discord allows in a select menu (minus 1 for manual). */
export const MAX_HANGAR_OPTIONS = 24;

export interface HangarSuggestion {
  userShipId: string;
  /** Display name: customName or catalogue name. */
  displayName: string;
  /** Catalogue ship name (e.g. "Cutlass Black"). */
  catalogueName: string;
  /** Taxonomy role category (e.g. "Combat"). */
  roleCategory?: ShipRoleCategory;
  /** Specific type (e.g. "Light Fighter"), if derivable. */
  shipType?: string;
  /** Max crew from catalogue. */
  maxCrew: number;
  /** Whether this ship satisfies at least one unfilled event requirement. */
  matchesRequirement: boolean;
}

/** A browsable group of hangar ships, guaranteed to fit one select menu. */
export interface HangarGroup {
  /** Opaque key carried as the select option value. */
  key: string;
  /** Human-facing label for the option and the follow-up header. */
  label: string;
  /** Leading emoji for the option. */
  emoji: string;
  /** The exact ships in this group — never more than MAX_HANGAR_OPTIONS. */
  ships: HangarSuggestion[];
}

/** First display letter of a suggestion, upper-cased ('#' when empty). */
function firstLetter(s: HangarSuggestion): string {
  return s.displayName[0]?.toUpperCase() ?? '#';
}

/**
 * Split an (already alphabetically-sorted) ship list into fixed-size chunks
 * that each fit one select menu. Multi-chunk groups are suffixed with their
 * letter range so the picker reads A→Z. Index-based chunking guarantees a chunk
 * never exceeds the limit, even when many ships share a first letter — which is
 * what previously produced a truncated, partial list.
 */
function chunkShipsToGroups(
  ships: HangarSuggestion[],
  opts: { labelPrefix: string; keyPrefix: string; emoji: string }
): HangarGroup[] {
  const groups: HangarGroup[] = [];
  const multiChunk = ships.length > MAX_HANGAR_OPTIONS;

  for (let i = 0; i < ships.length; i += MAX_HANGAR_OPTIONS) {
    const slice = ships.slice(i, i + MAX_HANGAR_OPTIONS);
    const chunkIndex = i / MAX_HANGAR_OPTIONS;
    const first = firstLetter(slice[0]);
    const last = firstLetter(slice.at(-1) ?? slice[0]);
    const range = first === last ? first : `${first}–${last}`;
    const label = multiChunk ? `${opts.labelPrefix} (${range})` : opts.labelPrefix;
    groups.push({
      key: `${opts.keyPrefix}:${chunkIndex}`,
      label: label.slice(0, 100),
      emoji: opts.emoji,
      ships: slice,
    });
  }

  return groups;
}

/**
 * Group a bucket of ships by role category, chunking any role that overflows a
 * single menu. Roles render in canonical SHIP_ROLES order; ships without a role
 * fall into a trailing "Other" group. When role metadata is absent the result
 * degrades gracefully to plain A→Z chunks under "Other".
 */
function groupBucketByRole(ships: HangarSuggestion[], opts: { matched: boolean }): HangarGroup[] {
  const byRole = new Map<string, HangarSuggestion[]>();
  for (const s of ships) {
    const role = s.roleCategory ?? 'Other';
    const list = byRole.get(role);
    if (list) {
      list.push(s);
    } else {
      byRole.set(role, [s]);
    }
  }

  // Canonical role order first, then any unexpected roles, then "Other" last.
  const extraRoles = [...byRole.keys()].filter(
    r => !SHIP_ROLES.includes(r as ShipRoleCategory) && r !== 'Other'
  );
  const orderedRoles = [
    ...SHIP_ROLES.filter(r => byRole.has(r)),
    ...extraRoles,
    ...(byRole.has('Other') ? ['Other'] : []),
  ];

  const bucketPrefix = opts.matched ? 'm' : 'n';
  const groups: HangarGroup[] = [];
  for (const role of orderedRoles) {
    const roleShips = byRole.get(role) ?? [];
    // getShipRoleEmoji('Other') already falls back to 🚀, so no special-casing.
    const emoji = opts.matched ? '✅' : getShipRoleEmoji(role);
    groups.push(
      ...chunkShipsToGroups(roleShips, {
        labelPrefix: opts.matched ? `Matching · ${role}` : role,
        keyPrefix: `${bucketPrefix}:${role}`,
        emoji,
      })
    );
  }

  return groups;
}

/**
 * Build browsable, menu-safe groups from a hangar suggestion list.
 *
 * Splits matching vs non-matching ships only when that distinction is
 * meaningful (some ships match a real requirement and some do not — when the
 * event has no requirements every ship "matches", so we group purely by role).
 * Each side is grouped by role with alphabetical chunking, so **every** returned
 * group fits one select menu and no ship is ever dropped from a partial list.
 *
 * Deterministic for a given input, so the picker and the follow-up filter agree
 * on group membership (each group carries its exact ships).
 */
export function buildHangarGroups(suggestions: HangarSuggestion[]): HangarGroup[] {
  const hasMatch = suggestions.some(s => s.matchesRequirement);
  const hasNonMatch = suggestions.some(s => !s.matchesRequirement);

  if (hasMatch && hasNonMatch) {
    return [
      ...groupBucketByRole(
        suggestions.filter(s => s.matchesRequirement),
        { matched: true }
      ),
      ...groupBucketByRole(
        suggestions.filter(s => !s.matchesRequirement),
        { matched: false }
      ),
    ];
  }

  return groupBucketByRole(suggestions, { matched: false });
}
