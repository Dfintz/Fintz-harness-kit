import { TenantEntity } from './base/TenantEntity';
import { LootItem } from './LootItem';
import { LootPool } from './LootPool';
export declare enum LootClaimType {
    NEED = "need",
    GREED = "greed",
    ROLL = "roll",
    BID = "bid"
}
export declare enum LootClaimStatus {
    PENDING = "pending",
    WON = "won",
    LOST = "lost",
    WITHDRAWN = "withdrawn"
}
export declare class LootClaim extends TenantEntity {
    id: string;
    lootPoolId: string;
    pool?: LootPool;
    lootItemId: string;
    item?: LootItem;
    userId: string;
    userName: string;
    claimType: LootClaimType;
    bidAmount?: number;
    rollValue?: number;
    status: LootClaimStatus;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=LootClaim.d.ts.map