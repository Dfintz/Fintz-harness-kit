import { LootClaim, LootClaimType } from '../../models/LootClaim';
import { LootItem, LootItemCategory, LootItemSource } from '../../models/LootItem';
import { LootDistributionMethod, LootPool, LootPoolRules, LootPoolStatus } from '../../models/LootPool';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface CreateLootPoolDTO {
    name: string;
    description?: string;
    activityId: string;
    missionId?: string;
    lfgSessionId?: string;
    distributionMethod?: LootDistributionMethod;
    rules?: LootPoolRules;
    assistantUserIds?: string[];
    currency?: string;
}
export interface UpdateLootPoolDTO {
    name?: string;
    description?: string;
    distributionMethod?: LootDistributionMethod;
    rules?: LootPoolRules;
    assistantUserIds?: string[];
}
export interface AddLootItemDTO {
    name: string;
    category?: LootItemCategory;
    quantity?: number;
    unitValue?: number;
    imageUrl?: string;
    source?: LootItemSource;
    metadata?: Record<string, unknown>;
}
export interface UpdateLootItemDTO {
    name?: string;
    category?: LootItemCategory;
    quantity?: number;
    unitValue?: number;
    imageUrl?: string;
}
export interface ClaimItemDTO {
    claimType: LootClaimType;
    bidAmount?: number;
}
export interface LootPoolFilters {
    activityId?: string;
    status?: LootPoolStatus;
}
export interface EligibleParticipant {
    userId: string;
    userName: string;
    role: string;
}
interface LootDistributionAward {
    lootItemId: string;
    itemName: string;
    userId?: string;
    userName?: string;
    amount?: number;
    rollValue?: number;
    claimType?: LootClaimType;
}
interface LootDistributionFailure {
    lootItemId?: string;
    itemName?: string;
    userId?: string;
    userName?: string;
    amount?: number;
    stage: 'settlement' | 'payout';
    reason: string;
}
interface LootDistributionResult {
    poolId: string;
    distributionMethod: LootDistributionMethod;
    totalValue: number;
    currency: string;
    awards: LootDistributionAward[];
    payouts?: Array<{
        userId: string;
        userName?: string;
        amount: number;
    }>;
    failures?: LootDistributionFailure[];
}
export declare class LootDistributionService extends TenantService<LootPool> {
    private readonly itemRepo;
    private readonly claimRepo;
    private readonly assistantRepo;
    private readonly participantRepo;
    private readonly activityRepo;
    private readonly treasuryService;
    constructor();
    createPool(organizationId: string, userId: string, dto: CreateLootPoolDTO): Promise<LootPool>;
    getPoolById(organizationId: string, poolId: string): Promise<LootPool | null>;
    assertCanManagePool(organizationId: string, poolId: string, userId: string): Promise<LootPool>;
    getPoolDetail(organizationId: string, poolId: string): Promise<(LootPool & {
        items: LootItem[];
        claims: LootClaim[];
    }) | null>;
    listPools(organizationId: string, pagination: PaginationOptions, filters?: LootPoolFilters): Promise<PaginatedResponse<LootPool>>;
    updatePool(organizationId: string, poolId: string, userId: string, dto: UpdateLootPoolDTO): Promise<LootPool>;
    lockPool(organizationId: string, poolId: string, userId: string): Promise<LootPool>;
    cancelPool(organizationId: string, poolId: string, userId: string): Promise<LootPool>;
    addItem(organizationId: string, poolId: string, userId: string, dto: AddLootItemDTO): Promise<LootItem>;
    addItemsBulk(organizationId: string, poolId: string, userId: string, items: AddLootItemDTO[]): Promise<LootItem[]>;
    updateItem(organizationId: string, poolId: string, itemId: string, userId: string, dto: UpdateLootItemDTO): Promise<LootItem>;
    removeItem(organizationId: string, poolId: string, itemId: string, userId: string): Promise<void>;
    claimItem(organizationId: string, poolId: string, itemId: string, user: {
        id: string;
        name: string;
    }, dto: ClaimItemDTO): Promise<LootClaim>;
    withdrawClaim(organizationId: string, poolId: string, itemId: string, userId: string): Promise<void>;
    distribute(organizationId: string, poolId: string, userId: string): Promise<LootDistributionResult>;
    retryDistribution(organizationId: string, poolId: string, userId: string): Promise<LootDistributionResult>;
    private executeDistribution;
    private distributeEvenSplit;
    private processEvenSplitPayouts;
    private distributeBids;
    private findWinningBid;
    private settleWinningBid;
    private finalizeWinningBid;
    private compensateFailedBidAward;
    private distributeRolls;
    private summariseLeaderAssign;
    assignItem(organizationId: string, poolId: string, itemId: string, userId: string, targetUserId: string): Promise<LootItem>;
    getEligibleParticipants(pool: LootPool): Promise<EligibleParticipant[]>;
    private requirePool;
    private assertManager;
    private assertStatus;
    private assertClaimWindowOpen;
    private assertClaimTypeMatchesMethod;
    private assertEligibleParticipant;
    private assertWithinItemCap;
    private capReached;
    private getHighestBid;
    private markLosers;
    private awardItemTo;
    private computeWeightedShares;
    private roll;
    private recomputeTotal;
    private resolveLeaderId;
    private findPoolItem;
    private normaliseAssistantUserIds;
    private normaliseStringArray;
    private withAssistantUserIds;
    private getAssistantUserIds;
    private getAssistantUserIdsFromMetadata;
    private withEvenSplitPaidUserIds;
    private getEvenSplitPaidUserIds;
    private replacePoolAssistants;
    private hydratePoolAssistants;
    private hydratePoolsAssistants;
}
export declare function getLootDistributionService(): LootDistributionService;
export {};
//# sourceMappingURL=LootDistributionService.d.ts.map