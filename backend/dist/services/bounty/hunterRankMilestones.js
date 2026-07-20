"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HUNTER_RANK_ORDER = void 0;
exports.getHunterRankIndex = getHunterRankIndex;
exports.isHunterRankPromotion = isHunterRankPromotion;
exports.formatHunterRankPromotion = formatHunterRankPromotion;
const HunterProfile_1 = require("../../models/HunterProfile");
exports.HUNTER_RANK_ORDER = [
    HunterProfile_1.HunterRank.ROOKIE,
    HunterProfile_1.HunterRank.APPRENTICE,
    HunterProfile_1.HunterRank.HUNTER,
    HunterProfile_1.HunterRank.VETERAN,
    HunterProfile_1.HunterRank.ELITE,
    HunterProfile_1.HunterRank.LEGENDARY,
];
const HUNTER_RANK_LABEL = {
    [HunterProfile_1.HunterRank.ROOKIE]: 'Rookie',
    [HunterProfile_1.HunterRank.APPRENTICE]: 'Apprentice',
    [HunterProfile_1.HunterRank.HUNTER]: 'Hunter',
    [HunterProfile_1.HunterRank.VETERAN]: 'Veteran',
    [HunterProfile_1.HunterRank.ELITE]: 'Elite',
    [HunterProfile_1.HunterRank.LEGENDARY]: 'Legendary',
};
function getHunterRankIndex(rank) {
    return exports.HUNTER_RANK_ORDER.indexOf(rank);
}
function isHunterRankPromotion(previousRank, newRank) {
    const previousIndex = getHunterRankIndex(previousRank);
    const newIndex = getHunterRankIndex(newRank);
    if (previousIndex < 0 || newIndex < 0) {
        return false;
    }
    return newIndex > previousIndex;
}
function formatHunterRankPromotion(previousRank, newRank) {
    if (!isHunterRankPromotion(previousRank, newRank)) {
        return null;
    }
    const reachedTop = getHunterRankIndex(newRank) === exports.HUNTER_RANK_ORDER.length - 1;
    const headline = `🎖️ **Rank up:** ${HUNTER_RANK_LABEL[previousRank]} → **${HUNTER_RANK_LABEL[newRank]}**!`;
    return reachedTop
        ? `${headline} You've reached the highest hunter rank — legendary work. 🏆`
        : `${headline} Keep hunting to climb higher.`;
}
//# sourceMappingURL=hunterRankMilestones.js.map