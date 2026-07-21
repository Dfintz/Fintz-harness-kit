import { AppDataSource } from '../../data-source';
import { Activity, ParticipantRole } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import { LootClaim, LootClaimStatus, LootClaimType } from '../../models/LootClaim';
import { LootItem, LootItemCategory, LootItemSource, LootItemStatus } from '../../models/LootItem';
import {
  LootDistributionMethod,
  LootPool,
  LootPoolRules,
  LootPoolStatus,
} from '../../models/LootPool';
import { LootPoolAssistant } from '../../models/LootPoolAssistant';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { emitToOrganization } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';
import { getTreasuryService, TreasuryService } from '../treasury/TreasuryService';

// ==================== DTOs ====================

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
  payouts?: Array<{ userId: string; userName?: string; amount: number }>;
  failures?: LootDistributionFailure[];
}

// ==================== SERVICE ====================

/**
 * LootDistributionService
 *
 * Manages mission loot pools: collecting looted items, calculating total value,
 * configuring distribution rules, accepting participant claims/bids, and
 * resolving the distribution (need/greed, random roll, aUEC bid, even split,
 * leader-assign).
 *
 * Eligibility is derived from the anchoring activity's participants ("who was
 * active"), so only people who took part in the mission can claim loot.
 */
export class LootDistributionService extends TenantService<LootPool> {
  private readonly itemRepo = AppDataSource.getRepository(LootItem);
  private readonly claimRepo = AppDataSource.getRepository(LootClaim);
  private readonly assistantRepo = AppDataSource.getRepository(LootPoolAssistant);
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private readonly activityRepo = AppDataSource.getRepository(Activity);
  private readonly treasuryService: TreasuryService;

  constructor() {
    super(AppDataSource.getRepository(LootPool), {
      enableCache: false,
    });
    this.treasuryService = getTreasuryService();
  }

  // ==================== POOL CRUD ====================

  async createPool(
    organizationId: string,
    userId: string,
    dto: CreateLootPoolDTO
  ): Promise<LootPool> {
    const activity = await this.activityRepo
      .createQueryBuilder('activity')
      .where('activity.id = :activityId', { activityId: dto.activityId })
      .getOne();
    if (!activity) {
      throw new NotFoundError('Activity');
    }
    if (activity.organizationId && activity.organizationId !== organizationId) {
      throw new ForbiddenError('Activity belongs to a different organization');
    }

    // Default the pool leader to the activity leader, falling back to the creator.
    const leaderId = await this.resolveLeaderId(dto.activityId, activity.creatorId ?? userId);
    const assistantUserIds = this.normaliseAssistantUserIds(dto.assistantUserIds).filter(
      candidateId => candidateId !== userId && candidateId !== leaderId
    );

    const pool = await this.create(organizationId, {
      name: dto.name,
      description: dto.description,
      activityId: dto.activityId,
      missionId: dto.missionId,
      lfgSessionId: dto.lfgSessionId,
      distributionMethod: dto.distributionMethod ?? LootDistributionMethod.NEED_GREED,
      rules: dto.rules,
      currency: dto.currency ?? 'aUEC',
      totalValue: 0,
      status: LootPoolStatus.OPEN,
      leaderId,
      createdBy: userId,
      metadata: assistantUserIds.length > 0 ? { assistantUserIds } : undefined,
    });

    await this.replacePoolAssistants(organizationId, pool.id, assistantUserIds);
    await this.hydratePoolAssistants(pool);

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId,
      resource: `loot/${pool.id}`,
      action: 'loot_pool_created',
      message: `Loot pool created: ${pool.name}`,
      metadata: { organizationId, poolId: pool.id, activityId: dto.activityId },
    });

    emitToOrganization(organizationId, 'loot:pool_created', { poolId: pool.id, name: pool.name });
    logger.info('Loot pool created', {
      organizationId,
      poolId: pool.id,
      activityId: dto.activityId,
    });
    return pool;
  }

  async getPoolById(organizationId: string, poolId: string): Promise<LootPool | null> {
    const pool = await this.repository
      .createQueryBuilder('pool')
      .where('pool.id = :poolId', { poolId })
      .andWhere('pool."organizationId" = :organizationId', { organizationId })
      .getOne();
    if (!pool) {
      return null;
    }
    await this.hydratePoolAssistants(pool);
    return pool;
  }

  async assertCanManagePool(
    organizationId: string,
    poolId: string,
    userId: string
  ): Promise<LootPool> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    return pool;
  }

  /** Fetch a pool with its items and (optionally) claims hydrated. */
  async getPoolDetail(
    organizationId: string,
    poolId: string
  ): Promise<(LootPool & { items: LootItem[]; claims: LootClaim[] }) | null> {
    const pool = await this.getPoolById(organizationId, poolId);
    if (!pool) {
      return null;
    }
    const [items, claims] = await Promise.all([
      this.itemRepo
        .createQueryBuilder('item')
        .where('item."lootPoolId" = :poolId', { poolId })
        .orderBy('item."createdAt"', 'ASC')
        .getMany(),
      this.claimRepo
        .createQueryBuilder('claim')
        .where('claim."lootPoolId" = :poolId', { poolId })
        .orderBy('claim."createdAt"', 'ASC')
        .getMany(),
    ]);
    return Object.assign(pool, { items, claims });
  }

  async listPools(
    organizationId: string,
    pagination: PaginationOptions,
    filters?: LootPoolFilters
  ): Promise<PaginatedResponse<LootPool>> {
    const qb = this.repository
      .createQueryBuilder('pool')
      .where('pool."organizationId" = :orgId', { orgId: organizationId });

    if (filters?.activityId) {
      qb.andWhere('pool."activityId" = :activityId', { activityId: filters.activityId });
    }
    if (filters?.status) {
      qb.andWhere('pool.status = :status', { status: filters.status });
    }

    qb.orderBy('pool."createdAt"', 'DESC');

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    await this.hydratePoolsAssistants(data);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async updatePool(
    organizationId: string,
    poolId: string,
    userId: string,
    dto: UpdateLootPoolDTO
  ): Promise<LootPool> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.OPEN, 'Pool rules can only be changed while it is open');

    if (dto.name !== undefined) {
      pool.name = dto.name;
    }
    if (dto.description !== undefined) {
      pool.description = dto.description;
    }
    if (dto.distributionMethod !== undefined) {
      pool.distributionMethod = dto.distributionMethod;
    }
    if (dto.rules !== undefined) {
      pool.rules = dto.rules;
    }
    if (dto.assistantUserIds !== undefined) {
      const assistantUserIds = this.normaliseAssistantUserIds(dto.assistantUserIds).filter(
        candidateId => candidateId !== pool.createdBy && candidateId !== pool.leaderId
      );
      pool.metadata = this.withAssistantUserIds(pool.metadata, assistantUserIds);
      await this.replacePoolAssistants(organizationId, pool.id, assistantUserIds);
    }

    const saved = await this.repository.save(pool);
    await this.hydratePoolAssistants(saved);
    emitToOrganization(organizationId, 'loot:pool_updated', { poolId });
    return saved;
  }

  /** Lock the pool: closes item editing and opens the claim/bid window. */
  async lockPool(organizationId: string, poolId: string, userId: string): Promise<LootPool> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.OPEN, 'Only open pools can be locked');

    const itemCount = await this.itemRepo.count({ where: { lootPoolId: poolId } });
    if (itemCount === 0) {
      throw new ValidationError('Cannot lock a pool with no items');
    }

    pool.status = LootPoolStatus.LOCKED;
    const saved = await this.repository.save(pool);

    emitToOrganization(organizationId, 'loot:pool_locked', { poolId });
    logger.info('Loot pool locked', { organizationId, poolId });
    return saved;
  }

  async cancelPool(organizationId: string, poolId: string, userId: string): Promise<LootPool> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    if (
      pool.status === LootPoolStatus.DISTRIBUTED ||
      pool.status === LootPoolStatus.PARTIALLY_DISTRIBUTED
    ) {
      throw new ConflictError('A distributed pool cannot be cancelled');
    }

    pool.status = LootPoolStatus.CANCELLED;
    const saved = await this.repository.save(pool);
    emitToOrganization(organizationId, 'loot:pool_cancelled', { poolId });
    return saved;
  }

  // ==================== ITEMS ====================

  async addItem(
    organizationId: string,
    poolId: string,
    userId: string,
    dto: AddLootItemDTO
  ): Promise<LootItem> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.OPEN, 'Items can only be added while the pool is open');

    const quantity = dto.quantity ?? 1;
    const unitValue = dto.unitValue ?? 0;
    const item = this.itemRepo.create({
      organizationId,
      lootPoolId: poolId,
      name: dto.name,
      category: dto.category ?? LootItemCategory.OTHER,
      quantity,
      unitValue,
      totalValue: Number((quantity * unitValue).toFixed(2)),
      status: LootItemStatus.AVAILABLE,
      source: dto.source ?? LootItemSource.MANUAL,
      imageUrl: dto.imageUrl,
      metadata: dto.metadata,
    });
    const saved = await this.itemRepo.save(item);

    await this.recomputeTotal(pool);
    emitToOrganization(organizationId, 'loot:item_added', { poolId, itemId: saved.id });
    return saved;
  }

  /** Bulk-add items (used for confirming OCR suggestions). */
  async addItemsBulk(
    organizationId: string,
    poolId: string,
    userId: string,
    items: AddLootItemDTO[]
  ): Promise<LootItem[]> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.OPEN, 'Items can only be added while the pool is open');

    const entities = items.map(dto => {
      const quantity = dto.quantity ?? 1;
      const unitValue = dto.unitValue ?? 0;
      return this.itemRepo.create({
        organizationId,
        lootPoolId: poolId,
        name: dto.name,
        category: dto.category ?? LootItemCategory.OTHER,
        quantity,
        unitValue,
        totalValue: Number((quantity * unitValue).toFixed(2)),
        status: LootItemStatus.AVAILABLE,
        source: dto.source ?? LootItemSource.MANUAL,
        imageUrl: dto.imageUrl,
        metadata: dto.metadata,
      });
    });
    const saved = await this.itemRepo.save(entities);

    await this.recomputeTotal(pool);
    emitToOrganization(organizationId, 'loot:items_added', { poolId, count: saved.length });
    return saved;
  }

  async updateItem(
    organizationId: string,
    poolId: string,
    itemId: string,
    userId: string,
    dto: UpdateLootItemDTO
  ): Promise<LootItem> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.OPEN, 'Items can only be edited while the pool is open');

    const item = await this.findPoolItem(poolId, itemId);
    if (!item) {
      throw new NotFoundError('Loot item');
    }

    if (dto.name !== undefined) {
      item.name = dto.name;
    }
    if (dto.category !== undefined) {
      item.category = dto.category;
    }
    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
    }
    if (dto.unitValue !== undefined) {
      item.unitValue = dto.unitValue;
    }
    if (dto.imageUrl !== undefined) {
      item.imageUrl = dto.imageUrl;
    }
    item.totalValue = Number((Number(item.quantity) * Number(item.unitValue)).toFixed(2));
    const saved = await this.itemRepo.save(item);

    await this.recomputeTotal(pool);
    emitToOrganization(organizationId, 'loot:item_updated', { poolId, itemId });
    return saved;
  }

  async removeItem(
    organizationId: string,
    poolId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(
      pool,
      LootPoolStatus.OPEN,
      'Items can only be removed while the pool is open'
    );

    const item = await this.findPoolItem(poolId, itemId);
    if (!item) {
      throw new NotFoundError('Loot item');
    }
    await this.itemRepo.remove(item);
    await this.recomputeTotal(pool);
    emitToOrganization(organizationId, 'loot:item_removed', { poolId, itemId });
  }

  // ==================== CLAIMS / BIDS ====================

  /**
   * Register or update a participant's claim/bid on an item.
   * Only eligible activity participants may claim, and only while the pool is
   * LOCKED and not past its close time.
   */
  async claimItem(
    organizationId: string,
    poolId: string,
    itemId: string,
    user: { id: string; name: string },
    dto: ClaimItemDTO
  ): Promise<LootClaim> {
    const pool = await this.requirePool(organizationId, poolId);
    this.assertStatus(
      pool,
      LootPoolStatus.LOCKED,
      'Claims are only accepted while the pool is locked'
    );
    this.assertClaimWindowOpen(pool);

    const participant = await this.assertEligibleParticipant(pool, user.id);

    const item = await this.findPoolItem(poolId, itemId);
    if (!item) {
      throw new NotFoundError('Loot item');
    }

    this.assertClaimTypeMatchesMethod(pool.distributionMethod, dto.claimType);

    // aUEC bid validation: enforce minimum increment and that the bidder can pay.
    if (dto.claimType === LootClaimType.BID) {
      const bid = Number(dto.bidAmount ?? 0);
      if (bid <= 0) {
        throw new ValidationError('A bid amount greater than zero is required');
      }
      const minIncrement = pool.rules?.minBidIncrement ?? 1;
      const highest = await this.getHighestBid(itemId);
      if (highest && bid < Number(highest.bidAmount) + minIncrement) {
        throw new ValidationError(
          `Bid must be at least ${Number(highest.bidAmount) + minIncrement} ${pool.currency}`
        );
      }
    }

    // Enforce per-participant item cap for "select" style methods (not even split).
    await this.assertWithinItemCap(pool, itemId, user.id);

    const existing = await this.claimRepo
      .createQueryBuilder('claim')
      .where('claim."lootItemId" = :itemId', { itemId })
      .andWhere('claim."userId" = :userId', { userId: user.id })
      .getOne();
    let claim: LootClaim;
    if (existing) {
      existing.claimType = dto.claimType;
      existing.bidAmount = dto.claimType === LootClaimType.BID ? Number(dto.bidAmount) : undefined;
      existing.status = LootClaimStatus.PENDING;
      existing.userName = user.name;
      claim = await this.claimRepo.save(existing);
    } else {
      claim = await this.claimRepo.save(
        this.claimRepo.create({
          organizationId,
          lootPoolId: poolId,
          lootItemId: itemId,
          userId: user.id,
          userName: user.name,
          claimType: dto.claimType,
          bidAmount: dto.claimType === LootClaimType.BID ? Number(dto.bidAmount) : undefined,
          status: LootClaimStatus.PENDING,
        })
      );
    }

    emitToOrganization(organizationId, 'loot:claim_placed', {
      poolId,
      itemId,
      userId: user.id,
      claimType: dto.claimType,
      bidAmount: claim.bidAmount,
      role: participant.role,
    });
    return claim;
  }

  async withdrawClaim(
    organizationId: string,
    poolId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    const pool = await this.requirePool(organizationId, poolId);
    this.assertStatus(
      pool,
      LootPoolStatus.LOCKED,
      'Claims can only be withdrawn while the pool is locked'
    );

    const claim = await this.claimRepo
      .createQueryBuilder('claim')
      .where('claim."lootItemId" = :itemId', { itemId })
      .andWhere('claim."userId" = :userId', { userId })
      .andWhere('claim."lootPoolId" = :poolId', { poolId })
      .getOne();
    if (!claim) {
      throw new NotFoundError('Loot claim');
    }
    await this.claimRepo.remove(claim);
    emitToOrganization(organizationId, 'loot:claim_withdrawn', { poolId, itemId, userId });
  }

  // ==================== DISTRIBUTION ====================

  /**
   * Resolve the pool according to its distribution method, applying any payouts,
   * and mark it DISTRIBUTED. Returns a per-item award summary.
   */
  async distribute(
    organizationId: string,
    poolId: string,
    userId: string
  ): Promise<LootDistributionResult> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(pool, LootPoolStatus.LOCKED, 'Only a locked pool can be distributed');

    return this.executeDistribution(organizationId, pool, userId, false);
  }

  async retryDistribution(
    organizationId: string,
    poolId: string,
    userId: string
  ): Promise<LootDistributionResult> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(
      pool,
      LootPoolStatus.PARTIALLY_DISTRIBUTED,
      'Only a partially distributed pool can be retried'
    );

    return this.executeDistribution(organizationId, pool, userId, true);
  }

  private async executeDistribution(
    organizationId: string,
    pool: LootPool,
    userId: string,
    isRetry: boolean
  ): Promise<LootDistributionResult> {
    const poolId = pool.id;

    const items = await this.itemRepo
      .createQueryBuilder('item')
      .where('item."lootPoolId" = :poolId', { poolId })
      .getMany();
    const claims = await this.claimRepo
      .createQueryBuilder('claim')
      .where('claim."lootPoolId" = :poolId', { poolId })
      .getMany();
    const participants = await this.getEligibleParticipants(pool);

    let result: LootDistributionResult;
    if (pool.distributionMethod === LootDistributionMethod.EVEN_SPLIT) {
      result = await this.distributeEvenSplit(organizationId, userId, pool, items, participants);
    } else if (pool.distributionMethod === LootDistributionMethod.AUEC_BID) {
      result = await this.distributeBids(organizationId, userId, pool, items, claims);
    } else if (pool.distributionMethod === LootDistributionMethod.LEADER_ASSIGN) {
      result = this.summariseLeaderAssign(pool, items);
    } else {
      // NEED_GREED or RANDOM_ROLL
      result = await this.distributeRolls(pool, items, claims);
    }

    const hasFailures = (result.failures?.length ?? 0) > 0;
    pool.status = hasFailures ? LootPoolStatus.PARTIALLY_DISTRIBUTED : LootPoolStatus.DISTRIBUTED;
    pool.distributedAt = new Date();
    await this.repository.save(pool);

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId,
      resource: `loot/${poolId}`,
      action: isRetry ? 'loot_pool_distribution_retried' : 'loot_pool_distributed',
      message: isRetry
        ? `Loot pool distribution retried via ${pool.distributionMethod}`
        : `Loot pool distributed via ${pool.distributionMethod}`,
      metadata: { organizationId, poolId, method: pool.distributionMethod, isRetry },
    });

    emitToOrganization(organizationId, 'loot:pool_distributed', {
      poolId,
      method: pool.distributionMethod,
      status: pool.status,
      failureCount: result.failures?.length ?? 0,
      isRetry,
    });
    logger.info('Loot pool distributed', {
      organizationId,
      poolId,
      method: pool.distributionMethod,
      awards: result.awards.length,
      failures: result.failures?.length ?? 0,
      status: pool.status,
      isRetry,
    });

    return result;
  }

  /**
   * EVEN_SPLIT: the total value is shared between the active participants.
   * When rules.shareTotalPayout is set, real aUEC is paid from the org pool to
   * each participant (role-weighted if rules.roleWeights provided); otherwise the
   * split is advisory (amounts only, no treasury movement).
   */
  private async distributeEvenSplit(
    organizationId: string,
    userId: string,
    pool: LootPool,
    items: LootItem[],
    participants: EligibleParticipant[]
  ): Promise<LootDistributionResult> {
    const totalValue = items.reduce((sum, i) => sum + Number(i.totalValue), 0);
    const payouts = this.computeWeightedShares(totalValue, participants, pool.rules?.roleWeights);
    const completedPayoutUserIds = new Set(this.getEvenSplitPaidUserIds(pool));
    const shouldPayout = Boolean(pool.rules?.shareTotalPayout);

    const failures = shouldPayout
      ? await this.processEvenSplitPayouts(
          organizationId,
          userId,
          pool,
          payouts,
          completedPayoutUserIds
        )
      : [];

    if (shouldPayout) {
      pool.metadata = this.withEvenSplitPaidUserIds(
        pool.metadata,
        Array.from(completedPayoutUserIds)
      );
    } else {
      pool.metadata = this.withEvenSplitPaidUserIds(pool.metadata, []);
    }

    return {
      poolId: pool.id,
      distributionMethod: pool.distributionMethod,
      totalValue: Number(totalValue.toFixed(2)),
      currency: pool.currency,
      awards: [],
      payouts,
      failures,
    };
  }

  private async processEvenSplitPayouts(
    organizationId: string,
    userId: string,
    pool: LootPool,
    payouts: Array<{ userId: string; userName?: string; amount: number }>,
    completedPayoutUserIds: Set<string>
  ): Promise<LootDistributionFailure[]> {
    const failures: LootDistributionFailure[] = [];

    for (const payout of payouts) {
      if (payout.amount <= 0 || completedPayoutUserIds.has(payout.userId)) {
        continue;
      }

      try {
        await this.treasuryService.transferCredits(organizationId, userId, {
          toUserId: payout.userId,
          amount: Number(payout.amount.toFixed(2)),
          note: `Loot share: ${pool.name}`,
        });
        completedPayoutUserIds.add(payout.userId);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({
          userId: payout.userId,
          userName: payout.userName,
          amount: Number(payout.amount.toFixed(2)),
          reason,
          stage: 'payout',
        });
        logger.error('Loot even-split payout failed', {
          organizationId,
          poolId: pool.id,
          toUserId: payout.userId,
          error: reason,
        });
      }
    }

    return failures;
  }

  /**
   * AUEC_BID: highest bid per item wins. The winner pays their bid into the org
   * credit pool. Respects the per-participant item cap.
   */
  private async distributeBids(
    organizationId: string,
    actorUserId: string,
    pool: LootPool,
    items: LootItem[],
    claims: LootClaim[]
  ): Promise<LootDistributionResult> {
    const awards: LootDistributionAward[] = [];
    const failures: LootDistributionFailure[] = [];
    const wonCount = new Map<string, number>();
    const cap = pool.rules?.maxItemsPerParticipant;

    for (const item of items) {
      if (item.status !== LootItemStatus.AVAILABLE) {
        continue;
      }

      const winner = this.findWinningBid(claims, item.id, wonCount, cap);
      if (!winner) {
        continue;
      }

      const bidAmount = Number(Number(winner.bidAmount ?? 0).toFixed(2));

      const settlementError = await this.settleWinningBid(
        organizationId,
        pool,
        item,
        winner,
        bidAmount
      );
      if (settlementError) {
        failures.push({
          lootItemId: item.id,
          itemName: item.name,
          userId: winner.userId,
          userName: winner.userName,
          amount: bidAmount,
          reason: settlementError,
          stage: 'settlement',
        });
        continue;
      }

      const finalizationError = await this.finalizeWinningBid(item, winner);
      if (finalizationError) {
        const compensationFailure = await this.compensateFailedBidAward(
          organizationId,
          actorUserId,
          pool,
          item,
          winner,
          bidAmount
        );
        failures.push({
          lootItemId: item.id,
          itemName: item.name,
          userId: winner.userId,
          userName: winner.userName,
          amount: bidAmount,
          reason: compensationFailure
            ? `${finalizationError}; compensation failed: ${compensationFailure}`
            : finalizationError,
          stage: 'settlement',
        });
        logger.error('Loot bid post-settlement update failed', {
          organizationId,
          poolId: pool.id,
          itemId: item.id,
          bidderId: winner.userId,
          error: finalizationError,
        });
        continue;
      }

      wonCount.set(winner.userId, (wonCount.get(winner.userId) ?? 0) + 1);
      awards.push({
        lootItemId: item.id,
        itemName: item.name,
        userId: winner.userId,
        userName: winner.userName,
        amount: bidAmount,
        claimType: LootClaimType.BID,
      });
    }

    return {
      poolId: pool.id,
      distributionMethod: pool.distributionMethod,
      totalValue: Number(items.reduce((s, i) => s + Number(i.totalValue), 0).toFixed(2)),
      currency: pool.currency,
      awards,
      failures,
    };
  }

  private findWinningBid(
    claims: LootClaim[],
    itemId: string,
    wonCount: Map<string, number>,
    cap?: number
  ): LootClaim | undefined {
    const bids = claims
      .filter(
        claim =>
          claim.lootItemId === itemId &&
          claim.claimType === LootClaimType.BID &&
          claim.status === LootClaimStatus.PENDING
      )
      .sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount));

    return bids.find(bid => !this.capReached(wonCount, bid.userId, cap));
  }

  private async settleWinningBid(
    organizationId: string,
    pool: LootPool,
    item: LootItem,
    winner: LootClaim,
    bidAmount: number
  ): Promise<string | null> {
    try {
      await this.treasuryService.earnCredits(organizationId, winner.userId, {
        amount: bidAmount,
        source: `Loot bid won: ${item.name} (${pool.name})`,
        category: 'loot',
        metadata: { poolId: pool.id, itemId: item.id, bidderId: winner.userId },
      });
      return null;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('Loot bid settlement failed — skipping item', {
        organizationId,
        poolId: pool.id,
        itemId: item.id,
        error: reason,
      });
      return reason;
    }
  }

  private async finalizeWinningBid(item: LootItem, winner: LootClaim): Promise<string | null> {
    try {
      await AppDataSource.transaction(async manager => {
        const transactionClaimRepo = manager.getRepository(LootClaim);
        const transactionItemRepo = manager.getRepository(LootItem);

        winner.status = LootClaimStatus.WON;
        await transactionClaimRepo.save(winner);

        await transactionClaimRepo
          .createQueryBuilder()
          .update(LootClaim)
          .set({ status: LootClaimStatus.LOST })
          .where('"lootItemId" = :itemId', { itemId: item.id })
          .andWhere('id != :winnerClaimId', { winnerClaimId: winner.id })
          .execute();

        item.awardedToUserId = winner.userId;
        item.status = LootItemStatus.AWARDED;
        await transactionItemRepo.save(item);
      });
      return null;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private async compensateFailedBidAward(
    organizationId: string,
    actorUserId: string,
    pool: LootPool,
    item: LootItem,
    winner: LootClaim,
    bidAmount: number
  ): Promise<string | null> {
    try {
      await this.treasuryService.spendCredits(organizationId, actorUserId, {
        amount: bidAmount,
        purpose: `Compensation rollback for failed loot bid award: ${item.name} (${pool.name})`,
        category: 'loot',
        metadata: {
          poolId: pool.id,
          itemId: item.id,
          bidderId: winner.userId,
          winnerClaimId: winner.id,
        },
      });
      return null;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('Loot bid compensation rollback failed', {
        organizationId,
        poolId: pool.id,
        itemId: item.id,
        bidderId: winner.userId,
        error: reason,
      });
      return reason;
    }
  }

  /**
   * NEED_GREED / RANDOM_ROLL: roll per item amongst interested claimants. For
   * need/greed, NEED claims outrank GREED claims; the highest roll within the
   * winning tier takes the item. Respects the per-participant item cap.
   */
  private async distributeRolls(
    pool: LootPool,
    items: LootItem[],
    claims: LootClaim[]
  ): Promise<LootDistributionResult> {
    const awards: LootDistributionAward[] = [];
    const wonCount = new Map<string, number>();
    const cap = pool.rules?.maxItemsPerParticipant;
    const needGreed = pool.distributionMethod === LootDistributionMethod.NEED_GREED;

    for (const item of items) {
      if (item.status !== LootItemStatus.AVAILABLE) {
        continue;
      }

      const contenders = claims.filter(
        c =>
          c.lootItemId === item.id &&
          c.status === LootClaimStatus.PENDING &&
          !this.capReached(wonCount, c.userId, cap)
      );
      if (contenders.length === 0) {
        continue;
      }

      // Assign each contender a roll (1-100) for transparency.
      for (const c of contenders) {
        c.rollValue = this.roll();
      }

      let pool1 = contenders;
      if (needGreed) {
        const needers = contenders.filter(c => c.claimType === LootClaimType.NEED);
        pool1 = needers.length > 0 ? needers : contenders;
      }

      const [firstContender, ...remainingContenders] = pool1;
      const winner = remainingContenders.reduce(
        (best, c) => ((c.rollValue ?? 0) > (best.rollValue ?? 0) ? c : best),
        firstContender
      );

      winner.status = LootClaimStatus.WON;
      // Persist all rolls so participants can see the outcome.
      await this.claimRepo.save(contenders);
      await this.markLosers(item.id, winner.id);
      await this.awardItemTo(item, winner.userId);

      wonCount.set(winner.userId, (wonCount.get(winner.userId) ?? 0) + 1);
      awards.push({
        lootItemId: item.id,
        itemName: item.name,
        userId: winner.userId,
        userName: winner.userName,
        rollValue: winner.rollValue,
        claimType: winner.claimType,
      });
    }

    return {
      poolId: pool.id,
      distributionMethod: pool.distributionMethod,
      totalValue: Number(items.reduce((s, i) => s + Number(i.totalValue), 0).toFixed(2)),
      currency: pool.currency,
      awards,
      failures: [],
    };
  }

  /** LEADER_ASSIGN: items are awarded ahead of time; just summarise. */
  private summariseLeaderAssign(pool: LootPool, items: LootItem[]): LootDistributionResult {
    const awards: LootDistributionAward[] = items
      .filter(i => i.awardedToUserId)
      .map(i => ({
        lootItemId: i.id,
        itemName: i.name,
        userId: i.awardedToUserId,
        claimType: undefined,
      }));

    return {
      poolId: pool.id,
      distributionMethod: pool.distributionMethod,
      totalValue: Number(items.reduce((s, i) => s + Number(i.totalValue), 0).toFixed(2)),
      currency: pool.currency,
      awards,
      failures: [],
    };
  }

  /**
   * Leader manually awards a specific item to a participant (LEADER_ASSIGN).
   * Only valid while the pool is locked.
   */
  async assignItem(
    organizationId: string,
    poolId: string,
    itemId: string,
    userId: string,
    targetUserId: string
  ): Promise<LootItem> {
    const pool = await this.requirePool(organizationId, poolId);
    await this.assertManager(pool, userId);
    this.assertStatus(
      pool,
      LootPoolStatus.LOCKED,
      'Items can only be assigned while the pool is locked'
    );
    await this.assertEligibleParticipant(pool, targetUserId);

    const item = await this.findPoolItem(poolId, itemId);
    if (!item) {
      throw new NotFoundError('Loot item');
    }
    await this.awardItemTo(item, targetUserId);
    emitToOrganization(organizationId, 'loot:item_assigned', { poolId, itemId, targetUserId });
    return item;
  }

  // ==================== ELIGIBILITY ====================

  /** Active participants of the anchoring activity, filtered by eligible roles. */
  async getEligibleParticipants(pool: LootPool): Promise<EligibleParticipant[]> {
    const participants = await this.participantRepo
      .createQueryBuilder('participant')
      .where('participant."activityId" = :activityId', { activityId: pool.activityId })
      .andWhere('participant.status = :status', { status: ActivityParticipantStatus.ACCEPTED })
      .getMany();
    const eligibleRoles = pool.rules?.eligibleRoles;
    return participants
      .filter(p => !eligibleRoles?.length || eligibleRoles.includes(p.role))
      .map(p => ({ userId: p.userId, userName: p.userName, role: p.role }));
  }

  // ==================== HELPERS ====================

  private async requirePool(organizationId: string, poolId: string): Promise<LootPool> {
    const pool = await this.getPoolById(organizationId, poolId);
    if (!pool) {
      throw new NotFoundError('Loot pool');
    }
    return pool;
  }

  private async assertManager(pool: LootPool, userId: string): Promise<void> {
    const assistantUserIds = await this.getAssistantUserIds(pool);
    if (
      pool.leaderId !== userId &&
      pool.createdBy !== userId &&
      !assistantUserIds.includes(userId)
    ) {
      throw new ForbiddenError(
        'Only the mission leader, creator, or assigned assistant can manage this loot pool'
      );
    }
  }

  private assertStatus(pool: LootPool, expected: LootPoolStatus, message: string): void {
    if (pool.status !== expected) {
      throw new ConflictError(message);
    }
  }

  private assertClaimWindowOpen(pool: LootPool): void {
    const closesAt = pool.rules?.closesAt;
    if (closesAt && new Date(closesAt).getTime() < Date.now()) {
      throw new ConflictError('The claim/bid window for this pool has closed');
    }
  }

  private assertClaimTypeMatchesMethod(
    method: LootDistributionMethod,
    claimType: LootClaimType
  ): void {
    const allowed: Record<LootDistributionMethod, LootClaimType[]> = {
      [LootDistributionMethod.NEED_GREED]: [LootClaimType.NEED, LootClaimType.GREED],
      [LootDistributionMethod.RANDOM_ROLL]: [LootClaimType.ROLL],
      [LootDistributionMethod.AUEC_BID]: [LootClaimType.BID],
      [LootDistributionMethod.EVEN_SPLIT]: [],
      [LootDistributionMethod.LEADER_ASSIGN]: [],
    };
    const valid = allowed[method];
    if (valid.length === 0) {
      throw new ValidationError(
        `Distribution method "${method}" does not accept participant claims`
      );
    }
    if (!valid.includes(claimType)) {
      throw new ValidationError(
        `Claim type "${claimType}" is not valid for distribution method "${method}"`
      );
    }
  }

  private async assertEligibleParticipant(
    pool: LootPool,
    userId: string
  ): Promise<ActivityParticipantEntity> {
    const participant = await this.participantRepo
      .createQueryBuilder('participant')
      .where('participant."activityId" = :activityId', { activityId: pool.activityId })
      .andWhere('participant."userId" = :userId', { userId })
      .getOne();
    if (participant?.status !== ActivityParticipantStatus.ACCEPTED) {
      throw new ForbiddenError('Only active participants of the mission can claim loot');
    }
    const eligibleRoles = pool.rules?.eligibleRoles;
    if (eligibleRoles?.length && !eligibleRoles.includes(participant.role)) {
      throw new ForbiddenError('Your role is not eligible to claim from this loot pool');
    }
    return participant;
  }

  /** Enforce maxItemsPerParticipant by counting the user's existing pending claims. */
  private async assertWithinItemCap(pool: LootPool, itemId: string, userId: string): Promise<void> {
    const cap = pool.rules?.maxItemsPerParticipant;
    if (!cap || cap <= 0) {
      return;
    }
    const existing = await this.claimRepo
      .createQueryBuilder('claim')
      .where('claim."lootPoolId" = :poolId', { poolId: pool.id })
      .andWhere('claim."userId" = :userId', { userId })
      .andWhere('claim.status = :status', { status: LootClaimStatus.PENDING })
      .getMany();
    const distinctItems = new Set(existing.map(c => c.lootItemId));
    distinctItems.delete(itemId); // updating an existing claim on this item is fine
    if (distinctItems.size >= cap) {
      throw new ValidationError(
        `You may only claim ${cap} item${cap === 1 ? '' : 's'} from this pool`
      );
    }
  }

  private capReached(wonCount: Map<string, number>, userId: string, cap?: number): boolean {
    if (!cap || cap <= 0) {
      return false;
    }
    return (wonCount.get(userId) ?? 0) >= cap;
  }

  private async getHighestBid(itemId: string): Promise<LootClaim | null> {
    return this.claimRepo
      .createQueryBuilder('claim')
      .where('claim."lootItemId" = :itemId', { itemId })
      .andWhere('claim."claimType" = :claimType', { claimType: LootClaimType.BID })
      .orderBy('claim."bidAmount"', 'DESC')
      .getOne();
  }

  private async markLosers(itemId: string, winnerClaimId: string): Promise<void> {
    await this.claimRepo
      .createQueryBuilder()
      .update(LootClaim)
      .set({ status: LootClaimStatus.LOST })
      .where('"lootItemId" = :itemId', { itemId })
      .andWhere('id != :winnerClaimId', { winnerClaimId })
      .execute();
  }

  private async awardItemTo(item: LootItem, userId: string): Promise<void> {
    item.awardedToUserId = userId;
    item.status = LootItemStatus.AWARDED;
    await this.itemRepo.save(item);
  }

  private computeWeightedShares(
    totalValue: number,
    participants: EligibleParticipant[],
    roleWeights?: Record<string, number>
  ): Array<{ userId: string; userName?: string; amount: number }> {
    if (participants.length === 0) {
      return [];
    }
    const weightFor = (role: string): number => {
      const w = roleWeights?.[role];
      return w && w > 0 ? w : 1;
    };
    const totalWeight = participants.reduce((sum, p) => sum + weightFor(p.role), 0);
    return participants.map(p => ({
      userId: p.userId,
      userName: p.userName,
      amount: Number(((totalValue * weightFor(p.role)) / totalWeight).toFixed(2)),
    }));
  }

  private roll(): number {
    return Math.floor(Math.random() * 100) + 1;
  }

  private async recomputeTotal(pool: LootPool): Promise<void> {
    const raw = await this.itemRepo
      .createQueryBuilder('item')
      .select('COALESCE(SUM(item."totalValue"), 0)', 'total')
      .where('item."lootPoolId" = :poolId', { poolId: pool.id })
      .getRawOne<{ total: string }>();
    pool.totalValue = Number(raw?.total ?? 0);
    await this.repository.save(pool);
  }

  /** Resolve the activity's LEADER participant, falling back to a default id. */
  private async resolveLeaderId(activityId: string, fallback: string): Promise<string> {
    const leader = await this.participantRepo
      .createQueryBuilder('participant')
      .where('participant."activityId" = :activityId', { activityId })
      .andWhere('participant.role = :role', { role: ParticipantRole.LEADER })
      .getOne();
    return leader?.userId ?? fallback;
  }

  private async findPoolItem(poolId: string, itemId: string): Promise<LootItem | null> {
    return this.itemRepo
      .createQueryBuilder('item')
      .where('item.id = :itemId', { itemId })
      .andWhere('item."lootPoolId" = :poolId', { poolId })
      .getOne();
  }

  private normaliseAssistantUserIds(assistantUserIds?: string[]): string[] {
    if (!assistantUserIds?.length) {
      return [];
    }
    const normalised = assistantUserIds
      .map(candidate => candidate.trim())
      .filter(candidate => candidate.length > 0);
    return Array.from(new Set(normalised));
  }

  private normaliseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(
      new Set(
        value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      )
    );
  }

  private withAssistantUserIds(
    metadata: Record<string, unknown> | undefined,
    assistantUserIds: string[]
  ): Record<string, unknown> | undefined {
    const nextMetadata: Record<string, unknown> = metadata ? { ...metadata } : {};
    if (assistantUserIds.length === 0) {
      delete nextMetadata['assistantUserIds'];
      return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
    }
    nextMetadata['assistantUserIds'] = assistantUserIds;
    return nextMetadata;
  }

  private async getAssistantUserIds(pool: LootPool): Promise<string[]> {
    const assistants = await this.assistantRepo
      .createQueryBuilder('assistant')
      .select('assistant."userId"', 'userId')
      .where('assistant."organizationId" = :organizationId', {
        organizationId: pool.organizationId,
      })
      .andWhere('assistant."lootPoolId" = :lootPoolId', { lootPoolId: pool.id })
      .getRawMany<{ userId: string }>();

    if (assistants.length > 0) {
      return this.normaliseStringArray(assistants.map(assistant => assistant.userId));
    }

    return this.getAssistantUserIdsFromMetadata(pool);
  }

  private getAssistantUserIdsFromMetadata(pool: LootPool): string[] {
    const assistantUserIds = pool.metadata?.['assistantUserIds'];
    return this.normaliseStringArray(assistantUserIds);
  }

  private withEvenSplitPaidUserIds(
    metadata: Record<string, unknown> | undefined,
    paidUserIds: string[]
  ): Record<string, unknown> | undefined {
    const nextMetadata: Record<string, unknown> = metadata ? { ...metadata } : {};
    if (paidUserIds.length === 0) {
      delete nextMetadata['evenSplitPaidUserIds'];
      return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
    }
    nextMetadata['evenSplitPaidUserIds'] = paidUserIds;
    return nextMetadata;
  }

  private getEvenSplitPaidUserIds(pool: LootPool): string[] {
    const paidUserIds = pool.metadata?.['evenSplitPaidUserIds'];
    return this.normaliseStringArray(paidUserIds);
  }

  private async replacePoolAssistants(
    organizationId: string,
    poolId: string,
    assistantUserIds: string[]
  ): Promise<void> {
    await AppDataSource.transaction(async manager => {
      const assistantRepo = manager.getRepository(LootPoolAssistant);
      await assistantRepo.delete({ organizationId, lootPoolId: poolId });

      if (assistantUserIds.length > 0) {
        const entities = assistantUserIds.map(assistantUserId =>
          assistantRepo.create({
            organizationId,
            lootPoolId: poolId,
            userId: assistantUserId,
          })
        );
        await assistantRepo.save(entities);
      }
    });
  }

  private async hydratePoolAssistants(pool: LootPool): Promise<void> {
    const assistantUserIds = await this.getAssistantUserIds(pool);
    pool.metadata = this.withAssistantUserIds(pool.metadata, assistantUserIds);
  }

  private async hydratePoolsAssistants(pools: LootPool[]): Promise<void> {
    if (pools.length === 0) {
      return;
    }

    const poolIds = pools.map(pool => pool.id);
    const organizationId = pools[0].organizationId;
    const assistants = await this.assistantRepo
      .createQueryBuilder('assistant')
      .select('assistant."lootPoolId"', 'lootPoolId')
      .addSelect('assistant."userId"', 'userId')
      .where('assistant."organizationId" = :organizationId', { organizationId })
      .andWhere('assistant."lootPoolId" IN (:...poolIds)', { poolIds })
      .getRawMany<{ lootPoolId: string; userId: string }>();

    const assistantsByPoolId = new Map<string, string[]>();
    for (const assistant of assistants) {
      const existing = assistantsByPoolId.get(assistant.lootPoolId) ?? [];
      existing.push(assistant.userId);
      assistantsByPoolId.set(assistant.lootPoolId, existing);
    }

    for (const pool of pools) {
      const assistantUserIds = assistantsByPoolId.get(pool.id)
        ? this.normaliseStringArray(assistantsByPoolId.get(pool.id))
        : this.getAssistantUserIdsFromMetadata(pool);
      pool.metadata = this.withAssistantUserIds(pool.metadata, assistantUserIds);
    }
  }
}

// Singleton for DI consistency with other services.
let lootDistributionServiceInstance: LootDistributionService | null = null;

export function getLootDistributionService(): LootDistributionService {
  lootDistributionServiceInstance ??= new LootDistributionService();
  return lootDistributionServiceInstance;
}

