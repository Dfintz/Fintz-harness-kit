/**
 * Discord Bot FAQ Content
 *
 * Re-exports FAQ data from the shared-types package with
 * backward-compatible aliases for the bot command layer.
 * Edit FAQ content in packages/shared-types/src/faq/faqContent.ts.
 *
 * @module bot/data/faqContent
 */

import {
  faqCategories,
  getAllFaqItems,
  searchFaqItems,
  type FaqCategory,
  type FaqItem,
} from '@sc-fleet-manager/shared-types';

// Backward-compatible type aliases
export type BotFaqItem = FaqItem;
export type BotFaqCategory = FaqCategory;

// Re-export under bot-prefixed names for existing consumers
export const botFaqCategories = faqCategories;

/**
 * Get all FAQ items across categories
 */
export function getAllBotFaqItems(): (BotFaqItem & {
  categoryId: string;
  categoryTitle: string;
  categoryEmoji: string;
})[] {
  return getAllFaqItems().map(item => {
    const cat = faqCategories.find(c => c.id === item.categoryId);
    return {
      ...item,
      categoryEmoji: cat?.emoji ?? '',
    };
  });
}

/**
 * Search FAQ items by query (matches question, answer, keywords)
 */
export function searchBotFaqItems(
  query: string,
  limit = 5
): (BotFaqItem & { categoryId: string; categoryTitle: string; categoryEmoji: string })[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) {
    return [];
  }

  return getAllBotFaqItems()
    .filter(
      item =>
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery) ||
        item.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
}

// Also re-export canonical types/values for direct use
export { faqCategories, getAllFaqItems, searchFaqItems };
export type { FaqCategory, FaqItem };
