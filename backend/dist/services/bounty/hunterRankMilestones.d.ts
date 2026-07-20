import { HunterRank } from '../../models/HunterProfile';
export declare const HUNTER_RANK_ORDER: readonly HunterRank[];
export declare function getHunterRankIndex(rank: HunterRank): number;
export declare function isHunterRankPromotion(previousRank: HunterRank, newRank: HunterRank): boolean;
export declare function formatHunterRankPromotion(previousRank: HunterRank, newRank: HunterRank): string | null;
//# sourceMappingURL=hunterRankMilestones.d.ts.map