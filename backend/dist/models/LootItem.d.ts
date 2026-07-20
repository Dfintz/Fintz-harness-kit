import { TenantEntity } from './base/TenantEntity';
import { LootPool } from './LootPool';
export declare enum LootItemCategory {
    GEAR = "gear",
    COMPONENT = "component",
    COMMODITY = "commodity",
    WEAPON = "weapon",
    SHIP = "ship",
    OTHER = "other"
}
export declare enum LootItemStatus {
    AVAILABLE = "available",
    AWARDED = "awarded"
}
export declare enum LootItemSource {
    MANUAL = "manual",
    OCR = "ocr"
}
export declare class LootItem extends TenantEntity {
    id: string;
    lootPoolId: string;
    pool?: LootPool;
    name: string;
    category: LootItemCategory;
    quantity: number;
    unitValue: number;
    totalValue: number;
    status: LootItemStatus;
    source: LootItemSource;
    awardedToUserId?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=LootItem.d.ts.map