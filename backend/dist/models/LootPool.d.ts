import { TenantEntity } from './base/TenantEntity';
export declare enum LootPoolStatus {
    OPEN = "open",
    LOCKED = "locked",
    DISTRIBUTED = "distributed",
    PARTIALLY_DISTRIBUTED = "partially_distributed",
    CANCELLED = "cancelled"
}
export declare enum LootDistributionMethod {
    NEED_GREED = "need_greed",
    RANDOM_ROLL = "random_roll",
    AUEC_BID = "auec_bid",
    EVEN_SPLIT = "even_split",
    LEADER_ASSIGN = "leader_assign"
}
export interface LootPoolRules {
    maxItemsPerParticipant?: number;
    shareTotalPayout?: boolean;
    roleWeights?: Record<string, number>;
    eligibleRoles?: string[];
    closesAt?: string;
    minBidIncrement?: number;
    notes?: string;
}
export declare class LootPool extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    activityId: string;
    missionId?: string;
    lfgSessionId?: string;
    status: LootPoolStatus;
    distributionMethod: LootDistributionMethod;
    rules?: LootPoolRules;
    totalValue: number;
    currency: string;
    leaderId: string;
    createdBy: string;
    distributedAt?: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=LootPool.d.ts.map