/**
 * Hunter rank milestones (Phase 4 C8 / INT-05 — bounty rank-up recognition).
 *
 * A hunter's rank is an ordinal tier (ROOKIE → APPRENTICE → HUNTER → VETERAN →
 * ELITE → LEGENDARY) derived from lifetime bounty performance. A *promotion* —
 * moving to a strictly higher tier — is the moment worth recognising. This
 * module is the pure, dependency-free source of truth for the tier ordering and
 * the "was this a promotion" check, so it can be unit tested without the
 * DB/Discord stack and reused by any surface (web notification, bot, API).
 *
 * It imports only the canonical {@link HunterRank} enum (the rank vocabulary's
 * owner) — it never re-declares the tiers — and performs no I/O.
 */
import { HunterRank } from '../../models/HunterProfile';

/** Hunter ranks from lowest to highest tier. Array index = ordinal rank. */
export const HUNTER_RANK_ORDER: readonly HunterRank[] = [
  HunterRank.ROOKIE,
  HunterRank.APPRENTICE,
  HunterRank.HUNTER,
  HunterRank.VETERAN,
  HunterRank.ELITE,
  HunterRank.LEGENDARY,
] as const;

/** Human-facing display label per rank (title-cased for messages). */
const HUNTER_RANK_LABEL: Record<HunterRank, string> = {
  [HunterRank.ROOKIE]: 'Rookie',
  [HunterRank.APPRENTICE]: 'Apprentice',
  [HunterRank.HUNTER]: 'Hunter',
  [HunterRank.VETERAN]: 'Veteran',
  [HunterRank.ELITE]: 'Elite',
  [HunterRank.LEGENDARY]: 'Legendary',
};

/**
 * Ordinal position of a rank in {@link HUNTER_RANK_ORDER} (0 = lowest tier), or
 * `-1` if the value is not a known rank.
 */
export function getHunterRankIndex(rank: HunterRank): number {
  return HUNTER_RANK_ORDER.indexOf(rank);
}

/**
 * Whether moving from `previousRank` to `newRank` is a promotion (a strictly
 * higher tier). Demotions and no-change return `false`; an unknown rank on
 * either side (index `-1`) never counts as a promotion.
 */
export function isHunterRankPromotion(previousRank: HunterRank, newRank: HunterRank): boolean {
  const previousIndex = getHunterRankIndex(previousRank);
  const newIndex = getHunterRankIndex(newRank);
  if (previousIndex < 0 || newIndex < 0) {
    return false;
  }
  return newIndex > previousIndex;
}

/**
 * Build a celebratory one-line message for a hunter promotion, or `null` when
 * the transition is not a promotion (so callers only surface recognition on a
 * genuine rank-up — never on a demotion or no-change).
 */
export function formatHunterRankPromotion(
  previousRank: HunterRank,
  newRank: HunterRank
): string | null {
  if (!isHunterRankPromotion(previousRank, newRank)) {
    return null;
  }
  const reachedTop = getHunterRankIndex(newRank) === HUNTER_RANK_ORDER.length - 1;
  const headline = `🎖️ **Rank up:** ${HUNTER_RANK_LABEL[previousRank]} → **${HUNTER_RANK_LABEL[newRank]}**!`;
  return reachedTop
    ? `${headline} You've reached the highest hunter rank — legendary work. 🏆`
    : `${headline} Keep hunting to climb higher.`;
}

