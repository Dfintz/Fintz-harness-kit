/**
 * Help Center FAQ Content
 *
 * Re-exports FAQ data from the shared-types package.
 * Edit FAQ content in packages/shared-types/src/faq/faqContent.ts.
 *
 * @module data/helpContent
 */

export type { FaqItem, FaqCategory } from '@sc-fleet-manager/shared-types/faq';
export { faqCategories, getAllFaqItems, searchFaqItems } from '@sc-fleet-manager/shared-types/faq';
