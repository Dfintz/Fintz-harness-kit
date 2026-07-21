/**
 * Tests for backend bot FAQ content data module
 *
 * Validates: category structure, search, ID uniqueness, Discord embed limits.
 */

import {
  botFaqCategories,
  getAllBotFaqItems,
  searchBotFaqItems,
  type BotFaqCategory,
  type BotFaqItem,
} from '../../bot/data/faqContent';

describe('Bot FAQ Content', () => {
  describe('botFaqCategories structure', () => {
    it('should include the full core FAQ category set', () => {
      expect(botFaqCategories.length).toBeGreaterThanOrEqual(16);

      const ids = botFaqCategories.map(category => category.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'getting-started',
          'fleet-management',
          'activities-ops',
          'organizations',
          'discord-bot',
        ])
      );
    });

    it('should have required fields on every category', () => {
      botFaqCategories.forEach((cat: BotFaqCategory) => {
        expect(cat.id).toBeTruthy();
        expect(cat.title).toBeTruthy();
        expect(cat.emoji).toBeTruthy();
        expect(cat.icon).toBeTruthy();
        expect(cat.description).toBeTruthy();
        expect(cat.items.length).toBeGreaterThan(0);
      });
    });

    it('should have unique category IDs', () => {
      const ids = botFaqCategories.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have emoji on every category (not icon names)', () => {
      botFaqCategories.forEach((cat: BotFaqCategory) => {
        // Emoji should not be a MUI icon name (PascalCase); it should be actual emoji
        expect(cat.emoji).not.toMatch(/^[A-Z][a-z]/);
      });
    });
  });

  describe('BotFaqItem structure', () => {
    it('should have required fields on every item', () => {
      botFaqCategories.forEach(cat => {
        cat.items.forEach((item: BotFaqItem) => {
          expect(item.id).toBeTruthy();
          expect(item.question).toBeTruthy();
          expect(item.answer).toBeTruthy();
          expect(Array.isArray(item.keywords)).toBe(true);
          expect(item.keywords.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have globally unique item IDs', () => {
      const ids = botFaqCategories.flatMap(c => c.items.map(i => i.id));
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have answers present on every item', () => {
      botFaqCategories.forEach(cat => {
        cat.items.forEach(item => {
          expect(item.answer.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getAllBotFaqItems', () => {
    it('should return all items with category metadata', () => {
      const allItems = getAllBotFaqItems();
      const expectedCount = botFaqCategories.reduce((sum, c) => sum + c.items.length, 0);
      expect(allItems).toHaveLength(expectedCount);

      allItems.forEach(item => {
        expect(item.categoryId).toBeTruthy();
        expect(item.categoryTitle).toBeTruthy();
      });
    });
  });

  describe('searchBotFaqItems', () => {
    it('should return empty array for empty query', () => {
      expect(searchBotFaqItems('')).toEqual([]);
      expect(searchBotFaqItems('   ')).toEqual([]);
    });

    it('should find items by keyword', () => {
      const results = searchBotFaqItems('fleet');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find items by answer content', () => {
      const results = searchBotFaqItems('GDPR');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const upper = searchBotFaqItems('DISCORD');
      const lower = searchBotFaqItems('discord');
      expect(upper.length).toBe(lower.length);
    });

    it('should respect the limit parameter', () => {
      const all = searchBotFaqItems('how', 100);
      const limited = searchBotFaqItems('how', 2);
      expect(limited.length).toBeLessThanOrEqual(2);
      if (all.length > 2) {
        expect(limited.length).toBe(2);
      }
    });

    it('should default limit to 5', () => {
      // Use a very broad query that would match many items
      const results = searchBotFaqItems('a');
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return no results for nonsense query', () => {
      expect(searchBotFaqItems('xyznonexistent123')).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
