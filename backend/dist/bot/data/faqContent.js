"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchFaqItems = exports.getAllFaqItems = exports.faqCategories = exports.botFaqCategories = void 0;
exports.getAllBotFaqItems = getAllBotFaqItems;
exports.searchBotFaqItems = searchBotFaqItems;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
Object.defineProperty(exports, "faqCategories", { enumerable: true, get: function () { return shared_types_1.faqCategories; } });
Object.defineProperty(exports, "getAllFaqItems", { enumerable: true, get: function () { return shared_types_1.getAllFaqItems; } });
Object.defineProperty(exports, "searchFaqItems", { enumerable: true, get: function () { return shared_types_1.searchFaqItems; } });
exports.botFaqCategories = shared_types_1.faqCategories;
function getAllBotFaqItems() {
    return (0, shared_types_1.getAllFaqItems)().map(item => {
        const cat = shared_types_1.faqCategories.find(c => c.id === item.categoryId);
        return {
            ...item,
            categoryEmoji: cat?.emoji ?? '',
        };
    });
}
function searchBotFaqItems(query, limit = 5) {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        return [];
    }
    return getAllBotFaqItems()
        .filter(item => item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery) ||
        item.keywords.some(kw => kw.toLowerCase().includes(lowerQuery)))
        .slice(0, limit);
}
//# sourceMappingURL=faqContent.js.map