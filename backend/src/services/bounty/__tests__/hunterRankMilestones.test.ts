// Unit tests for hunter rank milestones (Phase 4 C8 / INT-05 — rank-up recognition).

import { HunterRank } from '../../../models/HunterProfile';
import {
  HUNTER_RANK_ORDER,
  formatHunterRankPromotion,
  getHunterRankIndex,
  isHunterRankPromotion,
} from '../hunterRankMilestones';

describe('HUNTER_RANK_ORDER', () => {
  it('lists every rank exactly once, lowest tier first', () => {
    expect(HUNTER_RANK_ORDER).toEqual([
      HunterRank.ROOKIE,
      HunterRank.APPRENTICE,
      HunterRank.HUNTER,
      HunterRank.VETERAN,
      HunterRank.ELITE,
      HunterRank.LEGENDARY,
    ]);
    // No rank missing and none duplicated.
    expect(new Set(HUNTER_RANK_ORDER).size).toBe(Object.values(HunterRank).length);
  });
});

describe('getHunterRankIndex', () => {
  it('returns the ascending ordinal position of a known rank', () => {
    expect(getHunterRankIndex(HunterRank.ROOKIE)).toBe(0);
    expect(getHunterRankIndex(HunterRank.HUNTER)).toBe(2);
    expect(getHunterRankIndex(HunterRank.LEGENDARY)).toBe(HUNTER_RANK_ORDER.length - 1);
  });

  it('returns -1 for an unknown rank value', () => {
    expect(getHunterRankIndex('overlord' as HunterRank)).toBe(-1);
  });
});

describe('isHunterRankPromotion', () => {
  it('is true only when the new rank is a strictly higher tier', () => {
    expect(isHunterRankPromotion(HunterRank.ROOKIE, HunterRank.APPRENTICE)).toBe(true);
    expect(isHunterRankPromotion(HunterRank.HUNTER, HunterRank.LEGENDARY)).toBe(true);
  });

  it('is false for a demotion or no change', () => {
    expect(isHunterRankPromotion(HunterRank.HUNTER, HunterRank.HUNTER)).toBe(false);
    expect(isHunterRankPromotion(HunterRank.ELITE, HunterRank.ROOKIE)).toBe(false);
  });

  it('is false when either rank is unknown', () => {
    expect(isHunterRankPromotion('overlord' as HunterRank, HunterRank.LEGENDARY)).toBe(false);
    expect(isHunterRankPromotion(HunterRank.ROOKIE, 'overlord' as HunterRank)).toBe(false);
  });
});

describe('formatHunterRankPromotion', () => {
  it('returns null when the transition is not a promotion', () => {
    expect(formatHunterRankPromotion(HunterRank.HUNTER, HunterRank.HUNTER)).toBeNull();
    expect(formatHunterRankPromotion(HunterRank.ELITE, HunterRank.VETERAN)).toBeNull();
  });

  it('celebrates a promotion with both rank labels and an onward nudge', () => {
    const msg = formatHunterRankPromotion(HunterRank.ROOKIE, HunterRank.APPRENTICE);
    expect(msg).toContain('Rookie');
    expect(msg).toContain('Apprentice');
    expect(msg).toContain('Keep hunting');
    expect(msg).not.toContain('🏆');
  });

  it('celebrates reaching the highest rank without an onward nudge', () => {
    const msg = formatHunterRankPromotion(HunterRank.ELITE, HunterRank.LEGENDARY);
    expect(msg).toContain('Legendary');
    expect(msg).toContain('🏆');
    expect(msg).not.toContain('Keep hunting');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

