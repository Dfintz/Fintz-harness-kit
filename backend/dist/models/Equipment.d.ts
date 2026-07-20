import { Organization } from './Organization';
import { User } from './User';
export declare enum EquipmentStatus {
    AVAILABLE = "available",
    EQUIPPED = "equipped",
    IN_TRANSIT = "in_transit",
    DAMAGED = "damaged",
    DESTROYED = "destroyed"
}
export declare enum EquipmentRarity {
    COMMON = "common",
    UNCOMMON = "uncommon",
    RARE = "rare",
    EPIC = "epic",
    LEGENDARY = "legendary"
}
export declare class Equipment {
    id: string;
    organizationId: string;
    organization?: Organization;
    name: string;
    type: string;
    rarity: string;
    description?: string;
    ownerId: string;
    owner?: User;
    shipId?: string;
    status: string;
    quantity: number;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Equipment.d.ts.map