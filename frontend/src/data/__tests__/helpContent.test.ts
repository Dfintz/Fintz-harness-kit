/**
 * Tests for helpContent data module
 *
 * Covers: category structure, search, ID uniqueness, and content consistency.
 */

import {
    faqCategories,
    getAllFaqItems,
    searchFaqItems,
    type FaqCategory,
    type FaqItem,
} from '../../data/helpContent';

describe('helpContent', () => {
  describe('faqCategories structure', () => {
    it('should have 17 FAQ categories', () => {
      expect(faqCategories).toHaveLength(17);
    });

    it('should have required fields on every category', () => {
      faqCategories.forEach((cat: FaqCategory) => {
        expect(cat.id).toBeTruthy();
        expect(cat.title).toBeTruthy();
        expect(cat.icon).toBeTruthy();
        expect(cat.emoji).toBeTruthy();
        expect(cat.description).toBeTruthy();
        expect(cat.items.length).toBeGreaterThan(0);
      });
    });

    it('should have unique category IDs', () => {
      const ids = faqCategories.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it.each([
      'getting-started',
      'fleet-management',
      'activities-ops',
      'organizations',
      'briefings',
      'trading',
      'treasury',
      'titles-badges',
      'bounties',
      'moderation',
      'discord-bot',
      'platform-admin',
      'account-privacy',
      'friends-social',
      'scstats',
      'alliance-navigation',
    ])('should include "%s" category', (id: string) => {
      expect(faqCategories.find(c => c.id === id)).toBeDefined();
    });
  });

  describe('FaqItem structure', () => {
    it('should have required fields on every item', () => {
      faqCategories.forEach(cat => {
        cat.items.forEach((item: FaqItem) => {
          expect(item.id).toBeTruthy();
          expect(item.question).toBeTruthy();
          expect(item.answer).toBeTruthy();
          expect(Array.isArray(item.keywords)).toBe(true);
          expect(item.keywords.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have globally unique item IDs', () => {
      const allIds = faqCategories.flatMap(c => c.items.map(i => i.id));
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });

  describe('getAllFaqItems', () => {
    it('should return all items across all categories', () => {
      const allItems = getAllFaqItems();
      const expectedCount = faqCategories.reduce((sum, c) => sum + c.items.length, 0);
      expect(allItems).toHaveLength(expectedCount);
    });

    it('should include categoryId and categoryTitle on each item', () => {
      const allItems = getAllFaqItems();
      allItems.forEach(item => {
        expect(item.categoryId).toBeTruthy();
        expect(item.categoryTitle).toBeTruthy();
      });
    });
  });

  describe('searchFaqItems', () => {
    it('should return empty array for empty query', () => {
      expect(searchFaqItems('')).toEqual([]);
      expect(searchFaqItems('  ')).toEqual([]);
    });

    it('should find items by question keywords', () => {
      const results = searchFaqItems('fleet');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.question.toLowerCase().includes('fleet'))).toBe(true);
    });

    it('should find items by answer content', () => {
      const results = searchFaqItems('GDPR');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find items by keyword tags', () => {
      const results = searchFaqItems('2fa');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].categoryId).toBe('account-privacy');
    });

    it('should be case-insensitive', () => {
      const upper = searchFaqItems('DISCORD');
      const lower = searchFaqItems('discord');
      expect(upper.length).toBe(lower.length);
    });

    it('should return results with category metadata', () => {
      const results = searchFaqItems('comm link');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.categoryId).toBeTruthy();
        expect(r.categoryTitle).toBeTruthy();
      });
    });

    it('should return no results for nonsense query', () => {
      const results = searchFaqItems('xyznonexistent123');
      expect(results).toEqual([]);
    });
  });
});
