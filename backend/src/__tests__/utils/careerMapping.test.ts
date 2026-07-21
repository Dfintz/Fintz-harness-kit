/**
 * resolveDisplayCareer — Unit Tests
 *
 * Verifies the career display mapping utility that transforms raw catalogue
 * career values into user-facing display categories.
 */

import { resolveDisplayCareer } from '../../utils/careerMapping';

describe('resolveDisplayCareer', () => {
  // ─── Simple renames ────────────────────────────────────────────────────

  it('maps Transporter → Hauling', () => {
    expect(resolveDisplayCareer('Transporter')).toBe('Hauling');
  });

  it('maps Support → Medical', () => {
    expect(resolveDisplayCareer('Support')).toBe('Medical');
  });

  it('maps Ground → Driving', () => {
    expect(resolveDisplayCareer('Ground')).toBe('Driving');
  });

  it('maps Ground Combat → Driving', () => {
    expect(resolveDisplayCareer('Ground Combat')).toBe('Driving');
  });

  it('maps Competition → Racing', () => {
    expect(resolveDisplayCareer('Competition')).toBe('Racing');
  });

  it('maps Exploration → Exploration', () => {
    expect(resolveDisplayCareer('Exploration')).toBe('Exploration');
  });

  it('maps Multi-Role → Multi-Role', () => {
    expect(resolveDisplayCareer('Multi-Role')).toBe('Multi-Role');
    expect(resolveDisplayCareer('Multirole')).toBe('Multi-Role');
  });

  it('is case-insensitive', () => {
    expect(resolveDisplayCareer('transporter')).toBe('Hauling');
    expect(resolveDisplayCareer('SUPPORT')).toBe('Medical');
    expect(resolveDisplayCareer('GROUND COMBAT')).toBe('Driving');
  });

  // ─── Industrial split ──────────────────────────────────────────────────

  describe('Industrial split', () => {
    it('maps Industrial with mining role → Mining', () => {
      expect(resolveDisplayCareer('Industrial', 'Mining')).toBe('Mining');
      expect(resolveDisplayCareer('Industrial', 'Light Mining')).toBe('Mining');
    });

    it('maps Industrial with refining role → Mining', () => {
      expect(resolveDisplayCareer('Industrial', 'Refining')).toBe('Mining');
    });

    it('maps Industrial with salvage role → Salvaging', () => {
      expect(resolveDisplayCareer('Industrial', 'Salvage')).toBe('Salvaging');
      expect(resolveDisplayCareer('Industrial', 'Light Salvage')).toBe('Salvaging');
    });

    it('keeps Industrial when role is neither mining nor salvage', () => {
      expect(resolveDisplayCareer('Industrial', 'Construction')).toBe('Industrial');
      expect(resolveDisplayCareer('Industrial')).toBe('Industrial');
    });
  });

  // ─── Combat size-based split ───────────────────────────────────────────

  describe('Combat → Capital Crew (size based)', () => {
    it('maps Combat + large → Capital Crew', () => {
      expect(resolveDisplayCareer('Combat', undefined, 'large')).toBe('Capital Crew');
    });

    it('maps Combat + sub_capital → Capital Crew', () => {
      expect(resolveDisplayCareer('Combat', undefined, 'sub_capital')).toBe('Capital Crew');
    });

    it('maps Combat + capital → Capital Crew', () => {
      expect(resolveDisplayCareer('Combat', undefined, 'capital')).toBe('Capital Crew');
    });

    it('keeps Combat for smaller sizes', () => {
      expect(resolveDisplayCareer('Combat', undefined, 'small')).toBe('Combat');
      expect(resolveDisplayCareer('Combat', undefined, 'medium')).toBe('Combat');
      expect(resolveDisplayCareer('Combat', undefined, 'snub')).toBe('Combat');
    });

    it('keeps Combat when size is undefined', () => {
      expect(resolveDisplayCareer('Combat')).toBe('Combat');
    });
  });

  // ─── Gunship ───────────────────────────────────────────────────────────

  it('maps Gunship → Gunship', () => {
    expect(resolveDisplayCareer('Gunship')).toBe('Gunship');
  });

  // ─── Starter redistribution ────────────────────────────────────────────

  describe('Starter redistribution by role', () => {
    it('redistributes Starter with mining role → Mining', () => {
      expect(resolveDisplayCareer('Starter', 'Light Mining')).toBe('Mining');
    });

    it('redistributes Starter with salvage role → Salvaging', () => {
      expect(resolveDisplayCareer('Starter', 'Light Salvage')).toBe('Salvaging');
    });

    it('redistributes Starter with combat/fighter role → Combat', () => {
      expect(resolveDisplayCareer('Starter', 'Light Fighter')).toBe('Combat');
    });

    it('redistributes Starter with transport role → Hauling', () => {
      expect(resolveDisplayCareer('Starter', 'Medium Freight')).toBe('Hauling');
    });

    it('redistributes Starter with exploration role → Exploration', () => {
      expect(resolveDisplayCareer('Starter', 'Pathfinder')).toBe('Exploration');
    });

    it('redistributes Starter with medical role → Medical', () => {
      expect(resolveDisplayCareer('Starter', 'Medical')).toBe('Medical');
    });

    it('defaults Starter to Combat when role is unknown', () => {
      expect(resolveDisplayCareer('Starter')).toBe('Combat');
      expect(resolveDisplayCareer('Starter', 'Unknown')).toBe('Combat');
    });
  });

  // ─── Ship-level overrides ─────────────────────────────────────────────

  describe('ship-level overrides', () => {
    it('overrides Asgard → Gunship', () => {
      expect(resolveDisplayCareer('Combat', 'Heavy Fighter', 'large', 'Asgard')).toBe('Gunship');
    });

    it('overrides Avenger Titan → Combat', () => {
      expect(resolveDisplayCareer('Multi-Role', undefined, 'small', 'Avenger Titan')).toBe(
        'Combat'
      );
    });

    it('overrides Constellation Andromeda → Combat', () => {
      expect(
        resolveDisplayCareer('Multi-Role', undefined, 'large', 'Constellation Andromeda')
      ).toBe('Capital Crew');
      // Note: override sets raw career to Combat, then size=large → Capital Crew
    });

    it('overrides Mercury Star Runner → Hauling', () => {
      expect(resolveDisplayCareer('Multi-Role', undefined, 'medium', 'Mercury Star Runner')).toBe(
        'Hauling'
      );
    });

    it('does not apply overrides for non-matching ship names', () => {
      expect(resolveDisplayCareer('Combat', 'Light Fighter', 'small', 'Gladius')).toBe('Combat');
    });

    it("overrides Teach's Special variants", () => {
      expect(resolveDisplayCareer('', undefined, undefined, "Fortune Teach's Special")).toBe(
        'Salvaging'
      );
      expect(resolveDisplayCareer('', undefined, undefined, "Golem Teach's Special")).toBe(
        'Mining'
      );
      expect(resolveDisplayCareer('', undefined, undefined, "Reclaimer Teach's Special")).toBe(
        'Salvaging'
      );
    });

    it('overrides concept ships without career', () => {
      expect(resolveDisplayCareer('', undefined, undefined, 'Merchantman')).toBe('Hauling');
      expect(resolveDisplayCareer('', undefined, undefined, 'Javelin')).toBe('Capital Crew');
      expect(resolveDisplayCareer('', undefined, undefined, 'Orion')).toBe('Mining');
      expect(resolveDisplayCareer('', undefined, undefined, 'Odyssey')).toBe('Exploration');
    });
  });

  // ─── Empty career + role inference ─────────────────────────────────────

  describe('empty career with role inference', () => {
    it('infers Mining from role when career is empty', () => {
      expect(resolveDisplayCareer('', 'Mining')).toBe('Mining');
    });

    it('infers Salvaging from role when career is empty', () => {
      expect(resolveDisplayCareer('', 'Light Salvage')).toBe('Salvaging');
    });

    it('infers Combat from role when career is empty', () => {
      expect(resolveDisplayCareer('', 'Light Fighter')).toBe('Combat');
    });

    it('infers Hauling from role when career is empty', () => {
      expect(resolveDisplayCareer('', 'Medium Freight')).toBe('Hauling');
    });

    it('returns Unknown when career is empty and role has no hint', () => {
      expect(resolveDisplayCareer('')).toBe('Unknown');
      expect(resolveDisplayCareer('', 'SomethingRandom')).toBe('Unknown');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  it('returns Unknown for empty career with no role', () => {
    expect(resolveDisplayCareer('')).toBe('Unknown');
  });

  it('passes through unrecognised careers', () => {
    expect(resolveDisplayCareer('SomeFutureCareer')).toBe('SomeFutureCareer');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
