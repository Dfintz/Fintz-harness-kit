"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LootDistributionService = void 0;
exports.getLootDistributionService = getLootDistributionService;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const LootClaim_1 = require("../../models/LootClaim");
const LootItem_1 = require("../../models/LootItem");
const LootPool_1 = require("../../models/LootPool");
const LootPoolAssistant_1 = require("../../models/LootPoolAssistant");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const TreasuryService_1 = require("../treasury/TreasuryService");
class LootDistributionService extends TenantService_1.TenantService {
    itemRepo = data_source_1.AppDataSource.getRepository(LootItem_1.LootItem);
    claimRepo = data_source_1.AppDataSource.getRepository(LootClaim_1.LootClaim);
    assistantRepo = data_source_1.AppDataSource.getRepository(LootPoolAssistant_1.LootPoolAssistant);
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    treasuryService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(LootPool_1.LootPool), {
            enableCache: false,
        });
        this.treasuryService = (0, TreasuryService_1.getTreasuryService)();
    }
    async createPool(organizationId, userId, dto) {
        const activity = await this.activityRepo
            .createQueryBuilder('activity')
            .where('activity.id = :activityId', { activityId: dto.activityId })
            .getOne();
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        if (activity.organizationId && activity.organizationId !== organizationId) {
            throw new apiErrors_1.ForbiddenError('Activity belongs to a different organization');
        }
        const leaderId = await this.resolveLeaderId(dto.activityId, activity.creatorId ?? userId);
        const assistantUserIds = this.normaliseAssistantUserIds(dto.assistantUserIds).filter(candidateId => candidateId !== userId && candidateId !== leaderId);
        const pool = await this.create(organizationId, {
            name: dto.name,
            description: dto.description,
            activityId: dto.activityId,
            missionId: dto.missionId,
            lfgSessionId: dto.lfgSessionId,
            distributionMethod: dto.distributionMethod ?? LootPool_1.LootDistributionMethod.NEED_GREED,
            rules: dto.rules,
            currency: dto.currency ?? 'aUEC',
            totalValue: 0,
            status: LootPool_1.LootPoolStatus.OPEN,
            leaderId,
            createdBy: userId,
            metadata: assistantUserIds.length > 0 ? { assistantUserIds } : undefined,
        });
        await this.replacePoolAssistants(organizationId, pool.id, assistantUserIds);
        await this.hydratePoolAssistants(pool);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId,
            resource: `loot/${pool.id}`,
            action: 'loot_pool_created',
            message: `Loot pool created: ${pool.name}`,
            metadata: { organizationId, poolId: pool.id, activityId: dto.activityId },
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:pool_created', { poolId: pool.id, name: pool.name });
        logger_1.logger.info('Loot pool created', {
            organizationId,
            poolId: pool.id,
            activityId: dto.activityId,
        });
        return pool;
    }
    async getPoolById(organizationId, poolId) {
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
    async assertCanManagePool(organizationId, poolId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        return pool;
    }
    async getPoolDetail(organizationId, poolId) {
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
    async listPools(organizationId, pagination, filters) {
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
    async updatePool(organizationId, poolId, userId, dto) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Pool rules can only be changed while it is open');
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
            const assistantUserIds = this.normaliseAssistantUserIds(dto.assistantUserIds).filter(candidateId => candidateId !== pool.createdBy && candidateId !== pool.leaderId);
            pool.metadata = this.withAssistantUserIds(pool.metadata, assistantUserIds);
            await this.replacePoolAssistants(organizationId, pool.id, assistantUserIds);
        }
        const saved = await this.repository.save(pool);
        await this.hydratePoolAssistants(saved);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:pool_updated', { poolId });
        return saved;
    }
    async lockPool(organizationId, poolId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Only open pools can be locked');
        const itemCount = await this.itemRepo.count({ where: { lootPoolId: poolId } });
        if (itemCount === 0) {
            throw new apiErrors_1.ValidationError('Cannot lock a pool with no items');
        }
        pool.status = LootPool_1.LootPoolStatus.LOCKED;
        const saved = await this.repository.save(pool);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:pool_locked', { poolId });
        logger_1.logger.info('Loot pool locked', { organizationId, poolId });
        return saved;
    }
    async cancelPool(organizationId, poolId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        if (pool.status === LootPool_1.LootPoolStatus.DISTRIBUTED ||
            pool.status === LootPool_1.LootPoolStatus.PARTIALLY_DISTRIBUTED) {
            throw new apiErrors_1.ConflictError('A distributed pool cannot be cancelled');
        }
        pool.status = LootPool_1.LootPoolStatus.CANCELLED;
        const saved = await this.repository.save(pool);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:pool_cancelled', { poolId });
        return saved;
    }
    async addItem(organizationId, poolId, userId, dto) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Items can only be added while the pool is open');
        const quantity = dto.quantity ?? 1;
        const unitValue = dto.unitValue ?? 0;
        const item = this.itemRepo.create({
            organizationId,
            lootPoolId: poolId,
            name: dto.name,
            category: dto.category ?? LootItem_1.LootItemCategory.OTHER,
            quantity,
            unitValue,
            totalValue: Number((quantity * unitValue).toFixed(2)),
            status: LootItem_1.LootItemStatus.AVAILABLE,
            source: dto.source ?? LootItem_1.LootItemSource.MANUAL,
            imageUrl: dto.imageUrl,
            metadata: dto.metadata,
        });
        const saved = await this.itemRepo.save(item);
        await this.recomputeTotal(pool);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:item_added', { poolId, itemId: saved.id });
        return saved;
    }
    async addItemsBulk(organizationId, poolId, userId, items) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Items can only be added while the pool is open');
        const entities = items.map(dto => {
            const quantity = dto.quantity ?? 1;
            const unitValue = dto.unitValue ?? 0;
            return this.itemRepo.create({
                organizationId,
                lootPoolId: poolId,
                name: dto.name,
                category: dto.category ?? LootItem_1.LootItemCategory.OTHER,
                quantity,
                unitValue,
                totalValue: Number((quantity * unitValue).toFixed(2)),
                status: LootItem_1.LootItemStatus.AVAILABLE,
                source: dto.source ?? LootItem_1.LootItemSource.MANUAL,
                imageUrl: dto.imageUrl,
                metadata: dto.metadata,
            });
        });
        const saved = await this.itemRepo.save(entities);
        await this.recomputeTotal(pool);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:items_added', { poolId, count: saved.length });
        return saved;
    }
    async updateItem(organizationId, poolId, itemId, userId, dto) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Items can only be edited while the pool is open');
        const item = await this.findPoolItem(poolId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Loot item');
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
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:item_updated', { poolId, itemId });
        return saved;
    }
    async removeItem(organizationId, poolId, itemId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.OPEN, 'Items can only be removed while the pool is open');
        const item = await this.findPoolItem(poolId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Loot item');
        }
        await this.itemRepo.remove(item);
        await this.recomputeTotal(pool);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:item_removed', { poolId, itemId });
    }
    async claimItem(organizationId, poolId, itemId, user, dto) {
        const pool = await this.requirePool(organizationId, poolId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.LOCKED, 'Claims are only accepted while the pool is locked');
        this.assertClaimWindowOpen(pool);
        const participant = await this.assertEligibleParticipant(pool, user.id);
        const item = await this.findPoolItem(poolId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Loot item');
        }
        this.assertClaimTypeMatchesMethod(pool.distributionMethod, dto.claimType);
        if (dto.claimType === LootClaim_1.LootClaimType.BID) {
            const bid = Number(dto.bidAmount ?? 0);
            if (bid <= 0) {
                throw new apiErrors_1.ValidationError('A bid amount greater than zero is required');
            }
            const minIncrement = pool.rules?.minBidIncrement ?? 1;
            const highest = await this.getHighestBid(itemId);
            if (highest && bid < Number(highest.bidAmount) + minIncrement) {
                throw new apiErrors_1.ValidationError(`Bid must be at least ${Number(highest.bidAmount) + minIncrement} ${pool.currency}`);
            }
        }
        await this.assertWithinItemCap(pool, itemId, user.id);
        const existing = await this.claimRepo
            .createQueryBuilder('claim')
            .where('claim."lootItemId" = :itemId', { itemId })
            .andWhere('claim."userId" = :userId', { userId: user.id })
            .getOne();
        let claim;
        if (existing) {
            existing.claimType = dto.claimType;
            existing.bidAmount = dto.claimType === LootClaim_1.LootClaimType.BID ? Number(dto.bidAmount) : undefined;
            existing.status = LootClaim_1.LootClaimStatus.PENDING;
            existing.userName = user.name;
            claim = await this.claimRepo.save(existing);
        }
        else {
            claim = await this.claimRepo.save(this.claimRepo.create({
                organizationId,
                lootPoolId: poolId,
                lootItemId: itemId,
                userId: user.id,
                userName: user.name,
                claimType: dto.claimType,
                bidAmount: dto.claimType === LootClaim_1.LootClaimType.BID ? Number(dto.bidAmount) : undefined,
                status: LootClaim_1.LootClaimStatus.PENDING,
            }));
        }
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:claim_placed', {
            poolId,
            itemId,
            userId: user.id,
            claimType: dto.claimType,
            bidAmount: claim.bidAmount,
            role: participant.role,
        });
        return claim;
    }
    async withdrawClaim(organizationId, poolId, itemId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.LOCKED, 'Claims can only be withdrawn while the pool is locked');
        const claim = await this.claimRepo
            .createQueryBuilder('claim')
            .where('claim."lootItemId" = :itemId', { itemId })
            .andWhere('claim."userId" = :userId', { userId })
            .andWhere('claim."lootPoolId" = :poolId', { poolId })
            .getOne();
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Loot claim');
        }
        await this.claimRepo.remove(claim);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:claim_withdrawn', { poolId, itemId, userId });
    }
    async distribute(organizationId, poolId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.LOCKED, 'Only a locked pool can be distributed');
        return this.executeDistribution(organizationId, pool, userId, false);
    }
    async retryDistribution(organizationId, poolId, userId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.PARTIALLY_DISTRIBUTED, 'Only a partially distributed pool can be retried');
        return this.executeDistribution(organizationId, pool, userId, true);
    }
    async executeDistribution(organizationId, pool, userId, isRetry) {
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
        let result;
        if (pool.distributionMethod === LootPool_1.LootDistributionMethod.EVEN_SPLIT) {
            result = await this.distributeEvenSplit(organizationId, userId, pool, items, participants);
        }
        else if (pool.distributionMethod === LootPool_1.LootDistributionMethod.AUEC_BID) {
            result = await this.distributeBids(organizationId, userId, pool, items, claims);
        }
        else if (pool.distributionMethod === LootPool_1.LootDistributionMethod.LEADER_ASSIGN) {
            result = this.summariseLeaderAssign(pool, items);
        }
        else {
            result = await this.distributeRolls(pool, items, claims);
        }
        const hasFailures = (result.failures?.length ?? 0) > 0;
        pool.status = hasFailures ? LootPool_1.LootPoolStatus.PARTIALLY_DISTRIBUTED : LootPool_1.LootPoolStatus.DISTRIBUTED;
        pool.distributedAt = new Date();
        await this.repository.save(pool);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId,
            resource: `loot/${poolId}`,
            action: isRetry ? 'loot_pool_distribution_retried' : 'loot_pool_distributed',
            message: isRetry
                ? `Loot pool distribution retried via ${pool.distributionMethod}`
                : `Loot pool distributed via ${pool.distributionMethod}`,
            metadata: { organizationId, poolId, method: pool.distributionMethod, isRetry },
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:pool_distributed', {
            poolId,
            method: pool.distributionMethod,
            status: pool.status,
            failureCount: result.failures?.length ?? 0,
            isRetry,
        });
        logger_1.logger.info('Loot pool distributed', {
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
    async distributeEvenSplit(organizationId, userId, pool, items, participants) {
        const totalValue = items.reduce((sum, i) => sum + Number(i.totalValue), 0);
        const payouts = this.computeWeightedShares(totalValue, participants, pool.rules?.roleWeights);
        const completedPayoutUserIds = new Set(this.getEvenSplitPaidUserIds(pool));
        const shouldPayout = Boolean(pool.rules?.shareTotalPayout);
        const failures = shouldPayout
            ? await this.processEvenSplitPayouts(organizationId, userId, pool, payouts, completedPayoutUserIds)
            : [];
        if (shouldPayout) {
            pool.metadata = this.withEvenSplitPaidUserIds(pool.metadata, Array.from(completedPayoutUserIds));
        }
        else {
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
    async processEvenSplitPayouts(organizationId, userId, pool, payouts, completedPayoutUserIds) {
        const failures = [];
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
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                failures.push({
                    userId: payout.userId,
                    userName: payout.userName,
                    amount: Number(payout.amount.toFixed(2)),
                    reason,
                    stage: 'payout',
                });
                logger_1.logger.error('Loot even-split payout failed', {
                    organizationId,
                    poolId: pool.id,
                    toUserId: payout.userId,
                    error: reason,
                });
            }
        }
        return failures;
    }
    async distributeBids(organizationId, actorUserId, pool, items, claims) {
        const awards = [];
        const failures = [];
        const wonCount = new Map();
        const cap = pool.rules?.maxItemsPerParticipant;
        for (const item of items) {
            if (item.status !== LootItem_1.LootItemStatus.AVAILABLE) {
                continue;
            }
            const winner = this.findWinningBid(claims, item.id, wonCount, cap);
            if (!winner) {
                continue;
            }
            const bidAmount = Number(Number(winner.bidAmount ?? 0).toFixed(2));
            const settlementError = await this.settleWinningBid(organizationId, pool, item, winner, bidAmount);
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
                const compensationFailure = await this.compensateFailedBidAward(organizationId, actorUserId, pool, item, winner, bidAmount);
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
                logger_1.logger.error('Loot bid post-settlement update failed', {
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
                claimType: LootClaim_1.LootClaimType.BID,
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
    findWinningBid(claims, itemId, wonCount, cap) {
        const bids = claims
            .filter(claim => claim.lootItemId === itemId &&
            claim.claimType === LootClaim_1.LootClaimType.BID &&
            claim.status === LootClaim_1.LootClaimStatus.PENDING)
            .sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount));
        return bids.find(bid => !this.capReached(wonCount, bid.userId, cap));
    }
    async settleWinningBid(organizationId, pool, item, winner, bidAmount) {
        try {
            await this.treasuryService.earnCredits(organizationId, winner.userId, {
                amount: bidAmount,
                source: `Loot bid won: ${item.name} (${pool.name})`,
                category: 'loot',
                metadata: { poolId: pool.id, itemId: item.id, bidderId: winner.userId },
            });
            return null;
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Loot bid settlement failed — skipping item', {
                organizationId,
                poolId: pool.id,
                itemId: item.id,
                error: reason,
            });
            return reason;
        }
    }
    async finalizeWinningBid(item, winner) {
        try {
            await data_source_1.AppDataSource.transaction(async (manager) => {
                const transactionClaimRepo = manager.getRepository(LootClaim_1.LootClaim);
                const transactionItemRepo = manager.getRepository(LootItem_1.LootItem);
                winner.status = LootClaim_1.LootClaimStatus.WON;
                await transactionClaimRepo.save(winner);
                await transactionClaimRepo
                    .createQueryBuilder()
                    .update(LootClaim_1.LootClaim)
                    .set({ status: LootClaim_1.LootClaimStatus.LOST })
                    .where('"lootItemId" = :itemId', { itemId: item.id })
                    .andWhere('id != :winnerClaimId', { winnerClaimId: winner.id })
                    .execute();
                item.awardedToUserId = winner.userId;
                item.status = LootItem_1.LootItemStatus.AWARDED;
                await transactionItemRepo.save(item);
            });
            return null;
        }
        catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    }
    async compensateFailedBidAward(organizationId, actorUserId, pool, item, winner, bidAmount) {
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
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Loot bid compensation rollback failed', {
                organizationId,
                poolId: pool.id,
                itemId: item.id,
                bidderId: winner.userId,
                error: reason,
            });
            return reason;
        }
    }
    async distributeRolls(pool, items, claims) {
        const awards = [];
        const wonCount = new Map();
        const cap = pool.rules?.maxItemsPerParticipant;
        const needGreed = pool.distributionMethod === LootPool_1.LootDistributionMethod.NEED_GREED;
        for (const item of items) {
            if (item.status !== LootItem_1.LootItemStatus.AVAILABLE) {
                continue;
            }
            const contenders = claims.filter(c => c.lootItemId === item.id &&
                c.status === LootClaim_1.LootClaimStatus.PENDING &&
                !this.capReached(wonCount, c.userId, cap));
            if (contenders.length === 0) {
                continue;
            }
            for (const c of contenders) {
                c.rollValue = this.roll();
            }
            let pool1 = contenders;
            if (needGreed) {
                const needers = contenders.filter(c => c.claimType === LootClaim_1.LootClaimType.NEED);
                pool1 = needers.length > 0 ? needers : contenders;
            }
            const [firstContender, ...remainingContenders] = pool1;
            const winner = remainingContenders.reduce((best, c) => ((c.rollValue ?? 0) > (best.rollValue ?? 0) ? c : best), firstContender);
            winner.status = LootClaim_1.LootClaimStatus.WON;
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
    summariseLeaderAssign(pool, items) {
        const awards = items
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
    async assignItem(organizationId, poolId, itemId, userId, targetUserId) {
        const pool = await this.requirePool(organizationId, poolId);
        await this.assertManager(pool, userId);
        this.assertStatus(pool, LootPool_1.LootPoolStatus.LOCKED, 'Items can only be assigned while the pool is locked');
        await this.assertEligibleParticipant(pool, targetUserId);
        const item = await this.findPoolItem(poolId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Loot item');
        }
        await this.awardItemTo(item, targetUserId);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'loot:item_assigned', { poolId, itemId, targetUserId });
        return item;
    }
    async getEligibleParticipants(pool) {
        const participants = await this.participantRepo
            .createQueryBuilder('participant')
            .where('participant."activityId" = :activityId', { activityId: pool.activityId })
            .andWhere('participant.status = :status', { status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED })
            .getMany();
        const eligibleRoles = pool.rules?.eligibleRoles;
        return participants
            .filter(p => !eligibleRoles?.length || eligibleRoles.includes(p.role))
            .map(p => ({ userId: p.userId, userName: p.userName, role: p.role }));
    }
    async requirePool(organizationId, poolId) {
        const pool = await this.getPoolById(organizationId, poolId);
        if (!pool) {
            throw new apiErrors_1.NotFoundError('Loot pool');
        }
        return pool;
    }
    async assertManager(pool, userId) {
        const assistantUserIds = await this.getAssistantUserIds(pool);
        if (pool.leaderId !== userId &&
            pool.createdBy !== userId &&
            !assistantUserIds.includes(userId)) {
            throw new apiErrors_1.ForbiddenError('Only the mission leader, creator, or assigned assistant can manage this loot pool');
        }
    }
    assertStatus(pool, expected, message) {
        if (pool.status !== expected) {
            throw new apiErrors_1.ConflictError(message);
        }
    }
    assertClaimWindowOpen(pool) {
        const closesAt = pool.rules?.closesAt;
        if (closesAt && new Date(closesAt).getTime() < Date.now()) {
            throw new apiErrors_1.ConflictError('The claim/bid window for this pool has closed');
        }
    }
    assertClaimTypeMatchesMethod(method, claimType) {
        const allowed = {
            [LootPool_1.LootDistributionMethod.NEED_GREED]: [LootClaim_1.LootClaimType.NEED, LootClaim_1.LootClaimType.GREED],
            [LootPool_1.LootDistributionMethod.RANDOM_ROLL]: [LootClaim_1.LootClaimType.ROLL],
            [LootPool_1.LootDistributionMethod.AUEC_BID]: [LootClaim_1.LootClaimType.BID],
            [LootPool_1.LootDistributionMethod.EVEN_SPLIT]: [],
            [LootPool_1.LootDistributionMethod.LEADER_ASSIGN]: [],
        };
        const valid = allowed[method];
        if (valid.length === 0) {
            throw new apiErrors_1.ValidationError(`Distribution method "${method}" does not accept participant claims`);
        }
        if (!valid.includes(claimType)) {
            throw new apiErrors_1.ValidationError(`Claim type "${claimType}" is not valid for distribution method "${method}"`);
        }
    }
    async assertEligibleParticipant(pool, userId) {
        const participant = await this.participantRepo
            .createQueryBuilder('participant')
            .where('participant."activityId" = :activityId', { activityId: pool.activityId })
            .andWhere('participant."userId" = :userId', { userId })
            .getOne();
        if (participant?.status !== ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED) {
            throw new apiErrors_1.ForbiddenError('Only active participants of the mission can claim loot');
        }
        const eligibleRoles = pool.rules?.eligibleRoles;
        if (eligibleRoles?.length && !eligibleRoles.includes(participant.role)) {
            throw new apiErrors_1.ForbiddenError('Your role is not eligible to claim from this loot pool');
        }
        return participant;
    }
    async assertWithinItemCap(pool, itemId, userId) {
        const cap = pool.rules?.maxItemsPerParticipant;
        if (!cap || cap <= 0) {
            return;
        }
        const existing = await this.claimRepo
            .createQueryBuilder('claim')
            .where('claim."lootPoolId" = :poolId', { poolId: pool.id })
            .andWhere('claim."userId" = :userId', { userId })
            .andWhere('claim.status = :status', { status: LootClaim_1.LootClaimStatus.PENDING })
            .getMany();
        const distinctItems = new Set(existing.map(c => c.lootItemId));
        distinctItems.delete(itemId);
        if (distinctItems.size >= cap) {
            throw new apiErrors_1.ValidationError(`You may only claim ${cap} item${cap === 1 ? '' : 's'} from this pool`);
        }
    }
    capReached(wonCount, userId, cap) {
        if (!cap || cap <= 0) {
            return false;
        }
        return (wonCount.get(userId) ?? 0) >= cap;
    }
    async getHighestBid(itemId) {
        return this.claimRepo
            .createQueryBuilder('claim')
            .where('claim."lootItemId" = :itemId', { itemId })
            .andWhere('claim."claimType" = :claimType', { claimType: LootClaim_1.LootClaimType.BID })
            .orderBy('claim."bidAmount"', 'DESC')
            .getOne();
    }
    async markLosers(itemId, winnerClaimId) {
        await this.claimRepo
            .createQueryBuilder()
            .update(LootClaim_1.LootClaim)
            .set({ status: LootClaim_1.LootClaimStatus.LOST })
            .where('"lootItemId" = :itemId', { itemId })
            .andWhere('id != :winnerClaimId', { winnerClaimId })
            .execute();
    }
    async awardItemTo(item, userId) {
        item.awardedToUserId = userId;
        item.status = LootItem_1.LootItemStatus.AWARDED;
        await this.itemRepo.save(item);
    }
    computeWeightedShares(totalValue, participants, roleWeights) {
        if (participants.length === 0) {
            return [];
        }
        const weightFor = (role) => {
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
    roll() {
        return Math.floor(Math.random() * 100) + 1;
    }
    async recomputeTotal(pool) {
        const raw = await this.itemRepo
            .createQueryBuilder('item')
            .select('COALESCE(SUM(item."totalValue"), 0)', 'total')
            .where('item."lootPoolId" = :poolId', { poolId: pool.id })
            .getRawOne();
        pool.totalValue = Number(raw?.total ?? 0);
        await this.repository.save(pool);
    }
    async resolveLeaderId(activityId, fallback) {
        const leader = await this.participantRepo
            .createQueryBuilder('participant')
            .where('participant."activityId" = :activityId', { activityId })
            .andWhere('participant.role = :role', { role: Activity_1.ParticipantRole.LEADER })
            .getOne();
        return leader?.userId ?? fallback;
    }
    async findPoolItem(poolId, itemId) {
        return this.itemRepo
            .createQueryBuilder('item')
            .where('item.id = :itemId', { itemId })
            .andWhere('item."lootPoolId" = :poolId', { poolId })
            .getOne();
    }
    normaliseAssistantUserIds(assistantUserIds) {
        if (!assistantUserIds?.length) {
            return [];
        }
        const normalised = assistantUserIds
            .map(candidate => candidate.trim())
            .filter(candidate => candidate.length > 0);
        return Array.from(new Set(normalised));
    }
    normaliseStringArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return Array.from(new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0)));
    }
    withAssistantUserIds(metadata, assistantUserIds) {
        const nextMetadata = metadata ? { ...metadata } : {};
        if (assistantUserIds.length === 0) {
            delete nextMetadata['assistantUserIds'];
            return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
        }
        nextMetadata['assistantUserIds'] = assistantUserIds;
        return nextMetadata;
    }
    async getAssistantUserIds(pool) {
        const assistants = await this.assistantRepo
            .createQueryBuilder('assistant')
            .select('assistant."userId"', 'userId')
            .where('assistant."organizationId" = :organizationId', {
            organizationId: pool.organizationId,
        })
            .andWhere('assistant."lootPoolId" = :lootPoolId', { lootPoolId: pool.id })
            .getRawMany();
        if (assistants.length > 0) {
            return this.normaliseStringArray(assistants.map(assistant => assistant.userId));
        }
        return this.getAssistantUserIdsFromMetadata(pool);
    }
    getAssistantUserIdsFromMetadata(pool) {
        const assistantUserIds = pool.metadata?.['assistantUserIds'];
        return this.normaliseStringArray(assistantUserIds);
    }
    withEvenSplitPaidUserIds(metadata, paidUserIds) {
        const nextMetadata = metadata ? { ...metadata } : {};
        if (paidUserIds.length === 0) {
            delete nextMetadata['evenSplitPaidUserIds'];
            return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
        }
        nextMetadata['evenSplitPaidUserIds'] = paidUserIds;
        return nextMetadata;
    }
    getEvenSplitPaidUserIds(pool) {
        const paidUserIds = pool.metadata?.['evenSplitPaidUserIds'];
        return this.normaliseStringArray(paidUserIds);
    }
    async replacePoolAssistants(organizationId, poolId, assistantUserIds) {
        await data_source_1.AppDataSource.transaction(async (manager) => {
            const assistantRepo = manager.getRepository(LootPoolAssistant_1.LootPoolAssistant);
            await assistantRepo.delete({ organizationId, lootPoolId: poolId });
            if (assistantUserIds.length > 0) {
                const entities = assistantUserIds.map(assistantUserId => assistantRepo.create({
                    organizationId,
                    lootPoolId: poolId,
                    userId: assistantUserId,
                }));
                await assistantRepo.save(entities);
            }
        });
    }
    async hydratePoolAssistants(pool) {
        const assistantUserIds = await this.getAssistantUserIds(pool);
        pool.metadata = this.withAssistantUserIds(pool.metadata, assistantUserIds);
    }
    async hydratePoolsAssistants(pools) {
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
            .getRawMany();
        const assistantsByPoolId = new Map();
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
exports.LootDistributionService = LootDistributionService;
let lootDistributionServiceInstance = null;
function getLootDistributionService() {
    lootDistributionServiceInstance ??= new LootDistributionService();
    return lootDistributionServiceInstance;
}
//# sourceMappingURL=LootDistributionService.js.map