/**
 * Shared FAQ Content
 *
 * Single source of truth for FAQ data used by both the frontend Help Center
 * and the Discord bot /faq command. Each consumer re-exports the subset of
 * types and helpers it needs.
 *
 * @module @sc-fleet-manager/shared-types/faq
 */

export { faqCategories, getAllFaqItems, searchFaqItems } from './faqContent.js';
export type { FaqCategory, FaqItem } from './faqContent.js';
