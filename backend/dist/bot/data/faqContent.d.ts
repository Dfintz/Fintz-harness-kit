import { faqCategories, getAllFaqItems, searchFaqItems, type FaqCategory, type FaqItem } from '@sc-fleet-manager/shared-types';
export type BotFaqItem = FaqItem;
export type BotFaqCategory = FaqCategory;
export declare const botFaqCategories: FaqCategory[];
export declare function getAllBotFaqItems(): (BotFaqItem & {
    categoryId: string;
    categoryTitle: string;
    categoryEmoji: string;
})[];
export declare function searchBotFaqItems(query: string, limit?: number): (BotFaqItem & {
    categoryId: string;
    categoryTitle: string;
    categoryEmoji: string;
})[];
export { faqCategories, getAllFaqItems, searchFaqItems };
export type { FaqCategory, FaqItem };
//# sourceMappingURL=faqContent.d.ts.map