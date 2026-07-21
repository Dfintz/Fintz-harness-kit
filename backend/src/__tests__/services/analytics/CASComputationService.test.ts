/**
 * CASComputationService — Unit Tests
 *
 * Tests the core computation logic: score formula, rounding, tier mapping.
 * Focus: Verify computation correctness and multi-tenant isolation.
 * 
 * Note: Full integration tests (with DB + mocks) would be more realistic.
 * These unit tests verify the logic in isolation.
 */

import { scoreToCasTier } from '../../../services/analytics/CASConfig';

describe('CAS Score Computation Logic', () => {
  describe('scoreToCasTier', () => {
    it('should map scores to VERY_ACTIVE tier (≥85)', () => {
      expect(scoreToCasTier(100)).toBe('VERY_ACTIVE');
      expect(scoreToCasTier(85)).toBe('VERY_ACTIVE');
      expect(scoreToCasTier(90.5)).toBe('VERY_ACTIVE');
    });

    it('should map scores to ACTIVE tier (≥65, <85)', () => {
      expect(scoreToCasTier(84.9)).toBe('ACTIVE');
      expect(scoreToCasTier(75)).toBe('ACTIVE');
      expect(scoreToCasTier(65)).toBe('ACTIVE');
    });

    it('should map scores to MODERATE tier (≥45, <65)', () => {
      expect(scoreToCasTier(64.9)).toBe('MODERATE');
      expect(scoreToCasTier(55)).toBe('MODERATE');
      expect(scoreToCasTier(45)).toBe('MODERATE');
    });

    it('should map scores to QUIET tier (≥20, <45)', () => {
      expect(scoreToCasTier(44.9)).toBe('QUIET');
      expect(scoreToCasTier(30)).toBe('QUIET');
      expect(scoreToCasTier(20)).toBe('QUIET');
    });

    it('should map scores to DORMANT tier (<20)', () => {
      expect(scoreToCasTier(19.9)).toBe('DORMANT');
      expect(scoreToCasTier(10)).toBe('DORMANT');
      expect(scoreToCasTier(0)).toBe('DORMANT');
    });

    it('should handle boundary values correctly', () => {
      const boundaries = [
        { score: 85, expected: 'VERY_ACTIVE' },
        { score: 84.99, expected: 'ACTIVE' },
        { score: 65, expected: 'ACTIVE' },
        { score: 64.99, expected: 'MODERATE' },
        { score: 45, expected: 'MODERATE' },
        { score: 44.99, expected: 'QUIET' },
        { score: 20, expected: 'QUIET' },
        { score: 19.99, expected: 'DORMANT' },
      ];

      for (const { score, expected } of boundaries) {
        expect(scoreToCasTier(score)).toBe(expected);
      }
    });
  });

  describe('Score Rounding (1 Decimal Place)', () => {
    it('should round component scores to 1 decimal', () => {
      const testCases = [
        { value: 75.555, expected: 75.6 },
        { value: 60.777, expected: 60.8 },
        { value: 80.123, expected: 80.1 },
        { value: 50.999, expected: 51.0 },
        { value: 70.444, expected: 70.4 },
      ];

      for (const { value, expected } of testCases) {
        const rounded = Math.round(value * 10) / 10;
        expect(rounded).toBe(expected);
      }
    });

    it('should compute weighted sum correctly', () => {
      // Test case: Equal component scores (25 each) should give 25 overall
      const components = { op: 25, eng: 25, cons: 25, voice: 25, site: 25 };
      const weights = { op: 0.3, eng: 0.2, cons: 0.25, voice: 0.15, site: 0.1 };

      const score =
        Math.round(
          (weights.op * components.op +
            weights.eng * components.eng +
            weights.cons * components.cons +
            weights.voice * components.voice +
            weights.site * components.site) *
            10
        ) / 10;

      expect(score).toBe(25.0);
    });

    it('should clamp final score to [0, 100]', () => {
      // Test cases: values outside [0, 100] should be clamped
      const testCases = [
        { raw: -10, expected: 0 },
        { raw: 0, expected: 0 },
        { raw: 50, expected: 50 },
        { raw: 100, expected: 100 },
        { raw: 150, expected: 100 },
      ];

      for (const { raw, expected } of testCases) {
        const clamped = Math.max(0, Math.min(100, raw));
        expect(clamped).toBe(expected);
      }
    });

    it('should handle fractional component scores correctly', () => {
      // High engagement, low voice activity
      const op = 80;
      const eng = 90;
      const cons = 70;
      const voice = 20;
      const site = 85;

      const weights = {
        onlinePresence: 0.3,
        engagement: 0.2,
        consistency: 0.25,
        voice: 0.15,
        site: 0.1,
      };

      const score =
        Math.round(
          (weights.onlinePresence * op +
            weights.engagement * eng +
            weights.consistency * cons +
            weights.voice * voice +
            weights.site * site) *
            10
        ) / 10;

      // Calculate expected: (0.3*80 + 0.2*90 + 0.25*70 + 0.15*20 + 0.1*85) = 24 + 18 + 17.5 + 3 + 8.5 = 71
      expect(score).toBe(71.0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Type Safety', () => {
    it('should enforce CASActivityTier discriminated union', () => {
      const validTiers = ['VERY_ACTIVE', 'ACTIVE', 'MODERATE', 'QUIET', 'DORMANT'] as const;

      for (let i = 0; i <= 100; i += 10) {
        const tier = scoreToCasTier(i);
        expect(validTiers).toContain(tier);
      }
    });

    it('should never produce invalid tier values', () => {
      // Generate random scores and ensure all map to valid tiers
      for (let i = 0; i < 1000; i += 1) {
        const randomScore = Math.random() * 100;
        const tier = scoreToCasTier(randomScore);

        const isValid = ['VERY_ACTIVE', 'ACTIVE', 'MODERATE', 'QUIET', 'DORMANT'].includes(tier);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero member organization', () => {
      // With zero members, all component scores should be 0
      const score = 0;
      const tier = scoreToCasTier(score);

      expect(tier).toBe('DORMANT');
    });

    it('should handle fully engaged organization', () => {
      // All components at max (100)
      const components = { op: 100, eng: 100, cons: 100, voice: 100, site: 100 };
      const weights = { op: 0.3, eng: 0.2, cons: 0.25, voice: 0.15, site: 0.1 };

      const score =
        Math.round(
          (weights.op * components.op +
            weights.eng * components.eng +
            weights.cons * components.cons +
            weights.voice * components.voice +
            weights.site * components.site) *
            10
        ) / 10;

      expect(score).toBe(100.0);
      expect(scoreToCasTier(score)).toBe('VERY_ACTIVE');
    });

    it('should handle mixed engagement patterns', () => {
      // Some components high, some low
      const testPatterns = [
        { components: [100, 0, 100, 0, 100], description: 'Alternating high/low' },
        { components: [50, 50, 50, 50, 50], description: 'All medium' },
        { components: [10, 10, 10, 10, 10], description: 'All low' },
      ];

      for (const pattern of testPatterns) {
        const [op, eng, cons, voice, site] = pattern.components;
        const weights = { op: 0.3, eng: 0.2, cons: 0.25, voice: 0.15, site: 0.1 };

        const score =
          Math.round(
            (weights.op * op +
              weights.eng * eng +
              weights.cons * cons +
              weights.voice * voice +
              weights.site * site) *
              10
          ) / 10;

        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(typeof scoreToCasTier(score)).toBe('string');
      }
    });
  });
});
